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
