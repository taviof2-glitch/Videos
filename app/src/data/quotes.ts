import { addDays, dayKey, daysBetween, isValidDayKey } from './dates'
import { addPayment } from './debts'
import { db } from './db'
import { docNumber, isLinked } from './folio'
import { actorId } from './team'
import { formatQuantity, roundQty } from './quantity'
import { createSale, lineTotal, type ItemInput } from './transactions'
import type { PaymentMethod, ProductVariant, Quote, QuoteItem, QuoteStatus, QuoterSnapshot, Transaction } from './types'

export type Discount = { type: 'percent' | 'amount'; value: number }

export type QuoteItemInput = {
  productId?: string
  /** Obligatorio si el producto tiene variantes. */
  variantId?: string
  /** Obligatorio si no hay productId (línea libre); si hay, se toma del producto. */
  name?: string
  /** Pieza por defecto; m² en un artículo por área. */
  unit?: string
  quantity: number
  unitPriceCents: number
  /** Porcentaje (0-100) o monto en centavos, que no puede superar el importe de la línea. */
  discount?: Discount
  /** Por área (m²): ancho × alto × piezas. Solo en artículos sin inventario; el precio es por m². */
  width?: number
  height?: number
}

export type QuoteInput = {
  title?: string
  contactId: string
  /** Última fecha de vigencia, 'YYYY-MM-DD'. */
  validUntil: string
  /** Porcentaje de IVA (16 = 16 %); 0 o falta = sin IVA. */
  taxRate?: number
  /** Anticipo que se pide, en centavos; no puede superar el total. */
  advanceCents?: number
  /** Fecha estimada de pago del resto, 'YYYY-MM-DD'. */
  payBy?: string
  notes?: string
  items: QuoteItemInput[]
  /** Datos del cotizador rápido, si la cotización salió de ahí. */
  quoter?: QuoterSnapshot
}

export const DEFAULT_UNIT = 'pieza'
export const AREA_UNIT = 'm²'
export const DEFAULT_VALIDITY_DAYS = 15
/** Una cotización pendiente con esta vigencia o menos se marca "por vencer". */
export const EXPIRING_DAYS = 3

const STORES = () => [db.quote, db.quoteItem, db.product, db.productVariant, db.contact]

type Priced = Pick<QuoteItem, 'quantity' | 'unitPriceCents'> & Partial<Pick<QuoteItem, 'width' | 'height' | 'discountType' | 'discountValue'>>

export const isAreaItem = (i: Pick<Priced, 'width' | 'height'>) => !!i.width && !!i.height

/** Lo que se cobra: piezas, o m² (ancho × alto × piezas) en un artículo por área. Se redondea a 3 decimales. */
export const billedQuantity = (i: Priced) => (isAreaItem(i) ? roundQty(i.width! * i.height! * i.quantity) : i.quantity)

export const quoteLineGross = (i: Priced) => lineTotal(billedQuantity(i), i.unitPriceCents)

/** Descuento de la línea en centavos (un solo redondeo; nunca más que el importe). */
export function quoteLineDiscount(i: Priced): number {
  if (!i.discountType || !i.discountValue) return 0
  const gross = quoteLineGross(i)
  const raw = i.discountType === 'percent' ? Math.round((gross * Math.round(i.discountValue * 100)) / 10000) : Math.round(i.discountValue)
  return Math.min(raw, gross)
}

export const quoteLineNet = (i: Priced) => quoteLineGross(i) - quoteLineDiscount(i)

/**
 * Importe, descuentos, subtotal, IVA y total. Cada línea se redondea una vez;
 * el IVA se redondea una sola vez sobre el subtotal (ya sin descuentos).
 */
