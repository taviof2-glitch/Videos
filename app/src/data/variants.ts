import { db } from './db'
import { checkBarcodeFree, movement } from './products'
import { roundQty } from './quantity'
import type { ProductVariant } from './types'

export type VariantAttribute = { name: string; values: string[] }
export const MAX_ATTRIBUTES = 2
export const MAX_VARIANTS = 60

export const variantName = (values: string[]) => values.join(' / ')
const comboKey = (values: string[]) => values.map((v) => v.toLocaleLowerCase('es')).join('\u0000')
const same = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' }) === 0

/** Todas las combinaciones de valores, en orden: [Natural, Chico], [Natural, Grande], [Nogal, Chico]… */
export function variantCombos(attrs: VariantAttribute[]): string[][] {
  return attrs.reduce<string[][]>((acc, a) => acc.flatMap((combo) => a.values.map((v) => [...combo, v])), [[]])
}

/** Limpia espacios y repetidos, y valida: 1 o 2 atributos con nombre distinto, al menos un valor cada uno. */
export function cleanAttributes(raw: VariantAttribute[]): VariantAttribute[] {
  const attrs = raw
    .map((a) => ({ name: a.name.trim(), values: a.values.map((v) => v.trim()).filter(Boolean) }))
    .map((a) => ({ ...a, values: a.values.filter((v, i) => a.values.findIndex((w) => same(v, w)) === i) }))
  if (attrs.length === 0) throw new Error('Agrega al menos un atributo, por ejemplo Color o Tamaño')
  if (attrs.length > MAX_ATTRIBUTES) throw new Error(`Máximo ${MAX_ATTRIBUTES} atributos`)
  for (const a of attrs) {
    if (!a.name) throw new Error('Cada atributo necesita un nombre')
    if (a.values.length === 0) throw new Error(`Escribe al menos un valor para "${a.name}"`)
  }
  if (attrs.length === 2 && same(attrs[0].name, attrs[1].name)) throw new Error('Los atributos deben tener nombres distintos')
  const total = attrs.reduce((n, a) => n * a.values.length, 1)
  if (total > MAX_VARIANTS) throw new Error(`Serían ${total} variantes; el máximo es ${MAX_VARIANTS}`)
  return attrs
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  return (await db.productVariant.where('productId').equals(productId).filter((v) => !v.deletedAt).toArray()).sort((a, b) => a.position - b.position)
}

export async function getVariant(id: string): Promise<ProductVariant | undefined> {
  const v = await db.productVariant.get(id)
  return v && !v.deletedAt ? v : undefined
}

/**
 * Define (o cambia) los atributos de un producto y genera sus variantes. Las combinaciones que ya existían
 * conservan su stock y sus datos; las nuevas empiezan en 0; las que se quitan deben estar en 0.
 * La primera vez, el stock que tenía el producto pasa a la primera variante (con sus movimientos).
 */
export async function setVariantAttributes(productId: string, raw: VariantAttribute[]): Promise<{ created: number; removed: number; movedStock: number }> {
  const attrs = cleanAttributes(raw)
  return db.transaction('rw', [db.product, db.productVariant, db.stockMovement], async () => {
    const p = await db.product.get(productId)
    if (!p || p.deletedAt) throw new Error('El producto no existe')
    const existing = await listVariants(productId)
    const byKey = new Map(existing.map((v) => [comboKey(v.values), v]))
    const combos = variantCombos(attrs)
    const wanted = new Set(combos.map(comboKey))
    const removed = existing.filter((v) => !wanted.has(comboKey(v.values)))
    for (const v of removed) {
      if (v.stock !== 0) throw new Error(`La variante "${v.name}" tiene ${v.stock} en existencia: déjala en 0 antes de quitarla`)
    }
    const now = new Date().toISOString()
    let created = 0
    const result: ProductVariant[] = []
    for (const [position, values] of combos.entries()) {
      const prev = byKey.get(comboKey(values))
      const v: ProductVariant = prev
        ? { ...prev, values, name: variantName(values), position, updatedAt: now }
        : { id: crypto.randomUUID(), businessId: p.businessId, productId, values, name: variantName(values), barcode: '', stock: 0, minStock: 0, position, createdAt: now, updatedAt: now }
      if (!prev) created++
      result.push(v)
    }
    let movedStock = 0
    if (!p.hasVariants && p.stock !== 0) {
      movedStock = p.stock
      await db.stockMovement.add(movement(p, -p.stock, 'adjust'))
      await db.stockMovement.add(movement(p, p.stock, 'adjust', undefined, result[0].id))
      result[0] = { ...result[0], stock: roundQty(result[0].stock + p.stock) }
    }
    await db.productVariant.bulkPut(result)
    for (const v of removed) await db.productVariant.update(v.id, { deletedAt: now, updatedAt: now })
    await db.product.update(productId, { hasVariants: true, variantAttributes: attrs, updatedAt: now })
    return { created, removed: removed.length, movedStock }
  })
}

