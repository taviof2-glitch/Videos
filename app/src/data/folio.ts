import { db } from './db'
import { LINK_KEY } from '../sync/tables'

/** Con la cuenta conectada a este negocio, el servidor es quien da los folios: lo que se crea aquí es provisional. */
export async function isLinked(businessId: string): Promise<boolean> {
  const link = (await db.syncState.get(LINK_KEY))?.value as { businessId?: string } | undefined
  return link?.businessId === businessId
}

type Numbered = { id: string; number: number; numberPending?: boolean }

/** Código corto del folio provisional: los primeros 6 caracteres del id, en mayúsculas («P-3F9A2C»). */
export const provisionalCode = (id: string) => `P-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`

/** Lo que se ve en pantalla y en el PDF: «#8», o «P-3F9A2C» mientras el servidor no asigna el número. */
export const docNumber = (d: Numbered) => (d.numberPending ? provisionalCode(d.id) : `#${d.number}`)