export function quoteTotals(items: Priced[], taxRate: number) {
  const grossCents = items.reduce((sum, i) => sum + quoteLineGross(i), 0)
  const discountCents = items.reduce((sum, i) => sum + quoteLineDiscount(i), 0)
  const subtotalCents = grossCents - discountCents
  // en puntos base (16 % = 1600) para no arrastrar errores de coma flotante
  const taxCents = Math.round((subtotalCents * Math.round(taxRate * 100)) / 10000)
  return { grossCents, discountCents, subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}

const totalsFields = (t: ReturnType<typeof quoteTotals>) => ({ discountCents: t.discountCents, subtotalCents: t.subtotalCents, taxCents: t.taxCents, totalCents: t.totalCents })

type Line = Omit<QuoteItem, 'id' | 'quoteId'>

/** Medidas de un artículo por área: ambas o ninguna, positivas y solo sin inventario. */
function checkArea(it: QuoteItemInput): { width: number; height: number } | undefined {
  if (it.width === undefined && it.height === undefined) return undefined
  if (it.productId) throw new Error('El cálculo por área solo aplica a artículos sin inventario')
  const width = roundQty(it.width ?? 0)
  const height = roundQty(it.height ?? 0)
  if (!(width > 0) || !(height > 0)) throw new Error('Escribe el ancho y el alto en metros (mayores que cero)')
  return { width, height }
}

/** Valida el descuento y lo normaliza (sin descuento = nada guardado). */
function checkDiscount(it: QuoteItemInput, billedQty: number): Pick<Line, 'discountType' | 'discountValue'> | undefined {
  const d = it.discount
  if (!d || !d.value) return undefined
  if (!Number.isFinite(d.value) || d.value < 0) throw new Error('El descuento no es válido')
  if (d.type === 'percent') {
    if (d.value > 100) throw new Error('El descuento no puede pasar de 100 %')
    return { discountType: 'percent', discountValue: d.value }
  }
  if (d.type !== 'amount' || !Number.isInteger(d.value)) throw new Error('El descuento no es válido')
  if (d.value > lineTotal(billedQty, it.unitPriceCents)) throw new Error('El descuento no puede superar el importe del artículo')
  return { discountType: 'amount', discountValue: d.value }
}

async function buildLines(businessId: string, items: QuoteItemInput[], kept: QuoteItem[] = []): Promise<Line[]> {
  if (items.length === 0) throw new Error('Agrega al menos un artículo')
  const keptProducts = new Set(kept.map((i) => i.productId).filter(Boolean))
  const lines: Line[] = []
  for (const [position, it] of items.entries()) {
    const quantity = roundQty(it.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0) throw new Error('El precio no es válido')
    const area = checkArea(it)
    const unit = area ? AREA_UNIT : it.unit?.trim() || DEFAULT_UNIT
    const discount = checkDiscount(it, area ? roundQty(area.width * area.height * quantity) : quantity)
    if (it.productId) {
      const p = await db.product.get(it.productId)
      // Un producto archivado después de cotizar se puede seguir conservando al editar.
      if (!p || p.businessId !== businessId || (p.deletedAt && !keptProducts.has(p.id))) throw new Error('Uno de los productos ya no existe')
      let variant: ProductVariant | undefined
      if (it.variantId) {
        variant = await db.productVariant.get(it.variantId)
        const keptVariant = kept.some((k) => k.variantId === it.variantId)
        if (!variant || variant.productId !== p.id || (variant.deletedAt && !keptVariant)) throw new Error('Una de las variantes ya no existe')
      } else if (p.hasVariants) {
        throw new Error(`Elige la variante de "${p.name}"`)
      }
      lines.push({
        position, productId: p.id, ...(variant && { variantId: variant.id }), name: it.name?.trim() || (variant ? `${p.name} (${variant.name})` : p.name),
        unit, quantity, unitPriceCents: it.unitPriceCents, ...discount,
      })
    } else {
      const name = it.name?.trim()
      if (!name) throw new Error('Cada artículo necesita un nombre o un producto del inventario')
      lines.push({ position, name, unit, quantity, unitPriceCents: it.unitPriceCents, ...discount, ...area })
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

/** Anticipo (no mayor que el total) y fecha estimada de pago. */
function checkPayment(input: QuoteInput, totalCents: number) {
  const advanceCents = input.advanceCents ?? 0
  if (!Number.isInteger(advanceCents) || advanceCents < 0) throw new Error('El anticipo no es válido')
  if (advanceCents > totalCents) throw new Error('El anticipo no puede superar el total')
  const payBy = input.payBy?.trim() || undefined
  if (payBy && !isValidDayKey(payBy)) throw new Error('La fecha estimada de pago no es válida')
  return { advanceCents, payBy }
}

export async function createQuote(businessId: string, input: QuoteInput): Promise<Quote> {
  const pending = await isLinked(businessId)
  const by = await actorId(businessId)
  return db.transaction('rw', STORES(), async () => {
    const taxRate = await checkHeader(businessId, input)
    const lines = await buildLines(businessId, input.items)
    const totals = quoteTotals(lines, taxRate)
    const payment = checkPayment(input, totals.totalCents)
    const last = await db.quote.where('[businessId+number]').between([businessId, 0], [businessId, Number.MAX_SAFE_INTEGER]).last()
    const now = new Date().toISOString()
    const quote: Quote = {
      id: crypto.randomUUID(), businessId, number: (last?.number ?? 0) + 1, ...(pending && { numberPending: true }), ...(by && { createdBy: by }), title: input.title?.trim() ?? '', contactId: input.contactId,
      validUntil: input.validUntil, status: 'pending', taxRate, ...totalsFields(totals), ...payment, notes: input.notes?.trim() ?? '',
      ...(input.quoter && { quoter: input.quoter }), createdAt: now, updatedAt: now,
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
    const totals = quoteTotals(lines, taxRate)
    const next: Quote = {
      ...old, title: input.title?.trim() ?? '', contactId: input.contactId, validUntil: input.validUntil, taxRate,
      ...totalsFields(totals), ...checkPayment(input, totals.totalCents), notes: input.notes?.trim() ?? '', ...(input.quoter && { quoter: input.quoter }), updatedAt: new Date().toISOString(),
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
  const by = await actorId((await db.quote.get(id))?.businessId ?? '')
  return db.transaction('rw', [...STORES(), db.txn, db.txnItem, db.stockMovement, db.payment], async () => {
    const q = await liveQuote(id)
    if (q.status === 'converted') throw new Error('Ya se convirtió en venta')
    if (q.status === 'rejected') throw new Error('La cotización está rechazada: márcala como pendiente para convertirla')
    if (advance !== 0 && (!Number.isInteger(advance) || advance < 0)) throw new Error('El anticipo no es válido')
    if (advance > 0 && !opts.credit) throw new Error('Un anticipo solo aplica a una venta fiada')
    if (advance > q.totalCents) throw new Error('El anticipo no puede superar el total')

    // Una línea por área pasa a la venta con sus m² como cantidad; su descuento viaja como descuento de línea.
    const items: ItemInput[] = (await getQuoteItems(id)).map((i) => {
      const discountCents = quoteLineDiscount(i) || undefined
      if (!isAreaItem(i)) return { productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents, discountCents }
      const size = `${formatQuantity(i.quantity)} pza de ${formatQuantity(i.width!)} × ${formatQuantity(i.height!)} m`
      return { name: `${i.name} (${size})`, quantity: billedQuantity(i), unitPriceCents: i.unitPriceCents, discountCents }
    })
    // El IVA es dinero que se cobra pero no ganancia: su costo es igual a su precio.
    if (q.taxCents > 0) items.push({ name: `IVA ${q.taxRate}%`, quantity: 1, unitPriceCents: q.taxCents, unitCostCents: q.taxCents })
    const sale = await createSale(q.businessId, {
      items, concept: q.title ? `Cotización ${docNumber(q)} · ${q.title}` : `Cotización ${docNumber(q)}`, contactId: q.contactId,
      paymentMethod: opts.method, credit: opts.credit, dueDate: opts.dueDate, date: opts.date, createdBy: by,
    })
    if (sale.amountCents !== q.totalCents) throw new Error('El total de la venta no coincide con la cotización')
    if (advance > 0) await addPayment(q.contactId, advance, { method: opts.method, transactionId: sale.id, createdBy: by })
    const quote: Quote = { ...q, status: 'converted', transactionId: sale.id, updatedAt: new Date().toISOString() }
    await db.quote.put(quote)
    return { sale, quote }
  })
}

// ——— Limpieza automática ———

/** Las cotizaciones que no se concretan se borran solas a los 30 días; 5 días antes sale el aviso. */
export const AUTO_DELETE_DAYS = 30
export const WARN_DAYS = 5
/** Las cotizaciones que ya existían cuando llegó esta función tienen al menos su aviso de 5 días antes de borrarse. */
const FEATURE_START = '2026-11-27'

/** Solo se borran las que nunca se concretaron: pendientes o rechazadas, que no son obra ni venta. */
export const autoDeletable = (q: Pick<Quote, 'status' | 'job' | 'transactionId' | 'deletedAt'>) => !q.deletedAt && (q.status === 'pending' || q.status === 'rejected') && !q.job && !q.transactionId

/** El día en que se borra ('YYYY-MM-DD'). */
export function deleteOn(q: Pick<Quote, 'createdAt' | 'keepUntil'>, timeZone: string): string {
  if (q.keepUntil) return q.keepUntil
  const base = addDays(dayKey(q.createdAt, timeZone), AUTO_DELETE_DAYS)
  const floor = addDays(FEATURE_START, WARN_DAYS + 1)
  return base < floor ? floor : base
}

/** Cuántos días le quedan (0 = se borra hoy). */
export const daysToDelete = (q: Pick<Quote, 'createdAt' | 'keepUntil'>, today: string, timeZone: string) => daysBetween(today, deleteOn(q, timeZone))

/** Las que se borran en los próximos 5 días, de la más próxima a la más lejana. */
export function deletingSoon(quotes: Quote[], today: string, timeZone: string): Quote[] {
  return quotes.filter((q) => autoDeletable(q) && daysToDelete(q, today, timeZone) <= WARN_DAYS).sort((a, b) => deleteOn(a, timeZone).localeCompare(deleteOn(b, timeZone)))
}

/** Conservar otros 30 días (desde el día en que se iba a borrar, o desde hoy si ya pasó). */
export async function keepQuote(id: string, today: string, timeZone: string): Promise<void> {
  const q = await liveQuote(id)
  const from = deleteOn(q, timeZone)
  await db.quote.update(id, { keepUntil: addDays(from > today ? from : today, AUTO_DELETE_DAYS), updatedAt: new Date().toISOString() })
}

/** Borra (borrado lógico) las que ya llegaron a su día. Devuelve cuántas borró. */
export async function purgeStaleQuotes(businessId: string, today: string, timeZone: string): Promise<number> {
  const due = (await listQuotes(businessId)).filter((q) => autoDeletable(q) && deleteOn(q, timeZone) <= today)
  const now = new Date().toISOString()
  for (const q of due) await db.quote.update(q.id, { deletedAt: now, updatedAt: now })
  return due.length
}