/** Quita todas las variantes (vuelve a ser un producto simple). Solo si todas están en 0. */
export async function removeVariants(productId: string): Promise<void> {
  await db.transaction('rw', [db.product, db.productVariant], async () => {
    const p = await db.product.get(productId)
    if (!p || p.deletedAt) throw new Error('El producto no existe')
    const variants = await listVariants(productId)
    const withStock = variants.find((v) => v.stock !== 0)
    if (withStock) throw new Error(`Para quitar las variantes, deja en 0 el stock de cada una ("${withStock.name}" tiene ${withStock.stock})`)
    const now = new Date().toISOString()
    for (const v of variants) await db.productVariant.update(v.id, { deletedAt: now, updatedAt: now })
    await db.product.update(productId, { hasVariants: false, variantAttributes: undefined, updatedAt: now })
  })
}

export type VariantChanges = {
  barcode?: string
  /** null = usar el precio o el costo del producto. */
  priceCents?: number | null
  costCents?: number | null
  stock?: number
  minStock?: number
}

/** Edita una variante. Cambiar su stock genera un movimiento de ajuste y mueve también el total del producto. */
export async function updateVariant(variantId: string, changes: VariantChanges): Promise<ProductVariant> {
  return db.transaction('rw', [db.product, db.productVariant, db.stockMovement], async () => {
    const v = await db.productVariant.get(variantId)
    if (!v || v.deletedAt) throw new Error('La variante no existe')
    const p = (await db.product.get(v.productId))!
    const next: ProductVariant = { ...v, updatedAt: new Date().toISOString() }
    if (changes.barcode !== undefined) {
      next.barcode = changes.barcode.trim()
      if (next.barcode !== v.barcode) await checkBarcodeFree(v.businessId, next.barcode, { variantId: v.id })
    }
    for (const key of ['priceCents', 'costCents'] as const) {
      const val = changes[key]
      if (val === undefined) continue
      if (val === null) delete next[key]
      else if (!Number.isInteger(val) || val < 0) throw new Error(key === 'priceCents' ? 'El precio no es válido' : 'El costo no es válido')
      else next[key] = val
    }
    if (changes.minStock !== undefined) {
      const min = roundQty(changes.minStock)
      if (!Number.isFinite(min) || min < 0) throw new Error('La cantidad mínima no puede ser negativa')
      next.minStock = min
    }
    if (changes.stock !== undefined) {
      const stock = roundQty(changes.stock)
      if (stock !== v.stock) {
        if (!Number.isFinite(stock) || stock < 0) throw new Error('La cantidad disponible no puede ser negativa')
        const delta = roundQty(stock - v.stock)
        await db.stockMovement.add(movement(p, delta, 'adjust', undefined, v.id))
        next.stock = stock
        await db.product.update(p.id, { stock: roundQty(p.stock + delta), updatedAt: next.updatedAt })
      }
    }
    await db.productVariant.put(next)
    return next
  })
}

/** Nombres de todas las variantes de un producto, también las ya quitadas (para mostrar el historial de stock). */
export async function variantNames(productId: string): Promise<Map<string, string>> {
  const all = await db.productVariant.where('productId').equals(productId).toArray()
  return new Map(all.map((v) => [v.id, v.name]))
}
