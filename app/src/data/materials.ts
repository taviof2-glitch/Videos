// Material del taller: hojas, herrajes y retazos que hay en existencia, y a cuánto los vende cada proveedor.
// La lista vive en el negocio (viaja con él entre aparatos). No es el inventario de productos que se venden.
import { db } from './db'
import type { Business, WorkMaterial } from './types'

export const UNITS = ['hojas', 'piezas', 'pares', 'metros', 'litros', 'cajas']
export const SUGGESTED_MATERIALS: [string, string][] = [['Hoja de melamina 16 mm', 'hojas'], ['Hoja de fondo 3 mm', 'hojas'], ['Bisagras', 'piezas'], ['Correderas', 'pares'], ['Jaladeras', 'piezas'], ['Cubrecanto', 'metros'], ['Tubo para closet', 'metros'], ['Tornillos', 'cajas']]

export const listMaterials = (business: Pick<Business, 'materials'>): WorkMaterial[] => business.materials ?? []

async function write(businessId: string, fn: (list: WorkMaterial[]) => WorkMaterial[]): Promise<void> {
  const business = await db.business.get(businessId)
  if (!business) throw new Error('Negocio no encontrado')
  await db.business.update(businessId, { materials: fn(listMaterials(business)), updatedAt: new Date().toISOString() })
}

export type MaterialInput = { id?: string; name: string; unit: string; stock: number; min?: number; prices?: { supplier: string; priceCents: number }[] }

/** Agrega un material o cambia el que ya existe (por `id`). */
export async function saveMaterial(businessId: string, input: MaterialInput): Promise<WorkMaterial> {
  const name = input.name.trim()
  if (!name) throw new Error('Escribe el nombre del material')
  if (!(input.stock >= 0)) throw new Error('La existencia no puede ser negativa')
  const prices = (input.prices ?? []).filter((p) => p.supplier.trim() && p.priceCents > 0).map((p) => ({ supplier: p.supplier.trim(), priceCents: Math.round(p.priceCents) }))
  const material: WorkMaterial = { id: input.id ?? crypto.randomUUID(), name, unit: input.unit.trim() || 'piezas', stock: Math.round(input.stock * 100) / 100, ...(input.min && input.min > 0 && { min: input.min }), prices }
  await write(businessId, (list) => {
    if (list.some((m) => m.id !== material.id && m.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)) throw new Error('Ya tienes un material con ese nombre')
    // El historial de precios viene de los tickets: al cambiar el material a mano se conserva.
    return list.some((m) => m.id === material.id) ? list.map((m) => (m.id === material.id ? { ...material, ...(m.history && { history: m.history }) } : m)) : [...list, material]
  })
  return material
}

/** Suma o resta existencia (entró una compra o se usó en una obra). Nunca baja de cero. */
export async function adjustMaterial(businessId: string, id: string, delta: number): Promise<void> {
  await write(businessId, (list) => list.map((m) => (m.id === id ? { ...m, stock: Math.max(0, Math.round((m.stock + delta) * 100) / 100) } : m)))
}

export async function deleteMaterial(businessId: string, id: string): Promise<void> {
  await write(businessId, (list) => list.filter((m) => m.id !== id))
}

export const isLow = (m: WorkMaterial) => m.min !== undefined && m.stock <= m.min
/** El proveedor más barato de un material. */
export const bestPrice = (m: WorkMaterial) => (m.prices.length ? [...m.prices].sort((a, b) => a.priceCents - b.priceCents)[0] : undefined)
/** Lo que vale el material en existencia, al mejor precio. */
export const stockValueCents = (list: WorkMaterial[]) => list.reduce((a, m) => a + Math.round(m.stock * (bestPrice(m)?.priceCents ?? 0)), 0)

export type PriceRise = { material: WorkMaterial; supplier: string; fromCents: number; toCents: number; pct: number; date: string }

/** Materiales cuyo último precio (mismo proveedor) subió contra el anterior; los que más subieron primero. */
export function priceRises(list: WorkMaterial[], minPct = 3): PriceRise[] {
  const out: PriceRise[] = []
  for (const m of list) {
    const h = m.history ?? []
    if (h.length < 2) continue
    const last = h[h.length - 1]
    const prev = [...h.slice(0, -1)].reverse().find((x) => x.supplier === last.supplier) ?? h[h.length - 2]
    const pct = Math.round(((last.priceCents - prev.priceCents) / prev.priceCents) * 100)
    if (pct >= minPct) out.push({ material: m, supplier: last.supplier, fromCents: prev.priceCents, toCents: last.priceCents, pct, date: last.date })
  }
  return out.sort((a, b) => b.pct - a.pct)
}
