// Cuándo y cómo se sincroniza, y el estado que ven las pantallas (indicador de la cabecera y «Cuenta»).
// Sin servidor configurado (versión de claude.ai) todo queda en 'off' y la app funciona como antes.
import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from '../data/db'
import { accountError, type BusinessStatus, isNetworkError, type Session, type SyncBackend } from './backend'
import { pull, syncOnce, uploadAll } from './engine'
import { CHILD_TABLES, LEDGER_TABLES, LINK_KEY, ROW_TABLES } from './tables'

/** Negocio de este aparato que está conectado a la cuenta. */
export interface SyncLink {
  businessId: string
  userId: string
  email: string
}

export type SyncPhase = 'off' | 'signed-out' | 'not-linked' | 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  /** Hay servidor configurado en esta versión de la app. */
  available: boolean
  phase: SyncPhase
  session: Session | null
  link: SyncLink | null
  pending: number
  lastSyncAt?: string
  error?: string
}

/** Texto del estado para la cabecera y la pantalla de cuenta. */
export const PHASE_TEXT: Partial<Record<SyncPhase, string>> = {
  idle: 'Al día',
  syncing: 'Sincronizando…',
  offline: 'Sin conexión',
  error: 'Error al sincronizar',
}

const LAST_SYNC_KEY = 'lastSyncAt'
const CURRENT_BUSINESS = 'currentBusinessId'
const INTERVAL_MS = 60_000
const AFTER_WRITE_MS = 2_000

let backend: SyncBackend | null = null
let status: SyncStatus = { available: false, phase: 'off', session: null, link: null, pending: 0 }
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let debounce: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

function set(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  for (const l of listeners) l()
}

export const getSyncStatus = () => status
export function subscribeSync(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getSyncStatus)

function need(): SyncBackend {
  if (!backend) throw new Error('Esta versión de Conta no tiene servidor.')
  return backend
}

const readLink = async () => ((await db.syncState.get(LINK_KEY))?.value as SyncLink | undefined) ?? null

/** Arranca la sincronización (una vez, al abrir la app). */
export async function initSync(b: SyncBackend) {
  backend = b
  const [session, link, last] = await Promise.all([b.getSession().catch(() => null), readLink(), db.syncState.get(LAST_SYNC_KEY)])
  set({ available: true, session, link, lastSyncAt: last?.value as string | undefined })
  b.onSessionChange((s) => {
    if (s?.userId === status.session?.userId) return
    set({ session: s })
    refreshPhase()
  })
  liveQuery(() => db.outbox.count()).subscribe((pending) => {
    const grew = pending > status.pending
    set({ pending })
    if (grew) scheduleSoon()
  })
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void syncNow())
    window.addEventListener('offline', () => status.link && set({ phase: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  }
  refreshPhase()
}

function refreshPhase() {
  const { session, link } = status
  if (!session) {
    stopTimer()
    set({ phase: 'signed-out' })
  } else if (!link || link.userId !== session.userId) {
    stopTimer()
    set({ phase: 'not-linked' })
  } else {
    if (!timer) timer = setInterval(() => void syncNow(), INTERVAL_MS)
    void syncNow()
  }
}

/** Solo pruebas: detiene los temporizadores. */
export function stopSyncForTests() {
  stopTimer()
  clearTimeout(debounce)
}

function stopTimer() {
  clearInterval(timer)
  timer = undefined
}

function scheduleSoon() {
  if (!status.link || !status.session) return
  clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), AFTER_WRITE_MS)
}

