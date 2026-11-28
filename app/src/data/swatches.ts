// Muestrario de colores de melamina: foto, proveedor y grosores, para mandarlo al cliente y anotar el que escoge.
import { db } from './db'
import type { Business, Quote, Swatch } from './types'

export const listSwatches = (b: Pick<Business, 'swatches'>): Swatch[] => b.swatches ?? []

async function write(businessId: string, fn: (l: Swatch[]) => Swatch[]) {
  await db.transaction('rw', db.business, async () => {
    const b = await db.business.get(businessId)
    if (!b) throw new Error('Negocio no encontrado')
    await db.business.update(businessId, { swatches: fn(listSwatches(b)), updatedAt: new Date().toISOString() })
  })
}

export async function saveSwatch(businessId: string, input: Omit<Swatch, 'id'> & { id?: string }): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('Escribe el nombre del color')
  const s: Swatch = { id: input.id ?? crypto.randomUUID(), name, supplier: input.supplier.trim(), esp: [...new Set(input.esp.filter((n) => n > 0))].sort((a, b) => a - b), ...(input.photo && { photo: input.photo }) }
  await write(businessId, (l) => (l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [...l, s]))
}

export const removeSwatch = (businessId: string, id: string) => write(businessId, (l) => l.filter((x) => x.id !== id))

/** Texto para WhatsApp con los colores elegidos. */
export function swatchText(list: Swatch[], business: string): string {
  return [`Estos son los colores que manejamos en ${business}:`, ...list.map((s) => `• ${s.name}${s.esp.length ? ` (${s.esp.join(' / ')} mm)` : ''}`), '¿Cuál le gusta más?'].join('\n')
}

export async function setQuoteColor(quoteId: string, color: string): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q) return
  const { color: _c, ...rest } = q
  await db.quote.put({ ...rest, ...(color.trim() && { color: color.trim() }), updatedAt: new Date().toISOString() } as Quote)
}
