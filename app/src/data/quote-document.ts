import { formatDay } from './dates'
import { docNumber } from './folio'
import { formatMoney } from './money'
import { buildPdf, layoutLine, LETTER_PAPER, twoColumns, wrapText, type PdfImage, type PdfLine } from './pdf'
import { formatQuantity } from './quantity'
import { billedQuantity, isAreaItem, quoteLineDiscount, quoteLineGross } from './quotes'
import type { Business, Contact, Quote, QuoteItem } from './types'

/** Columnas del documento de cotización en hoja carta (80 columnas a 11 pt llenan el ancho útil). */
export const QUOTE_COLS = 80
const NAME_W = 38
const QTY_W = 12
const PRICE_W = 13
const TOTAL_W = 14

export type QuoteDoc = {
  businessName: string
  businessPhone: string
  businessAddress: string
  number: number
  /** «#8» o, mientras el servidor no asigna el número, «P-3F9A2C». */
  numberLabel: string
  title: string
  dateLabel: string
  validLabel: string
  customer: string
  lines: {
    name: string
    unit: string
    /** Lo que se cobra: piezas o m². */
    quantity: number
    unitPriceCents: number
    grossCents: number
    discountCents: number
    /** "10%" si el descuento fue en porcentaje. */
    discountLabel: string
    /** Medidas de un artículo por área, p. ej. "3 pza de 0.9 × 2 m". */
    detail: string
  }[]
  grossCents: number
  discountCents: number
  subtotalCents: number
  taxRate: number
  taxCents: number
  totalCents: number
  advanceCents: number
  payByLabel: string
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
    numberLabel: docNumber(quote),
    title: quote.title,
    dateLabel: new Date(quote.createdAt).toLocaleDateString('es-MX', { timeZone: business.timezone, dateStyle: 'medium' }),
    validLabel: formatDay(quote.validUntil),
    customer: contact?.name ?? '',
    lines: items.map((i) => ({
      name: i.name,
      unit: i.unit,
      quantity: billedQuantity(i),
      unitPriceCents: i.unitPriceCents,
      grossCents: quoteLineGross(i),
      discountCents: quoteLineDiscount(i),
      discountLabel: i.discountType === 'percent' ? `${i.discountValue}%` : '',
      detail: isAreaItem(i) ? `${formatQuantity(i.quantity)} pza de ${formatQuantity(i.width!)} × ${formatQuantity(i.height!)} m` : '',
    })),
    grossCents: quote.subtotalCents + (quote.discountCents ?? 0),
    discountCents: quote.discountCents ?? 0,
    subtotalCents: quote.subtotalCents,
    taxRate: quote.taxRate,
    taxCents: quote.taxCents,
    totalCents: quote.totalCents,
    advanceCents: quote.advanceCents ?? 0,
    payByLabel: quote.payBy ? formatDay(quote.payBy) : '',
    notes: quote.notes,
    currency: business.currency,
  }
}

const heading = (d: QuoteDoc) => `Cotización ${d.numberLabel}${d.title ? ` · ${d.title}` : ''}`

/** Texto para WhatsApp (el asterisco pone negritas allí). */
export function quoteText(d: QuoteDoc): string {
  const money = (c: number) => formatMoney(c, d.currency)
  const out = [`*${d.businessName}*`, `*${heading(d)}*`, `Fecha: ${d.dateLabel} · Vigencia hasta el ${d.validLabel}`]
  if (d.customer) out.push(`Para: ${d.customer}`)
  out.push('')
  for (const l of d.lines) {
    out.push(`${formatQuantity(l.quantity)} × ${l.name}${l.detail ? ` [${l.detail}]` : ''} (${money(l.unitPriceCents)} c/${l.unit}) — ${money(l.grossCents)}`)
    if (l.discountCents) out.push(`   Descuento${l.discountLabel ? ` ${l.discountLabel}` : ''}: -${money(l.discountCents)}`)
  }
  out.push('')
  if (d.discountCents > 0) out.push(`Importe: ${money(d.grossCents)}`, `Descuentos: -${money(d.discountCents)}`)
  if (d.taxCents > 0) out.push(`Subtotal: ${money(d.subtotalCents)}`, `IVA ${d.taxRate}%: ${money(d.taxCents)}`)
  out.push(`*Total: ${money(d.totalCents)}*`)
  if (d.advanceCents > 0) out.push(`Anticipo: ${money(d.advanceCents)}`, `Saldo: ${money(d.totalCents - d.advanceCents)}`)
  if (d.payByLabel) out.push(`Fecha estimada de pago: ${d.payByLabel}`)
  if (d.notes) out.push('', d.notes)
  out.push('', `Esta cotización es válida hasta el ${d.validLabel}.`)
  return out.join('\n')
}