/** Sincroniza ya (o justo al terminar la vuelta en curso). Nunca lanza: el error queda en el estado. */
export function syncNow(): Promise<void> {
  const { link, session } = status
  if (!backend || !link || !session || link.userId !== session.userId) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        set({ phase: 'offline' })
        break
      }
      set({ phase: 'syncing' })
      try {
        await syncOnce(db, backend!, link.businessId)
        const now = new Date().toISOString()
        await db.syncState.put({ key: LAST_SYNC_KEY, value: now })
        set({ phase: 'idle', lastSyncAt: now, error: undefined })
      } catch (e) {
        set(isNetworkError(e) ? { phase: 'offline' } : { phase: 'error', error: accountError(e) })
        break
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

// --- Cuenta ---

export async function signIn(email: string, password: string) {
  const session = await need().signIn(email.trim(), password)
  set({ session })
  refreshPhase()
  return session
}

export const signUp = (email: string, password: string) => need().signUp(email.trim(), password)
export const resendConfirmation = (email: string) => need().resendConfirmation(email.trim())

/** Cierra la sesión. Lo que no se subió se queda en la cola y sube al volver a entrar. */
export async function signOut() {
  await need().signOut()
  stopTimer()
  await db.syncState.delete(LINK_KEY)
  set({ session: null, link: null, phase: 'signed-out' })
}

export const businessStatus = (businessId: string): Promise<BusinessStatus> => need().businessStatus(businessId)
export const myBusinesses = () => need().myBusinesses()

/** Página pública del catálogo en vivo del negocio conectado. */
export const getCatalogPage = (businessId: string) => need().getCatalogPage(businessId)
export const setCatalogPage = (businessId: string, slug: string, enabled: boolean) => need().setCatalogPage(businessId, slug.trim().toLowerCase(), enabled)

async function saveLink(businessId: string) {
  const session = status.session
  if (!session) throw new Error('Primero inicia sesión.')
  const link: SyncLink = { businessId, userId: session.userId, email: session.email }
  await db.syncState.put({ key: LINK_KEY, value: link })
  set({ link })
  refreshPhase()
}

/**
 * Conecta el negocio de este aparato con la cuenta.
 * Si nadie lo ha subido, lo reclama y sube todos sus datos (reanudable). Si ya es de esta cuenta, solo conecta.
 */
export async function connectBusiness(businessId: string, onProgress?: (done: number, total: number) => void) {
  const b = need()
  const state = await b.businessStatus(businessId)
  if (state === 'forbidden') throw new Error('forbidden')
  if (state === 'unclaimed') await b.claimBusiness(businessId)
  // Sube todo lo de este aparato (también si ya era miembro: un intento anterior pudo cortarse).
  await uploadAll(db, b, businessId, onProgress)
  await saveLink(businessId)
  await syncNow()
}

const SYNCED = [...ROW_TABLES, ...LEDGER_TABLES, ...Object.keys(CHILD_TABLES)]

/** Si este aparato no tiene datos propios (solo, como mucho, el negocio vacío de la bienvenida). */
export async function deviceIsEmpty(): Promise<boolean> {
  const counts = await Promise.all(SYNCED.filter((t) => t !== 'business').map((t) => db.table(t).count()))
  return counts.every((n) => n === 0) && (await db.business.count()) <= 1
}

/** Aparato nuevo (p. ej. el del mostrador): descarga un negocio de la cuenta y lo deja como actual. */
export async function downloadBusiness(businessId: string) {
  const b = need()
  if (!(await deviceIsEmpty())) throw new Error('Este aparato ya tiene datos de otro negocio. Descarga una copia de seguridad antes de reemplazarlos.')
  // Quita el negocio vacío que se pudo crear en la bienvenida, junto con lo que dejó en la cola.
  await db.transaction('rw', [db.business, db.outbox, db.meta, db.syncState], async () => {
    await db.business.clear()
    await db.outbox.clear()
    await db.syncState.delete(`cursor:${businessId}`)
  })
  await pull(db, b, businessId)
  if (!(await db.business.get(businessId))) throw new Error('El negocio no tiene datos en el servidor.')
  await db.meta.put({ key: CURRENT_BUSINESS, value: businessId })
  await saveLink(businessId)
}

/** Restaurar una copia borra filas de verdad, y eso no se sincroniza: con la cuenta conectada no se permite. */
export const restoreBlocked = () => status.link !== null
