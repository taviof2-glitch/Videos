import { matchesSearch, unitCost, unitPrice, type ProductWithVariants } from '../data/products'
import type { ProductVariant } from '../data/types'

/** Lo que se puede agregar a una venta, compra o cotización: un producto, o cada variante de un producto con variantes. */
export type ProductOption = {
  key: string
  productId: string
  variantId?: string
  /** Nombre como queda en la línea: "Librero (Nogal / Grande)". */
  name: string
  /** Texto del buscador: "Librero · Nogal / Grande". */
  label: string
  priceCents: number
  costCents: number
  stock: number
  /** Sobre pedido: no tiene caso avisar de existencias. */
  madeToOrder?: boolean
}

export const optionKey = (productId: string, variantId?: string) => `${productId}|${variantId ?? ''}`

export function toOption(p: ProductWithVariants, v?: ProductVariant): ProductOption {
  return {
    key: optionKey(p.id, v?.id),
    productId: p.id,
    variantId: v?.id,
    name: v ? `${p.name} (${v.name})` : p.name,
    label: v ? `${p.name} · ${v.name}` : p.name,
    priceCents: unitPrice(p, v),
    costCents: unitCost(p, v),
    stock: v ? v.stock : p.stock,
    ...(p.madeToOrder && { madeToOrder: true }),
  }
}

/**
 * Una opción por producto simple y una por cada variante. Con `search`, solo las variantes que coinciden
 * (por palabras o por código de barras); un producto que coincide por su nombre muestra todas sus variantes.
 */
export function productOptions(products: ProductWithVariants[], search = ''): ProductOption[] {
  const q = search.trim()
  return products.flatMap((p) => {
    if (!p.hasVariants) return [toOption(p)]
    const all = p.variants ?? []
    if (!q || p.barcode === q) return all.map((v) => toOption(p, v))
    const hits = all.filter((v) => v.barcode === q || matchesSearch(`${p.name} ${v.name}`, q))
    return (hits.length ? hits : all).map((v) => toOption(p, v))
  })
}
