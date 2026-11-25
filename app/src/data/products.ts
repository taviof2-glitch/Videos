import { db } from './db'
import { roundQty } from './quantity'
import type { Product, ProductVariant, StockMovement, StockReason } from './types'

export const MAX_PHOTOS = 3

export type ProductInput = {
  name: string
  barcode?: string
  categoryId?: string
  priceCents?: number
  costCents?: number
  stock?: number
  minStock?: number
  photos?: Blob[]
  description?: string
  visibleInCatalog?: boolean
}

export type StockStatus = 'ok' | 'low' | 'out'

/** Producto con sus variantes vivas ya cargadas (las da `listProducts`). */
export type ProductWithVariants = Product & { variants?: ProductVariant[] }
type Stocked = Pick<Product, 'stock' | 'minStock'> & { variants?: Pick<ProductVariant, 'stock' | 'minStock'>[] }

/**
 * Agotado si no queda nada; bajo si tiene cantidad mínima y está en ella o por debajo.
 * Con variantes: agotado si se acabaron todas; bajo si alguna está baja o agotada.
 */
export function stockStatus(p: Stocked): StockStatus {
  if (p.variants?.length) {
    const each = p.variants.map((v) => stockStatus(v))
    if (each.every((s) => s === 'out')) return 'out'
    return each.some((s) => s !== 'ok') ? 'low' : 'ok'
  }
  if (p.stock <= 0) return 'out'
  if (p.minStock > 0 && p.stock <= p.minStock) return 'low'
  return 'ok'
}

export function needsRestock(p: Stocked): boolean {
  return stockStatus(p) !== 'ok'
}

function checkFields(p: Pick<Product, 'name' | 'priceCents' | 'costCents' | 'stock' | 'minStock' | 'photos'>, checkStock = true) {
  if (!p.name) throw new Error('El nombre del producto es obligatorio')
  for (const [label, v] of [
    ['El precio', p.priceCents],
    ['El costo', p.costCents],
  ] as const) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`${label} no es válido`)
  }
  if (checkStock && (!Number.isFinite(p.stock) || p.stock < 0)) throw new Error('La cantidad disponible no puede ser negativa')
  if (!Number.isFinite(p.minStock) || p.minStock < 0) throw new Error('La cantidad mínima no puede ser negativa')
  if (p.photos.length > MAX_PHOTOS) throw new Error(`Máximo ${MAX_PHOTOS} imágenes por producto`)
}

/** Un código de barras es único en el negocio, entre productos y variantes. */
export async function checkBarcodeFree(businessId: string, barcode: string, except: { productId?: string; variantId?: string } = {}) {
  if (!barcode) return
  const clash = await db.product
    .where({ businessId, barcode })
    .filter((p) => !p.deletedAt && p.id !== except.productId)
    .first()
  if (clash) throw new Error(`El código de barras ya lo usa "${clash.name}"`)
  const variant = await db.productVariant
    .where('[businessId+barcode]')
    .equals([businessId, barcode])
    .filter((v) => !v.deletedAt && v.id !== except.variantId)
    .first()
  if (variant) {
    const owner = await db.product.get(variant.productId)
    throw new Error(`El código de barras ya lo usa "${owner?.name ?? 'otro producto'} (${variant.name})"`)
  }
}

let lastStamp = 0
/** Marca de tiempo estrictamente creciente: dos movimientos en el mismo milisegundo no se desordenan en el historial. */
function stamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp).toISOString()
}

export function movement(product: Pick<Product, 'id' | 'businessId'>, delta: number, reason: StockReason, transactionId?: string, variantId?: string): StockMovement {
  return {
    id: crypto.randomUUID(),
    businessId: product.businessId,
    productId: product.id,
    ...(variantId && { variantId }),
    transactionId,
    delta: roundQty(delta),
    reason,
    createdAt: stamp(),
  }
}

export async function createProduct(businessId: string, input: ProductInput): Promise<Product> {
  const now = new Date().toISOString()
  const product: Product = {
    id: crypto.randomUUID(),
    businessId,
    name: input.name.trim(),
    barcode: (input.barcode ?? '').trim(),
    categoryId: input.categoryId || undefined,
    priceCents: input.priceCents ?? 0,
    costCents: input.costCents ?? 0,
    stock: roundQty(input.stock ?? 0),
    minStock: roundQty(input.minStock ?? 0),
    photos: input.photos ?? [],
    ...(input.description?.trim() && { description: input.description.trim() }),
    ...(input.visibleInCatalog && { visibleInCatalog: true }),
    createdAt: now,
    updatedAt: now,
  }
  checkFields(product)
  await db.transaction('rw', [db.product, db.productVariant, db.stockMovement], async () => {
    await checkBarcodeFree(businessId, product.barcode)
    await db.product.add(product)
    if (product.stock !== 0) await db.stockMovement.add(movement(product, product.stock, 'adjust'))
  })
  return product
}

