import { formatDay } from './dates'
import { formatMoney } from './money'
import { buildPdf, layoutLine, twoColumns, wrapText, type PdfLine } from './pdf'
import { formatQuantity } from './quantity'
import { lineTotal } from './transactions'
import type { Business, Contact, Quote, QuoteItem } from './types'

/** Ancho del documento de cotización (más ancho que el ticket del comprobante, para la tabla de artículos). */
export const QUOTE_COLS = 80
const NAME_W = 38
const QTY_W = 12
const PRICE_W = 13
const TOTAL_W = 13

export type QuoteDoc = {
  businessName: string
  businessPhone: string
  businessAddress: string
  number: number
  title: string
  dateLabel: string
  validLabel: string
  customer: string
  lines: { name: string; unit: string; quantity: number; unitPriceCents: number; totalCents: number }[]
  subtotalCents: number
  taxRate: number
  taxCents: number
  totalCents: number
  notes: string
  currency: string
}

export function buildQuoteDoc(input: { business: Business; quote: Quote; items: QuoteItem[]; contact?: Contact }): QuoteDoc {
  const { business, quote, items, contact } = input
  return {
    businessName: business.name,
    businessPhone: business.phone,
    businessAddress: business.address,
    number: quote.number,
    title: quote.title,
    dateLabel: new Date(quote.createdAt).toLocaleDateString('es-MX', { timeZone: business.timezone, dateStyle: 'medium' }),
    validLabel: formatDay(quote.validUntil),
    customer: contact?.name ?? '',
    lines: items.map((i) => ({ name: i.name, unit: i.unit, quantity: i.quantity, unitPriceCents: i.unitPriceCents, totalCents: lineTotal(i.quantity, i.unitPriceCents) })),
    subtotalCents: quote.subtotalCents,
    taxRate: quote.taxRate,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    notes: quote.notes,
    currency: business.currency,
  }
}

const heading = (d: QuoteDoc) => `Cotización #${d.number}${d.title ? ` · ${d.title}` : ''}`

/** Texto para WhatsApp (el asterisco pone negritas allí). */
export function quoteText(d: QuoteDoc): string {
  const money = (c: number) => formatMoney(c, d.currency)
  const out = [`*${d.businessName}*`, `*${heading(d)}*`, `Fecha: ${d.dateLabel} · Vigencia hasta el ${d.validLabel}`]
  if (d.customer) out.push(`Para: ${d.customer}`)
  out.push('')
  for (const l of d.lines) out.push(`${formatQuantity(l.quantity)} × ${l.name} (${money(l.unitPriceCents)} c/${l.unit}) — ${money(l.totalCents)}`)
  if (d.taxCents > 0) out.push('', `Subtotal: ${money(d.subtotalCents)}`, `IVA ${d.taxRate}%: ${money(d.taxCents)}`)
  else out.push('')
  out.push(`*Total: ${money(d.totalCents)}*`)
  if (d.notes) out.push('', d.notes)
  out.push('', `Esta cotización es válida hasta el ${d.validLabel}.`)
  return out.join('\n')
}

const SEP: PdfLine = { text: '-'.repeat(QUOTE_COLS) }

function row(name: string, qty: string, price: string, total: string): string {
  return name.padEnd(NAME_W) + ' ' + qty.padStart(QTY_W) + ' ' + price.padStart(PRICE_W) + ' ' + total.padStart(TOTAL_W)
}

/** El documento como líneas monoespaciadas; sirven para el PDF y para la vista previa. */
export function quoteLines(d: QuoteDoc): PdfLine[] {
  const money = (c: number) => formatMoney(c, d.currency)
  const wrap = (text: string, extra: Partial<PdfLine> = {}) => wrapText(text, QUOTE_COLS).map((t): PdfLine => ({ text: t, ...extra }))
  const lines: PdfLine[] = [...wrap(d.businessName, { bold: true })]
  if (d.businessPhone) lines.push(...wrap(`Tel. ${d.businessPhone}`))
  if (d.businessAddress) lines.push(...wrap(d.businessAddress))
  lines.push(SEP, ...wrap(`COTIZACIÓN #${d.number}${d.title ? ` · ${d.title}` : ''}`, { bold: true }), { text: twoColumns(`Fecha: ${d.dateLabel}`, `Vigencia hasta el ${d.validLabel}`, QUOTE_COLS) })
  if (d.customer) lines.push(...wrap(`Para: ${d.customer}`))
  lines.push(SEP, { text: row('Descripción', 'Cantidad', 'Precio', 'Importe'), bold: true }, SEP)
  for (const l of d.lines) {
    const [first, ...rest] = wrapText(l.name, NAME_W)
    const qty = `${formatQuantity(l.quantity)} ${l.unit}`.slice(0, QTY_W)
    lines.push({ text: row(first, qty, money(l.unitPriceCents), money(l.totalCents)) }, ...rest.map((t): PdfLine => ({ text: t })))
  }
  lines.push(SEP)
  if (d.taxCents > 0) lines.push({ text: twoColumns('Subtotal', money(d.subtotalCents), QUOTE_COLS) }, { text: twoColumns(`IVA ${d.taxRate}%`, money(d.taxCents), QUOTE_COLS) })
  lines.push({ text: twoColumns('TOTAL', money(d.totalCents), QUOTE_COLS), bold: true })
  if (d.notes) lines.push(SEP, { text: 'Notas', bold: true }, ...wrap(d.notes))
  lines.push(SEP, ...wrap(`Esta cotización es válida hasta el ${d.validLabel}.`, { align: 'center' }), { text: 'Gracias por tu preferencia.', align: 'center' })
  return lines
}

export const quotePdf = (d: QuoteDoc): Uint8Array => buildPdf(quoteLines(d), QUOTE_COLS)
export const quotePreview = (d: QuoteDoc) => quoteLines(d).map((l) => ({ text: layoutLine(l, QUOTE_COLS), bold: !!l.bold }))
export const quoteFileName = (d: QuoteDoc) => `cotizacion-${String(d.number).padStart(4, '0')}.pdf`