const SEP: PdfLine = { text: '-'.repeat(QUOTE_COLS) }

function row(name: string, qty: string, price: string, total: string): string {
  return name.padEnd(NAME_W) + ' ' + qty.padStart(QTY_W) + ' ' + price.padStart(PRICE_W) + ' ' + total.padStart(TOTAL_W)
}

/** El documento como líneas monoespaciadas; sirven para el PDF y para la vista previa. */
/** Parte del nombre del archivo: «0008» o «P-3F9A2C». */
const fileNumber = (d: QuoteDoc) => (d.numberLabel.startsWith('#') ? String(d.number).padStart(4, '0') : d.numberLabel)

export function quoteLines(d: QuoteDoc): PdfLine[] {
  const money = (c: number) => formatMoney(c, d.currency)
  const wrap = (text: string, extra: Partial<PdfLine> = {}) => wrapText(text, QUOTE_COLS).map((t): PdfLine => ({ text: t, ...extra }))
  const lines: PdfLine[] = [...wrap(d.businessName, { bold: true })]
  if (d.businessPhone) lines.push(...wrap(`Tel. ${d.businessPhone}`))
  if (d.businessAddress) lines.push(...wrap(d.businessAddress))
  lines.push(SEP, ...wrap(`COTIZACIÓN ${d.numberLabel}${d.title ? ` · ${d.title}` : ''}`, { bold: true }), { text: twoColumns(`Fecha: ${d.dateLabel}`, `Vigencia hasta el ${d.validLabel}`, QUOTE_COLS) })
  if (d.customer) lines.push(...wrap(`Para: ${d.customer}`))
  lines.push(SEP, { text: row('Descripción', 'Cantidad', 'Precio', 'Importe'), bold: true }, SEP)
  for (const l of d.lines) {
    const [first, ...rest] = wrapText(l.name, NAME_W)
    const qty = `${formatQuantity(l.quantity)} ${l.unit}`.slice(0, QTY_W)
    lines.push({ text: row(first, qty, money(l.unitPriceCents), money(l.grossCents)) }, ...rest.map((t): PdfLine => ({ text: t })))
    if (l.detail) lines.push(...wrapText(l.detail, NAME_W - 2).map((t): PdfLine => ({ text: `  ${t}` })))
    if (l.discountCents) lines.push({ text: twoColumns(`  Descuento${l.discountLabel ? ` ${l.discountLabel}` : ''}`, `-${money(l.discountCents)}`, QUOTE_COLS) })
  }
  lines.push(SEP)
  if (d.discountCents > 0) lines.push({ text: twoColumns('Importe', money(d.grossCents), QUOTE_COLS) }, { text: twoColumns('Descuentos', `-${money(d.discountCents)}`, QUOTE_COLS) })
  if (d.taxCents > 0) lines.push({ text: twoColumns('Subtotal', money(d.subtotalCents), QUOTE_COLS) }, { text: twoColumns(`IVA ${d.taxRate}%`, money(d.taxCents), QUOTE_COLS) })
  lines.push({ text: twoColumns('TOTAL', money(d.totalCents), QUOTE_COLS), bold: true })
  if (d.advanceCents > 0) lines.push({ text: twoColumns('Anticipo', money(d.advanceCents), QUOTE_COLS) }, { text: twoColumns('Saldo', money(d.totalCents - d.advanceCents), QUOTE_COLS), bold: true })
  if (d.payByLabel) lines.push(...wrap(`Fecha estimada de pago: ${d.payByLabel}`))
  if (d.notes) lines.push(SEP, { text: 'Notas', bold: true }, ...wrap(d.notes))
  lines.push(SEP, ...wrap(`Esta cotización es válida hasta el ${d.validLabel}.`, { align: 'center' }), { text: 'Gracias por tu preferencia.', align: 'center' })
  return lines
}

/** PDF en hoja carta, con páginas numeradas si la cotización es larga. */
export const quotePdf = (d: QuoteDoc, logo?: PdfImage): Uint8Array => buildPdf(quoteLines(d), QUOTE_COLS, LETTER_PAPER, logo)
export const quotePreview = (d: QuoteDoc) => quoteLines(d).map((l) => ({ text: layoutLine(l, QUOTE_COLS), bold: !!l.bold }))
export const quoteFileName = (d: QuoteDoc) => `cotizacion-${fileNumber(d)}.pdf`
export const quoteImageName = (d: QuoteDoc) => `cotizacion-${fileNumber(d)}.png`
