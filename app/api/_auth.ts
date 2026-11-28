// Quién puede usar las funciones del servidor: una sesión de la cuenta de Houselite con al menos un negocio.
// (Los archivos que empiezan con _ no se publican como funciones en Vercel.)
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'https://opgiubxgxmzyjatexfzg.supabase.co'
export const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY ?? 'sb_publishable_8pL8BLHSdgbhIdqhmeZBgg_JMZelR-U'

/** La sesión es de la cuenta de Houselite y esa cuenta tiene al menos un negocio. */
export async function allowed(token: string): Promise<boolean> {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers })
  if (!user.ok) return false
  const mine = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_my_businesses`, { method: 'POST', headers, body: '{}' })
  if (!mine.ok) return false
  const list = (await mine.json()) as unknown
  return Array.isArray(list) && list.length > 0
}

