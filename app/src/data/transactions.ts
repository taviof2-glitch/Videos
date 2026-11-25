import { isValidDayKey } from './dates'
import { db } from './db'
import { actorId } from './team'
import { adjustStock, unitCost } from './products'
import { roundQty } from './quantity'
import type { PaymentMethod, ProductVariant, Transaction, TransactionItem } from './types'

export type ItemInput = {
  productId?: string
  /** Obligatorio si el producto tiene variantes. */
  variantId?: string
  /** Obligatorio si no hay productId (línea libre); si hay, se toma del producto. */
  name?: string
  quantity: number
  unitPriceCents: number
  /** Si falta: el costo que ya tenía la línea al editar, o el costo actual del producto. */
  unitCostCents?: number
  /** Descuento de la línea, en centavos; no puede superar el importe (cantidad × precio). */
  discountCents?: number
}

export type SaleInput = {
  /** Interno: quién lo registró cuando lo llama otra operación que ya lo averiguó (p. ej. cobrar un pedido). */
  createdBy?: string
  /** Con productos. Si va vacío o falta, es una venta rápida y se usa `amountCents`. */
  items?: ItemInput[]
  amountCents?: number
  concept?: string
  paymentMethod?: PaymentMethod
  /** ISO. Al editar, si falta se conserva la fecha original. */
  date?: string
  contactId?: string
  /** Interno: enlaza la venta con el pedido que la originó (ver orders.ts). */
  orderId?: string
  /** Fiado: exige cliente. Se cobra con abonos (ver debts.ts). Al editar, falta = contado. */
  credit?: boolean
  /** Fecha límite de pago, 'YYYY-MM-DD'. Solo con `credit`. */
  dueDate?: string
}

export type ExpenseInput = {
  /** Interno: ver SaleInput. */
  createdBy?: string
  amountCents: number
  concept?: string
  categoryId?: string
  paymentMethod?: PaymentMethod
  date?: string
  contactId?: string
  /** A crédito con proveedor: exige proveedor. Se paga con abonos (ver debts.ts). */
  credit?: boolean
  dueDate?: string
  /** Interno: enlaza el gasto con la compra que lo originó (ver purchases.ts). */
  purchaseId?: string
}

const ORDER_LOCKED = 'Esta venta viene de un pedido: cancela o cambia el pedido desde Pedidos'

/** Cada línea se redondea una sola vez al centavo. */
export const lineTotal = (quantity: number, unitPriceCents: number) => Math.round(quantity * unitPriceCents)

/** Importe de una línea ya con su descuento. */
export const lineNet = (i: { quantity: number; unitPriceCents: number; discountCents?: number }) => lineTotal(i.quantity, i.unitPriceCents) - (i.discountCents ?? 0)

const STORES = () => [db.txn, db.txnItem, db.product, db.productVariant, db.stockMovement, db.payment]

function checkDate(date: string | undefined, fallback: string): string {
  if (date === undefined) return fallback
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) throw new Error('La fecha no es válida')
  return d.toISOString()
}

const CREDIT_NEEDS = {
  sale: 'Para vender fiado elige un cliente',
  expense: 'Para registrar un gasto a crédito elige un proveedor',
}

/** Estado de pago y fecha límite. Un fiado sin contacto no se sabría a quién cobrar. */
function creditFields(input: { credit?: boolean; dueDate?: string; contactId?: string }, type: Transaction['type']) {
  if (!input.credit) return { status: 'paid' as const, dueDate: undefined }
  if (!input.contactId) throw new Error(CREDIT_NEEDS[type])
  const dueDate = input.dueDate?.trim() || undefined
  if (dueDate && !isValidDayKey(dueDate)) throw new Error('La fecha límite no es válida')
  return { status: 'credit' as const, dueDate }
}

/** Con abonos ya registrados no se puede cambiar lo que los sostiene. */
async function guardPaid(old: Transaction, next: { amountCents: number; status: Transaction['status']; contactId?: string }) {
  const rows = await db.payment.where({ transactionId: old.id }).filter((p) => !p.deletedAt).toArray()
  if (rows.length === 0) return
  if (next.status !== old.status) throw new Error('Ya tiene abonos: no se puede cambiar entre contado y fiado')
  if (next.contactId !== old.contactId) throw new Error('Ya tiene abonos: no se puede cambiar el contacto')
  if (next.amountCents < rows.reduce((sum, p) => sum + p.amountCents, 0)) throw new Error('El monto no puede ser menor a lo ya abonado')
}

