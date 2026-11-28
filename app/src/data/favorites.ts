// Favoritos de Bases: muebles que se cotizan seguido, guardados con sus medidas para abrirlos con un toque.
import { db } from './db'
import type { Business } from './types'

export const MAX_FAVORITES = 24
export type Favorite = { name: string; state: unknown }

export function withFavorite(list: Favorite[] | undefined, name: string, state: unknown): Favorite[] {
  const n = name.trim().slice(0, 60)
  if (!n) throw new Error('Ponle un nombre')
  const rest = (list ?? []).filter((f) => f.name.toLowerCase() !== n.toLowerCase())
  return [{ name: n, state: structuredClone(state) }, ...rest].slice(0, MAX_FAVORITES)
}

export async function saveFavorite(business: Business, name: string, state: unknown): Promise<void> {
  const cur = (await db.business.get(business.id))?.favorites ?? business.favorites
  await db.business.update(business.id, { favorites: withFavorite(cur, name, state), updatedAt: new Date().toISOString() })
}

export async function removeFavorite(business: Business, name: string): Promise<void> {
  const cur = (await db.business.get(business.id))?.favorites ?? business.favorites ?? []
  await db.business.update(business.id, { favorites: cur.filter((f) => f.name !== name), updatedAt: new Date().toISOString() })
}
