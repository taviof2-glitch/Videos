import { db } from './db'
import { adjustStock } from './products'
import { roundQty } from './quantity'
import type { PaymentMethod, Transaction, TransactionItem } from './types'

export type ItemInput = {
  productId?: string
  /** Obligatorio si no hay productId (línea libre); si hay, se toma del producto. */
  name?: string
  quantity: number
  unitPriceCents: number
  /** Si falta: el costo que ya tenía la línea al editar, o el costo actual del producto. */
  unitCostCents?: number
}

export type SaleInput = {
  /** Con productos. Si va vacío o falta, es una venta rápida y se usa `amountCents`. */
  items?: ItemInput[]
  amountCents?: number
  concept?: string
  paymentMethod?: PaymentMethod
  /** ISO. Al editar, si falta se conserva la fecha original. */
  date?: string
  contactId?: string
}

export type ExpenseInput = {
  amountCents: number
  concept?: string
  categoryId?: string
  paymentMethod?: PaymentMethod
  date?: string
  contactId?: string
}

/** Cada línea se redondea una sola vez al centavo. */
export const lineTotal = (quantity: number, unitPriceCents: number) => Math.round(quantity * unitPriceCents)

const STORES = () => [db.txn, db.txnItem, db.product, db.stockMovement]

function checkDate(date: string | undefined, fallback: string): string {
  if (date === undefined) return fallback
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) throw new Error('La fecha no es válida')
  return d.toISOString()
}

function checkAmount(cents: number | undefined): number {
  if (cents === undefined || !Number.isInteger(cents) || cents <= 0) throw new Error('El monto debe ser mayor que cero')
  return cents
}

type Line = Omit<TransactionItem, 'id' | 'transactionId'>

/** Valida las líneas y resuelve nombre y costo. `kept` = líneas anteriores (al editar). */
async function buildLines(businessId: string, items: ItemInput[], kept: TransactionItem[] = []): Promise<Line[]> {
  const keptByProduct = new Map(kept.filter((i) => i.productId).map((i) => [i.productId!, i]))
  const lines: Line[] = []
  for (const it of items) {
    const quantity = roundQty(it.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0) throw new Error('El precio no es válido')
    if (it.productId) {
      const product = await db.product.get(it.productId)
      // Un producto borrado después de la venta se puede seguir conservando al editarla.
      const stillInSale = keptByProduct.has(it.productId)
      if (!product || product.businessId !== businessId || (product.deletedAt && !stillInSale)) {
        throw new Error('Uno de los productos ya no existe')
      }
      lines.push({
        productId: product.id,
        name: it.name?.trim() || keptByProduct.get(product.id)?.name || product.name,
        quantity,
        unitPriceCents: it.unitPriceCents,
        unitCostCents: it.unitCostCents ?? keptByProduct.get(product.id)?.unitCostCents ?? product.costCents,
      })
    } else {
      const name = it.name?.trim()
      if (!name) throw new Error('Cada línea necesita un nombre o un producto')
      lines.push({ name, quantity, unitPriceCents: it.unitPriceCents, unitCostCents: it.unitCostCents ?? 0 })
    }
  }
  return lines
}

/** Concepto automático de una venta con productos: "Silla ×3, Mesa". */
export function autoConcept(lines: { name: string; quantity: number }[]): string {
  return lines.map((l) => (l.quantity === 1 ? l.name : `${l.name} ×${l.quantity}`)).join(', ')
}

function saleConcept(input: SaleInput, lines: Line[]): string {
  return input.concept?.trim() || autoConcept(lines)
}

function saleTotal(input: SaleInput, lines: Line[]): number {
  return lines.length ? lines.reduce((sum, l) => sum + lineTotal(l.quantity, l.unitPriceCents), 0) : checkAmount(input.amountCents)
}

/** Stock que debe quedar descontado por producto. */
function qtyByProduct(lines: { productId?: string; quantity: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lines) if (l.productId) m.set(l.productId, roundQty((m.get(l.productId) ?? 0) + l.quantity))
  return m
}

/**
 * Registra una venta y descuenta el stock en la misma transacción.
 * Vender más de lo que hay no se bloquea: el stock queda negativo (la pantalla avisa).
 */
export async function createSale(businessId: string, input: SaleInput): Promise<Transaction> {
  return db.transaction('rw', STORES(), async () => {
    const now = new Date().toISOString()
    const lines = await buildLines(businessId, input.items ?? [])
    const sale: Transaction = {
      id: crypto.randomUUID(),
      businessId,
      type: 'sale',
      amountCents: saleTotal(input, lines),
      concept: saleConcept(input, lines),
      date: checkDate(input.date, now),
      paymentMethod: input.paymentMethod ?? 'cash',
      status: 'paid',
      contactId: input.contactId || undefined,
      createdAt: now,
      updatedAt: now,
    }
    await db.txn.add(sale)
    await db.txnItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), transactionId: sale.id })))
    for (const [productId, qty] of qtyByProduct(lines)) await adjustStock(productId, -qty, 'sale', sale.id)
    return sale
  })
}