/**
 * Edita un producto. Si cambia la cantidad disponible, se guarda un movimiento de ajuste
 * por la diferencia: el historial de stock nunca se reescribe.
 */
export async function updateProduct(id: string, changes: Partial<ProductInput>): Promise<Product> {
  return db.transaction('rw', [db.product, db.productVariant, db.stockMovement], async () => {
    const current = await db.product.get(id)
    if (!current || current.deletedAt) throw new Error('El producto no existe')
    if (current.hasVariants && changes.stock !== undefined && roundQty(changes.stock) !== current.stock) {
      throw new Error('Este producto tiene variantes: su stock se cambia en cada variante')
    }
    const next: Product = {
      ...current,
      ...(changes.name !== undefined && { name: changes.name.trim() }),
      ...(changes.barcode !== undefined && { barcode: changes.barcode.trim() }),
      ...('categoryId' in changes && { categoryId: changes.categoryId || undefined }),
      ...(changes.priceCents !== undefined && { priceCents: changes.priceCents }),
      ...(changes.costCents !== undefined && { costCents: changes.costCents }),
      ...(changes.stock !== undefined && { stock: roundQty(changes.stock) }),
      ...(changes.minStock !== undefined && { minStock: roundQty(changes.minStock) }),
      ...(changes.photos !== undefined && { photos: changes.photos }),
      ...(changes.description !== undefined && { description: changes.description.trim() || undefined }),
      ...(changes.visibleInCatalog !== undefined && { visibleInCatalog: changes.visibleInCatalog || undefined }),
      updatedAt: new Date().toISOString(),
    }
    // Un stock negativo (vendido sin existencias) se puede conservar; lo que no se puede es escribir uno nuevo.
    checkFields(next, next.stock !== current.stock)
    if (next.barcode !== current.barcode) await checkBarcodeFree(current.businessId, next.barcode, { productId: id })
    const delta = roundQty(next.stock - current.stock)
    if (delta !== 0) await db.stockMovement.add(movement(current, delta, 'adjust'))
    await db.product.put(next)
    return next
  })
}

/**
 * Suma (o resta) stock con su movimiento, en la misma transacción. La usan ventas, compras y pedidos.
 * Permite quedar en negativo: vender sin stock solo avisa (ver architecture.md).
 * En un producto con variantes hay que decir cuál (`variantId`): se mueve la variante y también el total del producto.
 */
export async function adjustStock(productId: string, delta: number, reason: StockReason, transactionId?: string, variantId?: string): Promise<Product> {
  return db.transaction('rw', [db.product, db.productVariant, db.stockMovement], async () => {
    const p = await db.product.get(productId)
    if (!p) throw new Error('El producto no existe')
    let variant: ProductVariant | undefined
    if (variantId) {
      variant = await db.productVariant.get(variantId)
      // una variante archivada se acepta: puede llegar al anular una venta antigua
      if (!variant || variant.productId !== p.id) throw new Error('La variante no existe')
    } else if (p.hasVariants) {
      throw new Error(`Elige la variante de "${p.name}"`)
    }
    const m = movement(p, delta, reason, transactionId, variant?.id)
    await db.stockMovement.add(m)
    if (variant) await db.productVariant.put({ ...variant, stock: roundQty(variant.stock + m.delta), updatedAt: m.createdAt })
    const updated = { ...p, stock: roundQty(p.stock + m.delta), updatedAt: m.createdAt }
    await db.product.put(updated)
    return updated
  })
}

/** Borrado lógico: el producto desaparece de las listas pero su historial se conserva. */
/** Borra el producto y sus variantes: si no, el código de barras de una variante seguiría contando como "ya usado". */
export async function deleteProduct(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.transaction('rw', [db.product, db.productVariant], async () => {
    await db.product.update(id, { deletedAt: now, updatedAt: now })
    await db.productVariant.where('productId').equals(id).filter((v) => !v.deletedAt).modify({ deletedAt: now, updatedAt: now })
  })
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const p = await db.product.get(id)
  return p && !p.deletedAt ? p : undefined
}

