// Cotización con opciones (Básica, Media, Premium) y enlace para que el cliente la vea y la acepte.
import { db } from './db'
import { newTrackToken } from './jobs'
import { getQuoteItems, updateQuote, type QuoteItemInput } from './quotes'
import type { Quote, QuoteOption } from './types'

const OPTION_PREFIX = 'Opción '

/** Opciones sugeridas a partir del total: la básica es la cotización como está. */
export function defaultOptions(totalCents: number): QuoteOption[] {
  const round = (c: number) => Math.round(c / 10000) * 10000
  return [
    { name: 'Básica', priceCents: totalCents, desc: 'Melamina estándar y bisagras normales' },
    { name: 'Media', priceCents: round(totalCents * 1.15), desc: 'Bisagras y correderas de cierre suave' },
    { name: 'Premium', priceCents: round(totalCents * 1.35), desc: 'Cierre suave, jaladeras ocultas (gola) e iluminación LED' },
  ]
}

export async function saveOptions(quoteId: string, options: QuoteOption[] | undefined): Promise<void> {
  const clean = (options ?? []).filter((o) => o.name.trim() && o.priceCents > 0).slice(0, 4).map((o) => ({ name: o.name.trim(), priceCents: Math.round(o.priceCents), desc: o.desc.trim() }))
  await db.quote.update(quoteId, { options: clean.length ? clean : undefined, updatedAt: new Date().toISOString() })
}

/**
 * El cliente eligió una opción: se anota y la diferencia contra la cotización se agrega como una línea
 * («Opción Media: …»), así el total, el anticipo y la venta salen con el precio de esa opción.
 */
export async function chooseOption(quoteId: string, index: number): Promise<Quote> {
  const q = await db.quote.get(quoteId)
  if (!q || q.deletedAt) throw new Error('La cotización ya no existe')
  const opt = q.options?.[index]
  if (!opt) throw new Error('Esa opción no existe')
  const items = (await getQuoteItems(quoteId)).filter((i) => !i.name.startsWith(OPTION_PREFIX))
  const input: QuoteItemInput[] = items.map((i) => ({
    productId: i.productId, variantId: i.variantId, name: i.name, unit: i.unit, quantity: i.quantity, unitPriceCents: i.unitPriceCents,
    ...(i.discountType && i.discountValue ? { discount: { type: i.discountType, value: i.discountValue } } : {}),
    ...(i.width && i.height ? { width: i.width, height: i.height } : {}),
  }))
  // Total sin la línea de opción que hubiera antes.
  const base = q.options?.[0]?.priceCents ?? q.totalCents
  const diff = opt.priceCents - base
  const rate = q.taxRate ? 1 + q.taxRate / 100 : 1
  if (diff > 0) input.push({ name: `${OPTION_PREFIX}${opt.name}${opt.desc ? `: ${opt.desc}` : ''}`, quantity: 1, unitPriceCents: Math.round(diff / rate) })
  const next = await updateQuote(quoteId, { title: q.title, contactId: q.contactId, validUntil: q.validUntil, taxRate: q.taxRate, advanceCents: q.advanceCents ? Math.round((q.advanceCents * opt.priceCents) / Math.max(1, q.totalCents)) : 0, payBy: q.payBy, notes: q.notes, items: input, quoter: q.quoter })
  await db.quote.update(quoteId, { chosenOption: index, optionApplied: true })
  return next
}

export async function ensureShareToken(quote: Quote): Promise<string> {
  if (quote.shareToken) return quote.shareToken
  const token = newTrackToken()
  await db.quote.update(quote.id, { shareToken: token, updatedAt: new Date().toISOString() })
  return token
}

export const quoteLink = (token: string, origin = location.origin) => `${origin}/c/${token}`
