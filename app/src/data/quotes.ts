import { daysBetween, isValidDayKey } from './dates'
import { addPayment } from './debts'
import { db } from './db'
import { roundQty } from './quantity'
import { createSale, lineTotal, type ItemInput } from './transactions'
import type { PaymentMethod, Quote, QuoteItem, QuoteStatus, Transaction } from './types'

export type QuoteItemInput = {
  productId?: string
  /** Obligatorio si no hay productId (línea libre); si hay, se toma del producto. */
  name?: string
  /** Pieza por defecto. */
  unit?: string
  quantity: number
  unitPriceCents: number
}

export type QuoteInput = {
  title?: string
  contactId: string
  /** Última fecha de vigencia, 'YYYY-MM-DD'. */
  validUntil: string
  /** Porcentaje de IVA (16 = 16 %); 0 o falta = sin IVA. */
  taxRate?: number
  notes?: string
  items: QuoteItemInput[]
}

export const DEFAULT_UNIT = 'pieza'
export const DEFAULT_VALIDITY_DAYS = 15
/** Una cotización pendiente con esta vigencia o menos se marca "por vencer". */
export const EXPIRING_DAYS = 3

const STORES = () => [db.quote, db.quoteItem, db.product, db.contact]

/** Subtotal, IVA y total. Cada línea se redondea una vez; el IVA se redondea una sola vez sobre el subtotal. */
export function quoteTotals(items: { quantity: number; unitPriceCents: number }[], taxRate: number) {
  const subtotalCents = items.reduce((sum, i) => sum + lineTotal(i.quantity, i.unitPriceCents), 0)
  // en puntos base (16 % = 1600) para no arrastrar errores de coma flotante
  const taxCents = Math.round((subtotalCents * Math.round(taxRate * 100)) / 10000)
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}

type Line = Omit<QuoteItem, 'id' | 'quoteId'>

async function buildLines(businessId: string, items: QuoteItemInput[], kept: QuoteItem[] = []): Promise<Line[]> {
  if (items.length === 0) throw new Error('Agrega al menos un artículo')
  const keptProducts = new Set(kept.map((i) => i.productId).filter(Boolean))
  const lines: Line[] = []
  for (const [position, it] of items.entries()) {
    const quantity = roundQty(it.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0) throw new Error('El precio no es válido')
    const unit = it.unit?.trim() || DEFAULT_UNIT
    if (it.productId) {
      const p = await db.product.get(it.productId)
      // Un producto archivado después de cotizar se puede seguir conservando al editar.
      if (!p || p.businessId !== businessId || (p.deletedAt && !keptProducts.has(p.id))) throw new Error('Uno de los productos ya no existe')
      lines.push({ position, productId: p.id, name: it.name?.trim() || p.name, unit, quantity, unitPriceCents: it.unitPriceCents })
    } else {
      const name = it.name?.trim()
      if (!name) throw new Error('Cada artículo necesita un nombre o un producto del inventario')
      lines.push({ position, name, unit, quantity, unitPriceCents: it.unitPriceCents })
    }
  }
  return lines
}

async function checkHeader(businessId: string, input: QuoteInput) {
  const contact = await db.contact.get(input.contactId)
  if (!contact || contact.deletedAt || contact.businessId !== businessId || contact.type !== 'customer') throw new Error('Elige un cliente')
  if (!isValidDayKey(input.validUntil)) throw new Error('La fecha de vigencia no es válida')
  const taxRate = input.taxRate ?? 0
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('El IVA debe estar entre 0 y 100 %')
  return taxRate
}

export async function createQuote(businessId: string, input: QuoteInput): Promise<Quote> {
  return db.transaction('rw', STORES(), async () => {
    const taxRate = await checkHeader(businessId, input)
    const lines = await buildLines(businessId, input.items)
    const last = await db.quote.where('[businessId+number]').between([businessId, 0], [businessId, Number.MAX_SAFE_INTEGER]).last()
    const now = new Date().toISOString()
    const quote: Quote = {
      id: crypto.randomUUID(), businessId, number: (last?.number ?? 0) + 1, title: input.title?.trim() ?? '', contactId: input.contactId,
      validUntil: input.validUntil, status: 'pending', taxRate, ...quoteTotals(lines, taxRate), notes: input.notes?.trim() ?? '',
      createdAt: now, updatedAt: now,
    }
    await db.quote.add(quote)
    await db.quoteItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), quoteId: quote.id })))
    return quote
  })
}

async function liveQuote(id: string): Promise<Quote> {
  const q = await db.quote.get(id)
  if (!q || q.deletedAt) throw new Error('La cotización no existe')
  return q
}

