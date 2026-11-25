import { db } from './db'
import type { Category } from './types'

export async function listCategories(businessId: string, kind: Category['kind']): Promise<Category[]> {
  const rows = await db.category.where({ businessId, kind }).toArray()
  return rows.filter((c) => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Crea la categoría o devuelve la que ya existe con el mismo nombre (sin distinguir mayúsculas). */
export async function ensureCategory(businessId: string, kind: Category['kind'], rawName: string): Promise<Category> {
  const name = rawName.trim()
  if (!name) throw new Error('El nombre de la categoría es obligatorio')
  const existing = (await listCategories(businessId, kind)).find(
    (c) => c.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0,
  )
  if (existing) return existing
  const now = new Date().toISOString()
  const category: Category = { id: crypto.randomUUID(), businessId, kind, name, createdAt: now, updatedAt: now }
  await db.category.add(category)
  return category
}

/** Categorías de gasto más comunes en un negocio pequeño; se crean una sola vez y después se pueden borrar o renombrar. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Materiales',
  'Insumos',
  'Mercancía',
  'Transporte',
  'Combustible',
  'Nómina',
  'Gastos administrativos',
  'Renta',
  'Luz',
  'Agua',
  'Internet y teléfono',
  'Mantenimiento y reparaciones',
  'Herramientas y equipo',
  'Publicidad',
  'Impuestos',
  'Comisiones bancarias',
  'Otros gastos',
] as const

/** Id estable (misma forma que un UUID v5) para que dos aparatos que siembran lo mismo no dupliquen categorías al sincronizar. */
async function defaultCategoryId(businessId: string, name: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`conta-default-category:${businessId}:${name}`)))
  const b = hash.slice(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const seededKey = (businessId: string) => `defaultExpenseCategories:${businessId}`

/**
 * Siembra las categorías de gasto comunes, una sola vez por negocio y aparato. No toca las que el negocio ya tiene
 * (mismo nombre, sin distinguir mayúsculas), no revive las que se borraron y es seguro llamarla varias veces.
 */
export async function seedDefaultExpenseCategories(businessId: string): Promise<number> {
  if (await db.meta.get(seededKey(businessId))) return 0
  const ids = await Promise.all(DEFAULT_EXPENSE_CATEGORIES.map((name) => defaultCategoryId(businessId, name)))
  return db.transaction('rw', db.category, db.meta, async () => {
    if (await db.meta.get(seededKey(businessId))) return 0
    const existing = await db.category.where({ businessId, kind: 'expense' }).toArray()
    const names = new Set(existing.filter((c) => !c.deletedAt).map((c) => c.name.trim().toLocaleLowerCase('es')))
    const now = new Date().toISOString()
    const fresh: Category[] = []
    for (const [i, name] of DEFAULT_EXPENSE_CATEGORIES.entries()) {
      if (names.has(name.toLocaleLowerCase('es')) || (await db.category.get(ids[i]))) continue
      fresh.push({ id: ids[i], businessId, kind: 'expense', name, createdAt: now, updatedAt: now })
    }
    await db.category.bulkAdd(fresh)
    await db.meta.put({ key: seededKey(businessId), value: now })
    return fresh.length
  })
}
