import type { Business } from './types'

/**
 * Foto del catálogo: lo que se publica en la página pública. Los visitantes no pueden leer los datos de Conta
 * (viven en tu navegador), así que el catálogo es una copia de los productos visibles tal como están hoy.
 * Solo lleva lo que un cliente puede ver: nombre, descripción, precio, foto y si está agotado (nunca el stock ni el costo).
 */
export type CatalogVariant = { id: string; name: string; priceCents: number; soldOut: boolean }
export type CatalogProduct = {
  /** Primeros 8 caracteres del id: bastan para identificarlo dentro de un negocio y mantienen corto el código del pedido. */
  id: string
  name: string
  description: string
  category: string
  priceCents: number
  /** Foto reducida como data URI (JPEG). */
  photo?: string
  /** Catálogo en vivo: ruta de la foto en Storage (la página la baja aparte). */
  photoPath?: string
  soldOut: boolean
  variants?: CatalogVariant[]
}
export type CatalogData = {
  v: 1
  generatedAt: string
  business: { name: string; phone: string; country: string; address: string; openingHours: string; currency: string; note: string }
  categories: string[]
  products: CatalogProduct[]
}


/** Qué le falta al negocio para que el catálogo sirva para recibir pedidos. */
export function catalogIssues(business: Pick<Business, 'phone'>, visibleCount: number): string[] {
  const issues: string[] = []
  if (visibleCount === 0) issues.push('Marca al menos un producto para mostrarlo en el catálogo.')
  if (!business.phone.replace(/\D/g, '')) issues.push('Falta el teléfono de WhatsApp del negocio: sin él, los clientes no pueden mandarte el pedido.')
  return issues
}

export const catalogFileName = (business: Pick<Business, 'name'>, now = new Date()) =>
  `catalogo-${business.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'conta'}-${now.toISOString().slice(0, 10)}.json`

export const shortId = (id: string) => id.slice(0, 8)

const ID = /^[A-Za-z0-9-]{1,16}$/
const JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/
const PHOTO_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f]{16}\.jpg$/
const MAX_PHOTO_CHARS = 250_000
const MAX_PRODUCTS = 500

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const cents = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1_000_000_000 ? v : undefined)

export type ParsedCatalog = { ok: true; data: CatalogData } | { ok: false; error: string }

/**
 * Lee un archivo de catálogo y lo limpia: la página pública lo muestra a cualquiera, así que solo se aceptan textos
 * acotados, precios enteros e imágenes JPEG; cualquier otra cosa se descarta.
 */
export function parseCatalog(raw: string): ParsedCatalog {
  let o: Record<string, unknown>
  try {
    o = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'El archivo no es un catálogo válido (no se puede leer).' }
  }
  if (!o || typeof o !== 'object' || o.v !== 1 || !Array.isArray(o.products) || typeof o.business !== 'object' || !o.business) {
    return { ok: false, error: 'El archivo no es un catálogo de Conta.' }
  }
  const b = o.business as Record<string, unknown>
  const name = text(b.name, 80)
  if (!name) return { ok: false, error: 'El catálogo no trae el nombre del negocio.' }
  if (o.products.length === 0) return { ok: false, error: 'El catálogo no tiene productos.' }
  if (o.products.length > MAX_PRODUCTS) return { ok: false, error: `El catálogo tiene más de ${MAX_PRODUCTS} productos.` }
  const generated = new Date(String(o.generatedAt))
  const products: CatalogProduct[] = []
  for (const p of o.products as Record<string, unknown>[]) {
    const price = cents(p?.priceCents)
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !ID.test(p.id) || !text(p.name, 120) || price === undefined) {
      return { ok: false, error: 'Uno de los productos del catálogo no es válido.' }
    }
    const variants: CatalogVariant[] = []
    for (const v of Array.isArray(p.variants) ? (p.variants as Record<string, unknown>[]) : []) {
      const vp = cents(v?.priceCents)
      if (!v || typeof v.id !== 'string' || !ID.test(v.id) || !text(v.name, 80) || vp === undefined) return { ok: false, error: `Una variante de "${text(p.name, 60)}" no es válida.` }
      variants.push({ id: v.id, name: text(v.name, 80), priceCents: vp, soldOut: v.soldOut === true })
    }
    const photo = typeof p.photo === 'string' && p.photo.length <= MAX_PHOTO_CHARS && JPEG.test(p.photo) ? p.photo : undefined
    const photoPath = typeof p.photoPath === 'string' && PHOTO_PATH.test(p.photoPath) ? p.photoPath : undefined
    products.push({
      id: p.id, name: text(p.name, 120), description: text(p.description, 600), category: text(p.category, 60), priceCents: price,
      ...(photo && { photo }), ...(photoPath && { photoPath }), soldOut: p.soldOut === true, ...(variants.length && { variants }),
    })
  }
  const used = new Set(products.map((p) => p.category).filter(Boolean))
  const categories = (Array.isArray(o.categories) ? (o.categories as unknown[]) : []).map((c) => text(c, 60)).filter((c) => c && used.has(c))
  return {
    ok: true,
    data: {
      v: 1,
      generatedAt: Number.isNaN(generated.getTime()) ? new Date(0).toISOString() : generated.toISOString(),
      business: {
        name, phone: text(b.phone, 40), country: /^[A-Z]{2}$/.test(String(b.country)) ? String(b.country) : 'MX', address: text(b.address, 200),
        openingHours: text(b.openingHours, 120), currency: /^[A-Z]{3}$/.test(String(b.currency)) ? String(b.currency) : 'MXN', note: text(b.note, 400),
      },
      categories,
      products,
    },
  }
}