/** Reemplaza los datos y los artículos. No se edita una cotización ya convertida en venta. */
export async function updateQuote(id: string, input: QuoteInput): Promise<Quote> {
  return db.transaction('rw', STORES(), async () => {
    const old = await liveQuote(id)
    if (old.status === 'converted') throw new Error('Ya se convirtió en venta: no se puede editar')
    const taxRate = await checkHeader(old.businessId, input)
    const lines = await buildLines(old.businessId, input.items, await getQuoteItems(id))
    const next: Quote = {
      ...old, title: input.title?.trim() ?? '', contactId: input.contactId, validUntil: input.validUntil, taxRate,
      ...quoteTotals(lines, taxRate), notes: input.notes?.trim() ?? '', updatedAt: new Date().toISOString(),
    }
    await db.quoteItem.where({ quoteId: id }).delete()
    await db.quoteItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), quoteId: id })))
    await db.quote.put(next)
    return next
  })
}

/** Aceptada, rechazada o de nuevo pendiente. Convertir en venta es aparte (`convertQuote`). */
export async function setQuoteStatus(id: string, status: Exclude<QuoteStatus, 'converted'>): Promise<void> {
  const q = await liveQuote(id)
  if (q.status === 'converted') throw new Error('Ya se convirtió en venta')
  await db.quote.update(id, { status, updatedAt: new Date().toISOString() })
}

/** Borrado lógico. Una cotización convertida no se borra: su venta la respalda. */
export async function deleteQuote(id: string): Promise<void> {
  const q = await liveQuote(id)
  if (q.status === 'converted') throw new Error('Ya se convirtió en venta: no se puede borrar')
  const now = new Date().toISOString()
  await db.quote.update(id, { deletedAt: now, updatedAt: now })
}

export async function getQuote(id: string): Promise<Quote | undefined> {
  const q = await db.quote.get(id)
  return q && !q.deletedAt ? q : undefined
}

export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  return (await db.quoteItem.where({ quoteId }).toArray()).sort((a, b) => a.position - b.position)
}

/** Cotizaciones vivas del negocio, la más reciente primero. */
export async function listQuotes(businessId: string): Promise<Quote[]> {
  const rows = await db.quote.where('[businessId+status]').between([businessId, ''], [businessId, '￿']).filter((q) => !q.deletedAt).toArray()
  return rows.sort((a, b) => b.number - a.number)
}

export type QuoteState = QuoteStatus | 'expiring' | 'expired'

/** Estado visible: una pendiente pasa a "por vencer" y "vencida" según su fecha (`today` = día de hoy del negocio). */
export function quoteState(q: Pick<Quote, 'status' | 'validUntil'>, today: string): QuoteState {
  if (q.status !== 'pending') return q.status
  if (q.validUntil < today) return 'expired'
  return daysBetween(today, q.validUntil) <= EXPIRING_DAYS ? 'expiring' : 'pending'
}

export const needsAttention = (q: Pick<Quote, 'status' | 'validUntil'>, today: string) => ['expiring', 'expired'].includes(quoteState(q, today))

export type ConvertOptions = {
  /** Fiado: se cobra con abonos. Si no, de contado. */
  credit?: boolean
  dueDate?: string
  method?: PaymentMethod
  /** Anticipo recibido ahora (solo con `credit`); queda como abono de esta venta. */
  advanceCents?: number
  date?: string
}

/**
 * Convierte la cotización en una venta con los mismos artículos y precios (el IVA entra como una línea más).
 * Descuenta el stock de los productos. Todo o nada: si algo falla no queda venta ni cambio de estado.
 */
export async function convertQuote(id: string, opts: ConvertOptions = {}): Promise<{ sale: Transaction; quote: Quote }> {
  const advance = opts.advanceCents ?? 0
  return db.transaction('rw', [...STORES(), db.txn, db.txnItem, db.stockMovement, db.payment], async () => {
    const q = await liveQuote(id)
    if (q.status === 'converted') throw new Error('Ya se convirtió en venta')
    if (q.status === 'rejected') throw new Error('La cotización está rechazada: márcala como pendiente para convertirla')
    if (advance !== 0 && (!Number.isInteger(advance) || advance < 0)) throw new Error('El anticipo no es válido')
    if (advance > 0 && !opts.credit) throw new Error('Un anticipo solo aplica a una venta fiada')
    if (advance > q.totalCents) throw new Error('El anticipo no puede superar el total')

    const items: ItemInput[] = (await getQuoteItems(id)).map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents }))
    // El IVA es dinero que se cobra pero no ganancia: su costo es igual a su precio.
    if (q.taxCents > 0) items.push({ name: `IVA ${q.taxRate}%`, quantity: 1, unitPriceCents: q.taxCents, unitCostCents: q.taxCents })
    const sale = await createSale(q.businessId, {
      items, concept: q.title ? `Cotización #${q.number} · ${q.title}` : `Cotización #${q.number}`, contactId: q.contactId,
      paymentMethod: opts.method, credit: opts.credit, dueDate: opts.dueDate, date: opts.date,
    })
    if (sale.amountCents !== q.totalCents) throw new Error('El total de la venta no coincide con la cotización')
    if (advance > 0) await addPayment(q.contactId, advance, { method: opts.method, transactionId: sale.id })
    const quote: Quote = { ...q, status: 'converted', transactionId: sale.id, updatedAt: new Date().toISOString() }
    await db.quote.put(quote)
    return { sale, quote }
  })
}