export async function findByBarcode(businessId: string, barcode: string): Promise<Product | undefined> {
  const code = barcode.trim()
  if (!code) return undefined
  return db.product.where({ businessId, barcode: code }).filter((p) => !p.deletedAt).first()
}

/** Busca un código de barras en variantes y productos (lo que teclea un lector al vender o comprar). */
export async function findByCode(businessId: string, barcode: string): Promise<{ product: Product; variant?: ProductVariant } | undefined> {
  const code = barcode.trim()
  if (!code) return undefined
  const variant = await db.productVariant.where('[businessId+barcode]').equals([businessId, code]).filter((v) => !v.deletedAt).first()
  if (variant) {
    const product = await getProduct(variant.productId)
    if (product) return { product, variant }
  }
  const product = await findByBarcode(businessId, code)
  return product ? { product } : undefined
}

/** Variantes vivas de un negocio, agrupadas por producto y en su orden. */
async function variantsByProduct(businessId: string): Promise<Map<string, ProductVariant[]>> {
  const all = await db.productVariant.where('businessId').equals(businessId).filter((v) => !v.deletedAt).toArray()
  const map = new Map<string, ProductVariant[]>()
  for (const v of all.sort((a, b) => a.position - b.position)) map.set(v.productId, [...(map.get(v.productId) ?? []), v])
  return map
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Todas las palabras de la búsqueda aparecen en el texto (sin acentos ni mayúsculas): «nogal ch» encuentra «Nogal / Chico». */
export function matchesSearch(text: string, search: string): boolean {
  const words = normalize(search).split(/\s+/).filter(Boolean)
  const hay = normalize(text)
  return words.every((w) => hay.includes(w))
}

export type ProductFilter = { search?: string; categoryId?: string; onlyRestock?: boolean }

/**
 * Productos vivos del negocio, por nombre, con sus variantes. La búsqueda ignora acentos y también busca por
 * código de barras (del producto o de una variante) y por nombre de variante.
 */
export async function listProducts(businessId: string, filter: ProductFilter = {}): Promise<ProductWithVariants[]> {
  const raw = filter.search?.trim() ?? ''
  const q = raw
  const variants = await variantsByProduct(businessId)
  const rows = await db.product
    .where('[businessId+name]')
    .between([businessId, ''], [businessId, '\uffff'])
    .filter((p) => !p.deletedAt && (!filter.categoryId || p.categoryId === filter.categoryId))
    .toArray()
  const withVariants: ProductWithVariants[] = rows.map((p) => (p.hasVariants ? { ...p, variants: variants.get(p.id) ?? [] } : p))
  return withVariants
    .filter((p) => !filter.onlyRestock || needsRestock(p))
    .filter((p) => !q || matchesSearch(p.name, raw) || p.barcode === raw || !!p.variants?.some((v) => v.barcode === raw || matchesSearch(`${p.name} ${v.name}`, raw)))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function stockHistory(productId: string, limit = 20): Promise<StockMovement[]> {
  return db.stockMovement
    .where('[productId+createdAt]')
    .between([productId, ''], [productId, '￿'])
    .reverse()
    .limit(limit)
    .toArray()
}

/** Stock recalculado desde los movimientos (para comprobar que la caché cuadra). Con `variantId`, el de esa variante. */
export async function stockFromMovements(productId: string, variantId?: string): Promise<number> {
  const moves = await db.stockMovement.where({ productId }).filter((m) => !variantId || m.variantId === variantId).toArray()
  return roundQty(moves.reduce((sum, m) => sum + m.delta, 0))
}

export type InventorySummary = { count: number; restock: number; costValueCents: number }

/** Costo y precio de una unidad de esta variante (o del producto si no tiene variante o la variante no tiene uno propio). */
export const unitCost = (p: Pick<Product, 'costCents'>, v?: Pick<ProductVariant, 'costCents'>) => v?.costCents ?? p.costCents
export const unitPrice = (p: Pick<Product, 'priceCents'>, v?: Pick<ProductVariant, 'priceCents'>) => v?.priceCents ?? p.priceCents

export function summarize(products: ProductWithVariants[]): InventorySummary {
  const value = (p: ProductWithVariants) =>
    p.variants?.length ? p.variants.reduce((sum, v) => sum + Math.max(v.stock, 0) * unitCost(p, v), 0) : Math.max(p.stock, 0) * p.costCents
  return {
    count: products.length,
    restock: products.filter(needsRestock).length,
    costValueCents: Math.round(products.reduce((sum, p) => sum + value(p), 0)),
  }
}
