// Conexión real con Supabase. Solo se carga en la app instalable (no en la versión de claude.ai).
// La URL y la clave «publishable» son públicas por diseño: el acceso lo controlan las funciones del servidor.
import { createClient } from '@supabase/supabase-js'
import type { BusinessStatus, CatalogPage, Session, SyncBackend } from './backend'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { diag } from './diag'
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

/**
 * Cada intento espera poco: en el celular una conexión «dormida» deja la petición colgada hasta un minuto.
 * Si el intento se cuelga se cancela y se vuelve a pedir (el navegador abre una conexión nueva). Subir y bajar es repetible sin riesgo.
 */
const ATTEMPT_TIMEOUT_MS = 12_000
export async function fetchRetrying(input: RequestInfo | URL, init: RequestInit = {}, ms = ATTEMPT_TIMEOUT_MS): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init, ms)
  } catch (e) {
    const ours = e instanceof Error && /^timeout/.test(e.message)
    if (!ours || init.signal?.aborted) throw e
    diag('reintento', { url: String(input).replace(SUPABASE_URL, '').slice(0, 60) })
    return fetchWithTimeout(input, init, ms)
  }
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // La sesión se queda guardada en el aparato (el del mostrador no pide contraseña cada vez).
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'conta-auth' },
  global: { fetch: fetchRetrying },
})

const BUCKET = 'product-photos'

const toSession = (u: { id: string; email?: string } | null | undefined): Session | null => (u ? { userId: u.id, email: u.email ?? '' } : null)

/** Tope de una llamada completa, incluida la parte que no es red (leer la sesión guardada): si se cuelga, se sabe cuál fue. */
const CALL_TIMEOUT_MS = 45_000

function capped<T>(what: string, p: PromiseLike<T>, ms = CALL_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const slow = setTimeout(() => diag('lento', { what, seg: Math.round((Date.now() - started) / 1000) }), 8_000)
    const t = setTimeout(() => {
      diag('colgado', { what })
      reject(new Error(`timeout: ${what} no respondió`))
    }, ms)
    p.then(
      (v) => {
        clearTimeout(t)
        clearTimeout(slow)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        clearTimeout(slow)
        reject(e)
      },
    )
  })
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await capped(fn, client.rpc(fn, args))
  if (error) throw new Error(error.message)
  return data as T
}

export const supabaseBackend: SyncBackend = {
  async getSession() {
    const { data } = await capped('getSession', client.auth.getSession(), 15_000)
    return toSession(data.session?.user)
  },
  async accessToken() {
    const { data } = await capped('getSession', client.auth.getSession(), 15_000)
    return data.session?.access_token
  },
  onSessionChange(cb) {
    client.auth.onAuthStateChange((_event, session) => cb(toSession(session?.user)))
  },
  async signIn(email, password) {
    const { data, error } = await capped('signIn', client.auth.signInWithPassword({ email, password }))
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
