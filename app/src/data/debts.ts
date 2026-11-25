import { db } from './db'
import { actorId } from './team'
import type { Contact, Payment, PaymentMethod, Transaction } from './types'

/** Por cobrar = clientes que deben (ventas fiadas). Por pagar = proveedores a quienes se debe (gastos a crédito). */
export type DebtKind = 'receivable' | 'payable'

export const debtTxnType = (kind: DebtKind): Transaction['type'] => (kind === 'receivable' ? 'sale' : 'expense')

export type DebtItem = {
  txn: Transaction
  payments: Payment[]
  paidCents: number
  remainingCents: number
}

export const isOverdue = (item: Pick<DebtItem, 'remainingCents' | 'txn'>, today: string) =>
  item.remainingCents > 0 && !!item.txn.dueDate && item.txn.dueDate < today

function toItems(txns: Transaction[], payments: Payment[]): DebtItem[] {
  const byTxn = new Map<string, Payment[]>()
  for (const p of payments) if (!p.deletedAt) byTxn.set(p.transactionId, [...(byTxn.get(p.transactionId) ?? []), p])
  return txns.map((txn) => {
    const mine = byTxn.get(txn.id) ?? []
    const paidCents = mine.reduce((sum, p) => sum + p.amountCents, 0)
    return { txn, payments: mine, paidCents, remainingCents: txn.amountCents - paidCents }
  })
}

/** Ventas o gastos a crédito de un contacto (vivos), de la más antigua a la más reciente. */
export async function contactDebts(contactId: string): Promise<DebtItem[]> {
  const txns = await db.txn.where('contactId').equals(contactId).filter((t) => !t.deletedAt && t.status === 'credit').toArray()
  const payments = await db.payment.where('contactId').equals(contactId).toArray()
  return toItems(txns, payments).sort((a, b) => a.txn.date.localeCompare(b.txn.date) || a.txn.createdAt.localeCompare(b.txn.createdAt))
}

export const sumRemaining = (items: DebtItem[]) => items.reduce((sum, i) => sum + i.remainingCents, 0)

/** Saldo pendiente de un contacto (lo que debe o se le debe). */
export async function contactBalance(contactId: string): Promise<number> {
  return sumRemaining(await contactDebts(contactId))
}

export type DebtorSummary = {
  contact: Contact
  balanceCents: number
  overdueCents: number
  /** Fecha límite más próxima entre sus deudas abiertas. */
  nextDue?: string
  openCount: number
}

export type DebtSummary = { totalCents: number; overdueCents: number; debtors: DebtorSummary[] }

/** Quién debe (o a quién se le debe) y cuánto. `today` es una clave de día en la zona del negocio. Vencidos primero, luego mayor saldo. */
export async function debtSummary(businessId: string, kind: DebtKind, today: string): Promise<DebtSummary> {
  const type = debtTxnType(kind)
  const txns = await db.txn
    .where('[businessId+type]')
    .equals([businessId, type])
    .filter((t) => !t.deletedAt && t.status === 'credit' && !!t.contactId)
    .toArray()
  const payments = txns.length ? await db.payment.where('transactionId').anyOf(txns.map((t) => t.id)).toArray() : []
  const open = toItems(txns, payments).filter((i) => i.remainingCents > 0)
  const byContact = new Map<string, DebtItem[]>()
  for (const i of open) byContact.set(i.txn.contactId!, [...(byContact.get(i.txn.contactId!) ?? []), i])
  const ids = [...byContact.keys()]
  const contacts = await db.contact.bulkGet(ids)
  const debtors: DebtorSummary[] = []
  contacts.forEach((contact, idx) => {
    if (!contact) return
    const items = byContact.get(ids[idx])!
    const dues = items.map((i) => i.txn.dueDate).filter((d): d is string => !!d).sort()
    debtors.push({
      contact,
      balanceCents: sumRemaining(items),
      overdueCents: sumRemaining(items.filter((i) => isOverdue(i, today))),
      nextDue: dues[0],
      openCount: items.length,
    })
  })
  debtors.sort((a, b) => Number(b.overdueCents > 0) - Number(a.overdueCents > 0) || b.balanceCents - a.balanceCents || a.contact.name.localeCompare(b.contact.name, 'es'))
  return {
    totalCents: debtors.reduce((sum, d) => sum + d.balanceCents, 0),
    overdueCents: debtors.reduce((sum, d) => sum + d.overdueCents, 0),
    debtors,
  }
}

