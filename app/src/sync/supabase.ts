// Conexión real con Supabase. Solo se carga en la app instalable (no en la versión de claude.ai).
// La URL y la clave «publishable» son públicas por diseño: el acceso lo controlan las funciones del servidor.
import { createClient } from '@supabase/supabase-js'
import type { BusinessStatus, CatalogPage, Session, SyncBackend } from './backend'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import type { Assigned, Change, PullRow } from './engine'

export { SUPABASE_KEY, SUPABASE_URL }

/** Tiempo máximo de una llamada al servidor: con mala señal (o al volver de segundo plano) una petición puede quedarse colgada para siempre. */
const REQUEST_TIMEOUT_MS = 30_000

export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout: el servidor no respondió a tiempo')), ms)
  const outer = init.signal
  if (outer) {
    if (outer.aborted) ctrl.abort(outer.reason)
    else outer.addEventListener('abort', () => ctrl.abort(outer.reason), { once: true })
  }
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // La sesión se queda guardada en el aparato (el del mostrador no pide contraseña cada vez).
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'conta-auth' },
  global: { fetch: (input, init) => fetchWithTimeout(input, init) },
})

const BUCKET = 'product-photos'

const toSession = (u: { id: string; email?: string } | null | undefined): Session | null => (u ? { userId: u.id, email: u.email ?? '' } : null)

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const supabaseBackend: SyncBackend = {
  async getSession() {
    const { data } = await client.auth.getSession()
    return toSession(data.session?.user)
  },
  onSessionChange(cb) {
    client.auth.onAuthStateChange((_event, session) => cb(toSession(session?.user)))
  },
  async signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return toSession(data.user)!
  },
  async signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    // Supabase no dice que el correo ya existe (para no revelarlo): devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) throw new Error('User already registered')
  },
  async resendConfirmation(email) {
    const { error } = await client.auth.resend({ type: 'signup', email })
    if (error) throw new Error(error.message)
  },
  async signOut() {
    await client.auth.signOut()
  },
  businessStatus: (businessId) => rpc<BusinessStatus>('sync_business_status', { p_business: businessId }),
  claimBusiness: async (businessId) => {
    await rpc('sync_claim_business', { p_business: businessId })
  },
  myBusinesses: async () =>
    (await rpc<{ business_id: string; name: string }[]>('sync_my_businesses', {})).map((b) => ({ businessId: b.business_id, name: b.name })),
  getCatalogPage: (businessId) => rpc<CatalogPage | null>('sync_get_catalog', { p_business: businessId }),
  setCatalogPage: (businessId, slug, enabled) => rpc<CatalogPage>('sync_set_catalog', { p_business: businessId, p_slug: slug, p_enabled: enabled }),
  photos: {
    async upload(path, blob) {
      const { error } = await client.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw new Error(error.message)
    },
    async download(path) {
      const { data, error } = await client.storage.from(BUCKET).download(path)
      if (error || !data) throw new Error(error?.message ?? 'No se pudo descargar la foto')
      return data
    },
    async remove(paths) {
      await client.storage.from(BUCKET).remove(paths)
    },
  },
  push: (businessId: string, changes: Change[]) => rpc<Assigned[]>('sync_push', { p_business: businessId, p_changes: changes }),
  pull: (businessId: string, after: number, limit: number) => rpc<PullRow[]>('sync_pull', { p_business: businessId, p_after: after, p_limit: limit }),
}
