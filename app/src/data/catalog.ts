import { listCategories } from './categories'
import { listProducts, stockStatus, unitPrice, type ProductWithVariants } from './products'
import { shortId, type CatalogData, type CatalogProduct } from './catalogFormat'
import type { Business } from './types'

export * from './catalogFormat'

export type PhotoToUri = (photo: Blob) => Promise<string | undefined>

export async function buildCatalog(business: Business, photoToUri: PhotoToUri, now = new Date()): Promise<CatalogData> {
  const [products, categories] = await Promise.all([listProducts(business.id), listCategories(business.id, 'product')])
  const visible = products.filter((p) => p.visibleInCatalog)
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const items: CatalogProduct[] = []
  for (const p of visible) items.push(await toCatalogProduct(p, catName.get(p.categoryId ?? '') ?? '', photoToUri))
  const used = new Set(items.map((i) => i.category).filter(Boolean))
  return {
    v: 1,
    generatedAt: now.toISOString(),
    business: { name: business.name, phone: business.phone, country: business.country, address: business.address, openingHours: business.openingHours, currency: business.currency, note: business.catalogNote ?? '' },
    categories: categories.map((c) => c.name).filter((n) => used.has(n)),
    products: items,
  }
}

async function toCatalogProduct(p: ProductWithVariants, category: string, photoToUri: PhotoToUri): Promise<CatalogProduct> {
  const variants = p.hasVariants ? (p.variants ?? []).map((v) => ({ id: shortId(v.id), name: v.name, priceCents: unitPrice(p, v), soldOut: !p.madeToOrder && v.stock <= 0 })) : undefined
  return {
    id: shortId(p.id),
    name: p.name,
    description: p.description ?? '',
    category,
    priceCents: p.priceCents,
    ...(p.photos[0] && { photo: await photoToUri(p.photos[0]) }),
    soldOut: stockStatus(p) === 'out',
    ...(variants && { variants }),
  }
}