export type PaymentInput = {
  /** Interno: quién lo registró cuando lo llama otra operación que ya lo averiguó. */
  createdBy?: string
  method?: PaymentMethod
  date?: string
  /** Aplicar el abono solo a esta deuda (p. ej. el anticipo de una venta) en vez de repartirlo entre las más antiguas. */
  transactionId?: string
}

/**
 * Registra un abono (cliente) o pago (proveedor). Se reparte entre las deudas abiertas del
 * contacto, de la más antigua a la más reciente. No puede superar el saldo pendiente.
 * Con `transactionId` se aplica solo a esa deuda. Devuelve el `batchId` que agrupa las filas creadas.
 */
export async function addPayment(contactId: string, amountCents: number, input: PaymentInput = {}): Promise<string> {
  const by = 'createdBy' in input ? input.createdBy : await actorId((await db.contact.get(contactId))?.businessId ?? '')
  return db.transaction('rw', [db.txn, db.payment, db.contact], async () => {
    const contact = await db.contact.get(contactId)
    if (!contact || contact.deletedAt) throw new Error('El contacto no existe')
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('El abono debe ser mayor que cero')
    const date = input.date === undefined ? new Date().toISOString() : new Date(input.date).toISOString()
    const kind: DebtKind = contact.type === 'customer' ? 'receivable' : 'payable'
    const open = (await contactDebts(contactId)).filter(
      (i) => i.txn.type === debtTxnType(kind) && i.remainingCents > 0 && (!input.transactionId || i.txn.id === input.transactionId),
    )
    if (open.length === 0) throw new Error('No tiene deudas pendientes')
    if (amountCents > sumRemaining(open)) throw new Error('El abono no puede superar el saldo pendiente')

    const batchId = crypto.randomUUID()
    const now = new Date().toISOString()
    let left = amountCents
    const rows: Payment[] = []
    for (const item of open) {
      if (left === 0) break
      const part = Math.min(left, item.remainingCents)
      left -= part
      rows.push({
        id: crypto.randomUUID(), businessId: contact.businessId, transactionId: item.txn.id, contactId, batchId,
        direction: kind === 'receivable' ? 'in' : 'out', amountCents: part, method: input.method ?? 'cash', date,
        ...(by && { createdBy: by }), createdAt: now, updatedAt: now,
      })
    }
    await db.payment.bulkAdd(rows)
    return batchId
  })
}

/** Anula un abono completo (todas las filas de su `batchId`); el saldo de las deudas vuelve a subir. */
export async function voidPayment(batchId: string): Promise<void> {
  const now = new Date().toISOString()
  const n = await db.payment.where('batchId').equals(batchId).filter((p) => !p.deletedAt).modify({ deletedAt: now, updatedAt: now })
  if (n === 0) throw new Error('El abono no existe')
}

/** Abonos vivos con fecha dentro del rango (ISO inclusivos). Una fila por deuda cubierta. */
export async function listPayments(businessId: string, range: { from?: string; to?: string } = {}): Promise<Payment[]> {
  return db.payment
    .where('[businessId+date]')
    .between([businessId, range.from ?? ''], [businessId, range.to ?? '￿'], true, true)
    .filter((p) => !p.deletedAt)
    .toArray()
}

export type PaymentBatch = Pick<Payment, 'batchId' | 'contactId' | 'direction' | 'method' | 'date'> & { amountCents: number }

export function groupPayments(rows: Payment[]): PaymentBatch[] {
  const map = new Map<string, PaymentBatch>()
  for (const p of rows) {
    const b = map.get(p.batchId)
    if (b) b.amountCents += p.amountCents
    else map.set(p.batchId, { batchId: p.batchId, contactId: p.contactId, direction: p.direction, method: p.method, date: p.date, amountCents: p.amountCents })
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}