async function liveTxn(id: string, type: Transaction['type']): Promise<Transaction> {
  const t = await db.txn.get(id)
  if (!t || t.deletedAt || t.type !== type) throw new Error(type === 'sale' ? 'La venta no existe' : 'El gasto no existe')
  return t
}

/**
 * Edita una venta reemplazando sus datos por `input`. El stock se corrige con movimientos
 * por la diferencia de cada producto (no se reescribe el historial).
 */
export async function updateSale(id: string, input: SaleInput): Promise<Transaction> {
  return db.transaction('rw', STORES(), async () => {
    const old = await liveTxn(id, 'sale')
    const oldItems = await db.txnItem.where({ transactionId: id }).toArray()
    const lines = await buildLines(old.businessId, input.items ?? [], oldItems)
    const before = qtyByProduct(oldItems)
    const after = qtyByProduct(lines)
    for (const productId of new Set([...before.keys(), ...after.keys()])) {
      const diff = roundQty((before.get(productId) ?? 0) - (after.get(productId) ?? 0))
      if (diff !== 0) await adjustStock(productId, diff, 'sale', id)
    }
    await db.txnItem.where({ transactionId: id }).delete()
    await db.txnItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), transactionId: id })))
    const next: Transaction = {
      ...old,
      amountCents: saleTotal(input, lines),
      concept: saleConcept(input, lines),
      date: checkDate(input.date, old.date),
      paymentMethod: input.paymentMethod ?? old.paymentMethod,
      contactId: input.contactId || undefined,
      updatedAt: new Date().toISOString(),
    }
    await db.txn.put(next)
    return next
  })
}

export async function createExpense(businessId: string, input: ExpenseInput): Promise<Transaction> {
  const now = new Date().toISOString()
  const expense: Transaction = {
    id: crypto.randomUUID(),
    businessId,
    type: 'expense',
    amountCents: checkAmount(input.amountCents),
    concept: input.concept?.trim() ?? '',
    date: checkDate(input.date, now),
    paymentMethod: input.paymentMethod ?? 'cash',
    status: 'paid',
    contactId: input.contactId || undefined,
    categoryId: input.categoryId || undefined,
    createdAt: now,
    updatedAt: now,
  }
  await db.txn.add(expense)
  return expense
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Transaction> {
  return db.transaction('rw', db.txn, async () => {
    const old = await liveTxn(id, 'expense')
    const next: Transaction = {
      ...old,
      amountCents: checkAmount(input.amountCents),
      concept: input.concept?.trim() ?? '',
      date: checkDate(input.date, old.date),
      paymentMethod: input.paymentMethod ?? old.paymentMethod,
      contactId: input.contactId || undefined,
      categoryId: input.categoryId || undefined,
      updatedAt: new Date().toISOString(),
    }
    await db.txn.put(next)
    return next
  })
}

/**
 * Borra una venta o gasto (borrado lógico). En una venta, el stock vuelve al inventario
 * con movimientos 'void'; las líneas se conservan para el historial.
 */
export async function voidTransaction(id: string): Promise<void> {
  await db.transaction('rw', STORES(), async () => {
    const t = await db.txn.get(id)
    if (!t || t.deletedAt) throw new Error('El movimiento no existe')
    if (t.type === 'sale') {
      const items = await db.txnItem.where({ transactionId: id }).toArray()
      for (const [productId, qty] of qtyByProduct(items)) await adjustStock(productId, qty, 'void', id)
    }
    const now = new Date().toISOString()
    await db.txn.update(id, { deletedAt: now, updatedAt: now })
  })
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const t = await db.txn.get(id)
  return t && !t.deletedAt ? t : undefined
}

export async function getItems(transactionId: string): Promise<TransactionItem[]> {
  return db.txnItem.where({ transactionId }).toArray()
}

export type TxnFilter = { type?: Transaction['type']; from?: string; to?: string; limit?: number }

/** Movimientos vivos del negocio, los más recientes primero. `from`/`to` son ISO, ambos inclusivos. */
export async function listTransactions(businessId: string, filter: TxnFilter = {}): Promise<Transaction[]> {
  const rows = await db.txn
    .where('[businessId+date]')
    .between([businessId, filter.from ?? ''], [businessId, filter.to ?? '￿'], true, true)
    .filter((t) => !t.deletedAt && (!filter.type || t.type === filter.type))
    .reverse()
    .toArray()
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  return filter.limit ? rows.slice(0, filter.limit) : rows
}

/** Ganancia de una venta con productos: suma de (precio − costo) por línea. */
export function saleProfit(items: TransactionItem[]): number {
  return items.reduce((sum, i) => sum + lineTotal(i.quantity, i.unitPriceCents) - lineTotal(i.quantity, i.unitCostCents), 0)
}
