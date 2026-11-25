import { db } from './db'
import { roundQty } from './quantity'
import type { Product, StockMovement, StockReason } from './types'

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
}

export type StockStatus = 'ok' | 'low' | 'out'

/** Agotado si no queda nada; bajo si tiene cantidad mínima y está en ella o por debajo. */
export function stockStatus(p: Pick<Product, 'stock' | 'minStock'>): StockStatus {
  if (p.stock <= 0) return 'out'
  if (p.minStock > 0 && p.stock <= p.minStock) return 'low'
  return 'ok'
}

export function needsRestock(p: Pick<Product, 'stock' | 'minStock'>): boolean {
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

async function checkBarcodeFree(businessId: string, barcode: string, exceptId?: string) {
  if (!barcode) return
  const clash = await db.product
    .where({ businessId, barcode })
    .filter((p) => !p.deletedAt && p.id !== exceptId)
    .first()
  if (clash) throw new Error(`El código de barras ya lo usa "${clash.name}"`)
}

let lastStamp = 0
/** Marca de tiempo estrictamente creciente: dos movimientos en el mismo milisegundo no se desordenan en el historial. */
function stamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp).toISOString()
}

function movement(product: Pick<Product, 'id' | 'businessId'>, delta: number, reason: StockReason, transactionId?: string): StockMovement {
  return {
    id: crypto.randomUUID(),
    businessId: product.businessId,
    productId: product.id,
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
    createdAt: now,
    updatedAt: now,
  }
  checkFields(product)
  await db.transaction('rw', db.product, db.stockMovement, async () => {
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
  return db.transaction('rw', db.product, db.stockMovement, async () => {
    const current = await db.product.get(id)
    if (!current || current.deletedAt) throw new Error('El producto no existe')
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
      updatedAt: new Date().toISOString(),
    }
    // Un stock negativo (vendido sin existencias) se puede conservar; lo que no se puede es escribir uno nuevo.
    checkFields(next, next.stock !== current.stock)
    if (next.barcode !== current.barcode) await checkBarcodeFree(current.businessId, next.barcode, id)
    const delta = roundQty(next.stock - current.stock)
    if (delta !== 0) await db.stockMovement.add(movement(current, delta, 'adjust'))
    await db.product.put(next)
    return next
  })
}

/**
 * Suma (o resta) stock con su movimiento, en la misma transacción.
 * La usarán ventas (T4), compras (T9) y pedidos (T12). Permite quedar en negativo:
 * vender sin stock solo avisa (ver architecture.md).
 */
export async function adjustStock(productId: string, delta: number, reason: StockReason, transactionId?: string): Promise<Product> {
  return db.transaction('rw', db.product, db.stockMovement, async () => {
    const p = await db.product.get(productId)
    if (!p) throw new Error('El producto no existe')
    const m = movement(p, delta, reason, transactionId)
    await db.stockMovement.add(m)
    const updated = { ...p, stock: roundQty(p.stock + m.delta), updatedAt: m.createdAt }
    await db.product.put(updated)
    return updated
  })
}

/** Borrado lógico: el producto desaparece de las listas pero su historial se conserva. */
export async function deleteProduct(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.product.update(id, { deletedAt: now, updatedAt: now })
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

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export type ProductFilter = { search?: string; categoryId?: string; onlyRestock?: boolean }

/** Productos vivos del negocio, por nombre. La búsqueda ignora acentos y también busca por código de barras. */
export async function listProducts(businessId: string, filter: ProductFilter = {}): Promise<Product[]> {
  const q = normalize(filter.search?.trim() ?? '')
  const rows = await db.product
    .where('[businessId+name]')
    .between([businessId, ''], [businessId, '￿'])
    .filter(
      (p) =>
        !p.deletedAt &&
        (!filter.categoryId || p.categoryId === filter.categoryId) &&
        (!filter.onlyRestock || needsRestock(p)) &&
        (!q || normalize(p.name).includes(q) || p.barcode === filter.search?.trim()),
    )
    .toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function stockHistory(productId: string, limit = 20): Promise<StockMovement[]> {
  return db.stockMovement
    .where('[productId+createdAt]')
    .between([productId, ''], [productId, '￿'])
    .reverse()
    .limit(limit)
    .toArray()
}

/** Stock recalculado desde los movimientos (para comprobar que la caché cuadra). */
export async function stockFromMovements(productId: string): Promise<number> {
  const moves = await db.stockMovement.where({ productId }).toArray()
  return roundQty(moves.reduce((sum, m) => sum + m.delta, 0))
}

export type InventorySummary = { count: number; restock: number; costValueCents: number }

export function summarize(products: Product[]): InventorySummary {
  return {
    count: products.length,
    restock: products.filter(needsRestock).length,
    costValueCents: Math.round(products.reduce((sum, p) => sum + Math.max(p.stock, 0) * p.costCents, 0)),
  }
}
