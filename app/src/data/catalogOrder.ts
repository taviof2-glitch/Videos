import type { CatalogData, CatalogProduct, CatalogVariant } from './catalogFormat'
import { formatMoney } from './money'
import { buildOrderMessage, encodeOrderCode } from './orderCode'
import { lineTotal } from './transactions'
import { whatsappNumber } from './reminder'

/** Lo que el cliente va agregando en el catálogo. */
export type CartLine = { productId: string; variantId?: string; quantity: number }

export type PricedLine = { product: CatalogProduct; variant?: CatalogVariant; quantity: number; unitPriceCents: number; totalCents: number; name: string }

export const cartKey = (productId: string, variantId?: string) => `${productId}|${variantId ?? ''}`

/** Une el carrito con el catálogo (nombres y precios). Lo que ya no está en el catálogo o está agotado se deja fuera. */
export function priceCart(data: CatalogData, cart: CartLine[]): PricedLine[] {
  const out: PricedLine[] = []
  for (const l of cart) {
    const product = data.products.find((p) => p.id === l.productId)
    if (!product || !(l.quantity > 0)) continue
    const variant = l.variantId ? product.variants?.find((v) => v.id === l.variantId) : undefined
    if (product.variants?.length && !variant) continue
    if (l.variantId && !variant) continue
    if (product.soldOut || variant?.soldOut) continue
    const unitPriceCents = variant ? variant.priceCents : product.priceCents
    out.push({ product, variant, quantity: l.quantity, unitPriceCents, totalCents: lineTotal(l.quantity, unitPriceCents), name: variant ? `${product.name} (${variant.name})` : product.name })
  }
  return out
}

export const cartTotal = (lines: PricedLine[]) => lines.reduce((sum, l) => sum + l.totalCents, 0)

/** El mensaje de WhatsApp del pedido, con el código que Conta lee para armar el pedido sin teclear. */
export function orderMessage(data: CatalogData, cart: CartLine[], customer: string, notes: string): { text: string; totalCents: number; count: number } {
  const lines = priceCart(data, cart)
  const code = encodeOrderCode({
    n: customer.trim(), m: notes.trim(),
    i: lines.map((l) => ({ p: l.product.id, ...(l.variant && { v: l.variant.id }), q: l.quantity, c: l.unitPriceCents })),
  })
  const totalCents = cartTotal(lines)
  const text = buildOrderMessage({
    businessName: data.business.name, lines: lines.map((l) => ({ quantity: l.quantity, name: l.name, totalCents: l.totalCents })), totalCents,
    customer, notes, code, money: (c) => formatMoney(c, data.business.currency),
  })
  return { text, totalCents, count: lines.length }
}

/** Enlace que abre WhatsApp con el pedido listo para enviar al negocio, o undefined si el negocio no tiene teléfono. */
export function orderLink(data: CatalogData, text: string): string | undefined {
  const number = whatsappNumber(data.business.phone, data.business.country)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : undefined
}