function checkAmount(cents: number | undefined): number {
  if (cents === undefined || !Number.isInteger(cents) || cents <= 0) throw new Error('El monto debe ser mayor que cero')
  return cents
}

type Line = Omit<TransactionItem, 'id' | 'transactionId'>

const stockKey = (productId: string, variantId?: string) => `${productId}|${variantId ?? ''}`

/** Valida las líneas y resuelve nombre y costo. `kept` = líneas anteriores (al editar). */
async function buildLines(businessId: string, items: ItemInput[], kept: TransactionItem[] = []): Promise<Line[]> {
  const keptBy = new Map(kept.filter((i) => i.productId).map((i) => [stockKey(i.productId!, i.variantId), i]))
  const keptProducts = new Set(kept.map((i) => i.productId).filter(Boolean))
  const lines: Line[] = []
  for (const it of items) {
    const quantity = roundQty(it.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0) throw new Error('El precio no es válido')
    const discountCents = it.discountCents ?? 0
    if (!Number.isInteger(discountCents) || discountCents < 0) throw new Error('El descuento no es válido')
    if (discountCents > lineTotal(quantity, it.unitPriceCents)) throw new Error('El descuento no puede superar el importe de la línea')
    if (it.productId) {
      const product = await db.product.get(it.productId)
      // Un producto (o variante) borrado después de la venta se puede seguir conservando al editarla.
      if (!product || product.businessId !== businessId || (product.deletedAt && !keptProducts.has(it.productId))) {
        throw new Error('Uno de los productos ya no existe')
      }
      const before = keptBy.get(stockKey(product.id, it.variantId))
      let variant: ProductVariant | undefined
      if (it.variantId) {
        variant = await db.productVariant.get(it.variantId)
        if (!variant || variant.productId !== product.id || (variant.deletedAt && !before)) throw new Error('Una de las variantes ya no existe')
      } else if (product.hasVariants) {
        throw new Error(`Elige la variante de "${product.name}"`)
      }
      lines.push({
        productId: product.id,
        ...(variant && { variantId: variant.id }),
        name: it.name?.trim() || before?.name || (variant ? `${product.name} (${variant.name})` : product.name),
        quantity,
        unitPriceCents: it.unitPriceCents,
        unitCostCents: it.unitCostCents ?? before?.unitCostCents ?? unitCost(product, variant),
        ...(discountCents > 0 && { discountCents }),
      })
    } else {
      const name = it.name?.trim()
      if (!name) throw new Error('Cada línea necesita un nombre o un producto')
      lines.push({ name, quantity, unitPriceCents: it.unitPriceCents, unitCostCents: it.unitCostCents ?? 0, ...(discountCents > 0 && { discountCents }) })
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
  return lines.length ? lines.reduce((sum, l) => sum + lineNet(l), 0) : checkAmount(input.amountCents)
}

type StockQty = { productId: string; variantId?: string; qty: number }

/** Stock que debe quedar descontado, por producto (y variante). */
function qtyByStock(lines: { productId?: string; variantId?: string; quantity: number }[]): Map<string, StockQty> {
  const m = new Map<string, StockQty>()
  for (const l of lines) {
    if (!l.productId) continue
    const k = stockKey(l.productId, l.variantId)
    const prev = m.get(k)
    m.set(k, { productId: l.productId, variantId: l.variantId, qty: roundQty((prev?.qty ?? 0) + l.quantity) })
  }
  return m
}

/**
 * Registra una venta y descuenta el stock en la misma transacción.
 * Vender más de lo que hay no se bloquea: el stock queda negativo (la pantalla avisa).
 */
export async function createSale(businessId: string, input: SaleInput): Promise<Transaction> {
  const by = 'createdBy' in input ? input.createdBy : await actorId(businessId)
  return db.transaction('rw', STORES(), async () => {
    const now = new Date().toISOString()
    const lines = await buildLines(businessId, input.items ?? [])
    const credit = creditFields(input, 'sale')
    const sale: Transaction = {
      id: crypto.randomUUID(),
      businessId,
      type: 'sale',
      amountCents: saleTotal(input, lines),
      concept: saleConcept(input, lines),
      date: checkDate(input.date, now),
      paymentMethod: input.paymentMethod ?? 'cash',
      ...credit,
      contactId: input.contactId || undefined,
      ...(input.orderId && { orderId: input.orderId }),
      ...(by && { createdBy: by }),
      createdAt: now,
      updatedAt: now,
    }
    await db.txn.add(sale)
    await db.txnItem.bulkAdd(lines.map((l, position) => ({ ...l, position, id: crypto.randomUUID(), transactionId: sale.id })))
    for (const q of qtyByStock(lines).values()) await adjustStock(q.productId, -q.qty, 'sale', sale.id, q.variantId)
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
    if (old.orderId) throw new Error(ORDER_LOCKED)
    const oldItems = await getItems(id)
    const lines = await buildLines(old.businessId, input.items ?? [], oldItems)
    const amountCents = saleTotal(input, lines)
    const credit = creditFields(input, 'sale')
    await guardPaid(old, { amountCents, status: credit.status, contactId: input.contactId || undefined })
    const before = qtyByStock(oldItems)
    const after = qtyByStock(lines)
    for (const k of new Set([...before.keys(), ...after.keys()])) {
      const ref = (before.get(k) ?? after.get(k))!
      const diff = roundQty((before.get(k)?.qty ?? 0) - (after.get(k)?.qty ?? 0))
      if (diff !== 0) await adjustStock(ref.productId, diff, 'sale', id, ref.variantId)
    }
    await db.txnItem.where({ transactionId: id }).delete()
    await db.txnItem.bulkAdd(lines.map((l, position) => ({ ...l, position, id: crypto.randomUUID(), transactionId: id })))
    const next: Transaction = {
      ...old,
      ...credit,
      amountCents,
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
  const credit = creditFields(input, 'expense')
  const by = 'createdBy' in input ? input.createdBy : await actorId(businessId)
  const expense: Transaction = {
    id: crypto.randomUUID(),
    businessId,
    type: 'expense',
    amountCents: checkAmount(input.amountCents),
    concept: input.concept?.trim() ?? '',
    date: checkDate(input.date, now),
    paymentMethod: input.paymentMethod ?? 'cash',
    ...credit,
    contactId: input.contactId || undefined,
    categoryId: input.categoryId || undefined,
    ...(input.purchaseId && { purchaseId: input.purchaseId }),
    ...(by && { createdBy: by }),
    createdAt: now,
    updatedAt: now,
  }
  await db.txn.add(expense)
  return expense
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Transaction> {
  return db.transaction('rw', [db.txn, db.payment], async () => {
    const old = await liveTxn(id, 'expense')
    if (old.purchaseId) throw new Error(PURCHASE_LOCKED)
    const amountCents = checkAmount(input.amountCents)
    const credit = creditFields(input, 'expense')
    await guardPaid(old, { amountCents, status: credit.status, contactId: input.contactId || undefined })
    const next: Transaction = {
      ...old,
      ...credit,
      amountCents,
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
  const t = await db.txn.get(id)
  if (t?.purchaseId && !t.deletedAt) throw new Error(PURCHASE_LOCKED)
  if (t?.orderId && !t.deletedAt) throw new Error(ORDER_LOCKED)
  await voidLinkedTransaction(id)
}

const PURCHASE_LOCKED = 'Este gasto viene de una compra: anúlala desde Compras y vuelve a registrarla'

/** Igual que `voidTransaction` pero también para gastos que vienen de una compra (lo usa `voidPurchase`). */
export async function voidLinkedTransaction(id: string): Promise<void> {
  await db.transaction('rw', STORES(), async () => {
    const t = await db.txn.get(id)
    if (!t || t.deletedAt) throw new Error('El movimiento no existe')
    if (t.status === 'credit' && (await db.payment.where({ transactionId: id }).filter((p) => !p.deletedAt).count()) > 0) {
      throw new Error('Primero anula los abonos de esta deuda')
    }
    if (t.type === 'sale') {
      const items = await db.txnItem.where({ transactionId: id }).toArray()
      for (const q of qtyByStock(items).values()) await adjustStock(q.productId, q.qty, 'void', id, q.variantId)
    }
    const now = new Date().toISOString()
    await db.txn.update(id, { deletedAt: now, updatedAt: now })
  })
}

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const t = await db.txn.get(id)
  return t && !t.deletedAt ? t : undefined
}

/** Líneas de una venta en el orden en que se capturaron. */
export async function getItems(transactionId: string): Promise<TransactionItem[]> {
  const items = await db.txnItem.where({ transactionId }).toArray()
  return items.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
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
  return items.reduce((sum, i) => sum + lineNet(i) - lineTotal(i.quantity, i.unitCostCents), 0)
}
