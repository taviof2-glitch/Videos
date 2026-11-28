import { formatDay } from './dates'
import { payLines } from './payinfo'
import { formatMoney } from './money'
import { METHOD_LABEL } from './methods'
import { buildPdf, layoutLine, twoColumns, wrapText, TICKET_COLS, TICKET_PAPER, type PdfImage, type PdfLine } from './pdf'
import { formatQuantity } from './quantity'
import { lineNet } from './transactions'
import type { Business, Contact, Transaction, TransactionItem } from './types'

export type Receipt = {
  businessName: string
  /** Datos para pagar el saldo (si queda saldo). */
  pay: string[]
  businessPhone: string
  businessAddress: string
  /** Código corto de la venta (no hay numeración consecutiva: cada dispositivo vende sin internet). */
  folio: string
  dateLabel: string
  customer?: string
  concept: string
  lines: { quantity: number; name: string; unitPriceCents: number; discountCents: number; totalCents: number }[]
  totalCents: number
  payment: string
  credit?: { paidCents: number; remainingCents: number; dueLabel?: string }
  currency: string
}

export function buildReceipt(input: {
  business: Business
  sale: Transaction
  items: TransactionItem[]
  contact?: Contact
  /** Lo abonado hasta ahora, si la venta es fiada. */
  paidCents?: number
}): Receipt {
  const { business, sale, items, contact } = input
  const paid = input.paidCents ?? 0
  return {
    businessName: business.name,
    pay: payLines(business),
    businessPhone: business.phone,
    businessAddress: business.address,
    folio: sale.id.slice(0, 8).toUpperCase(),
    dateLabel: new Date(sale.date).toLocaleString('es-MX', { timeZone: business.timezone, dateStyle: 'medium', timeStyle: 'short' }),
    customer: contact?.name,
    concept: items.length ? '' : sale.concept,
    lines: items.map((i) => ({ quantity: i.quantity, name: i.name, unitPriceCents: i.unitPriceCents, discountCents: i.discountCents ?? 0, totalCents: lineNet(i) })),
    totalCents: sale.amountCents,
    // Al cliente nunca se le dice «fiado»: es un anticipo para empezar y se liquida al entregar.
    payment: sale.status === 'credit' ? (paid > 0 ? 'Anticipo recibido' : 'Pendiente de pago') : METHOD_LABEL[sale.paymentMethod],
    credit: sale.status === 'credit'
      ? { paidCents: paid, remainingCents: sale.amountCents - paid, dueLabel: sale.dueDate ? formatDay(sale.dueDate) : undefined }
      : undefined,
    currency: business.currency,
  }
}

/** Texto para WhatsApp (el asterisco pone negritas allí). */
export function receiptText(r: Receipt): string {
  const money = (c: number) => formatMoney(c, r.currency)
  const out = [`*${r.businessName}*`, `Comprobante de venta · ${r.dateLabel}`, `Folio: ${r.folio}`]
  if (r.customer) out.push(`Cliente: ${r.customer}`)
  out.push('')
  if (r.lines.length) for (const l of r.lines) out.push(`${formatQuantity(l.quantity)} × ${l.name} — ${money(l.totalCents)}${l.discountCents ? ` (con descuento de ${money(l.discountCents)})` : ''}`)
  else if (r.concept) out.push(r.concept)
  out.push(`*Total: ${money(r.totalCents)}*`)
  if (r.credit) {
    out.push(`Pago: ${r.payment.toLowerCase()}`)
    if (r.credit.paidCents > 0) out.push(`Anticipo: ${money(r.credit.paidCents)}`)
    out.push(`Saldo pendiente: ${money(r.credit.remainingCents)}`)
    if (r.credit.dueLabel) out.push(`Fecha de liquidación: ${r.credit.dueLabel}`)
  } else out.push(`Pago: ${r.payment}`)
  if (r.credit && r.credit.remainingCents > 0 && r.pay.length) out.push('', ...r.pay)
  out.push('', '¡Gracias por tu compra!')
  return out.join('\n')
}

const SEP: PdfLine = { text: '-'.repeat(TICKET_COLS) }

/** El comprobante como líneas de ticket; sirven para el PDF y para la vista previa. */
export function receiptLines(r: Receipt, cols = TICKET_COLS): PdfLine[] {
  const money = (c: number) => formatMoney(c, r.currency)
  const wrap = (text: string, extra: Partial<PdfLine> = {}) => wrapText(text, cols).map((t): PdfLine => ({ text: t, ...extra }))
  const lines: PdfLine[] = [...wrap(r.businessName, { align: 'center', bold: true })]
  if (r.businessPhone) lines.push(...wrap(`Tel. ${r.businessPhone}`, { align: 'center' }))
  if (r.businessAddress) lines.push(...wrap(r.businessAddress, { align: 'center' }))
  lines.push(SEP, { text: 'COMPROBANTE DE VENTA', align: 'center', bold: true }, { text: `Folio: ${r.folio}` }, ...wrap(`Fecha: ${r.dateLabel}`))
  if (r.customer) lines.push(...wrap(`Cliente: ${r.customer}`))
  lines.push(SEP)
  if (r.lines.length) {
    for (const l of r.lines) {
      lines.push(...wrap(l.name))
      lines.push({ text: twoColumns(`  ${formatQuantity(l.quantity)} x ${money(l.unitPriceCents)}`, money(l.totalCents + l.discountCents), cols) })
      if (l.discountCents) lines.push({ text: twoColumns('  Descuento', `-${money(l.discountCents)}`, cols) })
    }
  } else {
    lines.push(...wrap(r.concept || 'Venta'))
  }
  lines.push(SEP, { text: twoColumns('TOTAL', money(r.totalCents), cols), bold: true })
  if (r.credit) {
    lines.push({ text: `Pago: ${r.payment}` })
    if (r.credit.paidCents > 0) lines.push({ text: twoColumns('Anticipo', money(r.credit.paidCents), cols) })
    lines.push({ text: twoColumns('Saldo pendiente', money(r.credit.remainingCents), cols), bold: true })
    if (r.credit.dueLabel) lines.push(...wrap(`Fecha de liquidación: ${r.credit.dueLabel}`))
  } else lines.push({ text: `Pago: ${r.payment}` })
  lines.push(SEP, { text: '¡Gracias por tu compra!', align: 'center' })
  return lines
}

export const receiptPdf = (r: Receipt, logo?: PdfImage): Uint8Array => buildPdf(receiptLines(r), TICKET_COLS, TICKET_PAPER, logo)
export const receiptPreview = (r: Receipt) => receiptLines(r).map((l) => ({ text: layoutLine(l), bold: !!l.bold }))
export const receiptFileName = (r: Receipt) => `comprobante-${r.folio}.pdf`
export const receiptImageName = (r: Receipt) => `comprobante-${r.folio}.png`

