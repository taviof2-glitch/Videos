// Catálogo en vivo: la página pública lee el catálogo y manda pedidos directo al servidor (sin supabase-js: solo fetch).
import { SUPABASE_KEY, SUPABASE_URL } from '../sync/config'
import { parseCatalog, type CatalogData } from './catalogFormat'
import type { CartLine } from './catalogOrder'

type Fetch = typeof fetch

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }

/** El nombre de la página que viene en el enlace (`?c=taller-lopez`), o undefined. */
export const slugFromSearch = (search: string): string | undefined => {
  const c = new URLSearchParams(search).get('c')?.trim().toLowerCase()
  return c && /^[a-z0-9][a-z0-9-]{2,39}$/.test(c) ? c : undefined
}

async function rpc(fn: string, body: unknown, f: Fetch): Promise<unknown> {
  const res = await f(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    let message = ''
    try {
      message = ((await res.json()) as { message?: string }).message ?? ''
    } catch { /* sin cuerpo */ }
    throw new Error(message || `HTTP ${res.status}`)
  }
  return res.json()
}

/** Lee el catálogo en vivo. Devuelve null si el negocio no tiene catálogo (o está apagado). Las fotos se piden aparte. */
export async function loadLiveCatalog(slug: string, f: Fetch = fetch): Promise<CatalogData | null> {
  const raw = await rpc('public_catalog', { p_slug: slug }, f)
  if (raw === null) return null
  const r = parseCatalog(JSON.stringify(raw))
  if (!r.ok) throw new Error(r.error)
  return r.data
}

/** Baja una foto del catálogo y devuelve un enlace local para mostrarla (o undefined si no se pudo). */
export async function loadLivePhoto(path: string, f: Fetch = fetch): Promise<string | undefined> {
  try {
    const res = await f(`${SUPABASE_URL}/storage/v1/object/authenticated/product-photos/${path}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (!res.ok) return undefined
    return URL.createObjectURL(await res.blob())
  } catch {
    return undefined
  }
}

/** El pedido en palabras del cliente cuando algo sale mal. */
export function orderErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/rate_limited|too many/i.test(msg)) return 'Has enviado varios pedidos seguidos. Espera unos minutos y vuelve a intentarlo.'
  if (/product_unavailable/.test(msg)) return 'Alguno de los productos ya no está disponible. Recarga la página y revisa tu pedido.'
  if (/not_found/.test(msg)) return 'Este catálogo ya no recibe pedidos.'
  if (/failed to fetch|network|load failed/i.test(msg)) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
  return 'No se pudo enviar el pedido. Inténtalo de nuevo o pídelo por WhatsApp.'
}

/** Manda el pedido. Los precios los pone el servidor; devuelve el número del pedido y el total real. */
export async function placeLiveOrder(slug: string, customer: string, notes: string, cart: CartLine[], f: Fetch = fetch): Promise<{ number: number; totalCents: number }> {
  const items = cart.map((l) => ({ p: l.productId, ...(l.variantId && { v: l.variantId }), q: l.quantity }))
  return (await rpc('place_order', { p_slug: slug, p_customer: customer.trim(), p_notes: notes.trim(), p_items: items }, f)) as { number: number; totalCents: number }
}
