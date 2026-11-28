// Cuándo y cómo se sincroniza, y el estado que ven las pantallas (indicador de la cabecera y «Cuenta»).
// Sin servidor configurado (versión de claude.ai) todo queda en 'off' y la app funciona como antes.
import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from '../data/db'
import { accountError, type BusinessStatus, isNetworkError, type Session, type SyncBackend } from './backend'
import { diag } from './diag'
import { onOutboxWrite } from './outbox'
import { pull, syncData, syncPhotosRound, uploadAll } from './engine'
import { CHILD_TABLES, LEDGER_TABLES, LINK_PREFIX, linkKey, ROW_TABLES } from './tables'

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
  /** En qué va la vuelta en curso (para la pantalla de cuenta). */
  step?: string
  /** El paso exacto, con detalle técnico (para diagnosticar). */
  detail?: string
  /** Último fallo, también los de red (los de red no se muestran como «Error», pero sirven para diagnosticar). */
  lastProblem?: string
  /** Fallo de las fotos: no detiene los datos. */
  photoProblem?: string
}

const STEP_TEXT: Record<string, string> = { push: 'Subiendo cambios', pull: 'Descargando cambios', photos: 'Fotos' }
/** El texto de un paso (sin el detalle técnico que va tras los dos puntos). */
const stepText = (step: string) => STEP_TEXT[step.split(':')[0]] ?? step

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200)

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
let afterWriteMs = 2_000
/**
 * Tope de una vuelta por negocio. Si algo se queda colgado (una petición que el celular congeló en segundo plano),
 * la vuelta se suelta, la cabecera deja de decir «Sincronizando…» y el siguiente intento empieza de cero.
 */
let roundTimeoutMs = 90_000

/** Solo pruebas: acorta la espera tras escribir. */
export function setWriteDelayForTests(ms: number) {
  afterWriteMs = ms
}

/** Solo pruebas: acorta el tope de una vuelta. */
export function setRoundTimeoutForTests(ms: number) {
  roundTimeoutMs = ms
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout: la sincronización tardó demasiado')), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

let backend: SyncBackend | null = null
/** Negocios de este aparato conectados a la cuenta (T14: puede haber varios) y cuál está abierto. */
let links: SyncLink[] = []
let currentId: string | undefined
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
  if (!backend) throw new Error('Esta versión de Houselite no tiene servidor.')
  return backend
}

async function readLinks(): Promise<SyncLink[]> {
  // Antes de T14 había una sola conexión, guardada en la fila «link».
  const legacy = (await db.syncState.get('link'))?.value as SyncLink | undefined
  if (legacy?.businessId) {
    await db.transaction('rw', db.syncState, async () => {
      await db.syncState.put({ key: linkKey(legacy.businessId), value: legacy })
      await db.syncState.delete('link')
    })
  }
  const rows = await db.syncState.where('key').startsWith(LINK_PREFIX).toArray()
  return rows.map((r) => r.value as SyncLink)
}

/** Las conexiones que sirven con la sesión actual. */
const userLinks = () => links.filter((l) => l.userId === status.session?.userId)
const linkOfCurrent = () => links.find((l) => l.businessId === currentId) ?? null

/** Arranca la sincronización (una vez, al abrir la app). */
export async function initSync(b: SyncBackend) {
  backend = b
  const [session, found, last, current] = await Promise.all([b.getSession().catch(() => null), readLinks(), db.syncState.get(LAST_SYNC_KEY), db.meta.get(CURRENT_BUSINESS)])
  links = found
  currentId = current?.value
  set({ available: true, session, link: linkOfCurrent(), lastSyncAt: last?.value as string | undefined })
  diag('inicio', { session: !!session, links: found.length, current: !!currentId, lastSyncAt: last?.value })
  b.onSessionChange((s) => {
    if (s?.userId === status.session?.userId) return
    set({ session: s })
    refreshPhase()
  })
  // Al cambiar de negocio la cabecera y la cuenta muestran la conexión del que quedó abierto.
  liveQuery(() => db.meta.get(CURRENT_BUSINESS)).subscribe((row) => {
    currentId = row?.value
    set({ link: linkOfCurrent() })
    refreshPhase()
  })
  const refreshPending = (pending: number) => {
    const grew = pending > status.pending
    set({ pending })
    if (grew) scheduleSoon()
  }
  liveQuery(() => db.outbox.count()).subscribe(refreshPending)
  // Lo que se guarda en la app llega a la cola por debajo de liveQuery: sin este aviso se esperaba al reloj de 60 s.
  onOutboxWrite(() => void db.outbox.count().then(refreshPending))
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void syncNow())
    window.addEventListener('offline', () => userLinks().length > 0 && set({ phase: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void syncNow())
  }
  refreshPhase()
}

function refreshPhase() {
  const { session, link } = status
  if (!session) {
    stopTimer()
    set({ phase: 'signed-out' })
  } else if (userLinks().length === 0) {
    stopTimer()
    set({ phase: 'not-linked' })
  } else if (!link || link.userId !== session.userId) {
    // Hay negocios conectados, pero no el que está abierto: se siguen sincronizando los demás.
    if (!timer) timer = setInterval(() => void syncNow(), INTERVAL_MS)
    set({ phase: 'not-linked' })
    void syncNow()
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
  if (userLinks().length === 0) return
  clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), afterWriteMs)
}

/** Sincroniza ya (o justo al terminar la vuelta en curso). Nunca lanza: el error queda en el estado. */
export function syncNow(): Promise<void> {
  const mine = userLinks()
  if (!backend || mine.length === 0) return Promise.resolve()
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
      set({ phase: 'syncing', step: undefined, detail: undefined })
      // Si la vuelta lleva 20 s, se avisa en qué paso exacto va (sin esperar a que se rinda).
      const watchdog = setTimeout(() => diag('atorado', { detail: status.detail, pending: status.pending }), 20_000)
      try {
        for (const l of mine) {
          await withTimeout(syncData(db, backend!, l.businessId, (step) => set({ step: stepText(step), detail: step })), roundTimeoutMs)
        }
        const now = new Date().toISOString()
        await db.syncState.put({ key: LAST_SYNC_KEY, value: now })
        set({ phase: status.link ? 'idle' : 'not-linked', lastSyncAt: now, error: undefined, lastProblem: undefined, step: undefined })
        clearTimeout(watchdog)
        diag('al-dia')
      } catch (e) {
        clearTimeout(watchdog)
        const problem = `${status.detail ?? status.step ?? 'Inicio'}: ${errorText(e)}`
        diag('fallo', { problem, pending: status.pending })
        set(isNetworkError(e) ? { phase: 'offline', lastProblem: problem, step: undefined } : { phase: 'error', error: accountError(e), lastProblem: problem, step: undefined })
        break
      }
      // Las fotos, aparte: si fallan o tardan, los datos ya quedaron al día y la cabecera dice «Al día».
      try {
        for (const l of mine) await withTimeout(syncPhotosRound(db, backend!, l.businessId), roundTimeoutMs)
        if (status.photoProblem) set({ photoProblem: undefined })
      } catch (e) {
        set({ photoProblem: errorText(e) })
        diag('fotos', { problem: errorText(e) })
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
  await db.syncState.where('key').startsWith(LINK_PREFIX).delete()
  links = []
  set({ session: null, link: null, phase: 'signed-out' })
}

/** Credencial de la sesión abierta, para el asistente. Sin cuenta (o en la versión de prueba) no hay. */
export const sessionToken = async (): Promise<string | undefined> => backend?.accessToken?.()

export const businessStatus = (businessId: string): Promise<BusinessStatus> => need().businessStatus(businessId)
export const myBusinesses = () => need().myBusinesses()

/** Página pública del catálogo en vivo del negocio conectado. */
export const getCatalogPage = (businessId: string) => need().getCatalogPage(businessId)
export const setCatalogPage = (businessId: string, slug: string, enabled: boolean) => need().setCatalogPage(businessId, slug.trim().toLowerCase(), enabled)

async function saveLink(businessId: string) {
  const session = status.session
  if (!session) throw new Error('Primero inicia sesión.')
  const link: SyncLink = { businessId, userId: session.userId, email: session.email }
  await db.syncState.put({ key: linkKey(businessId), value: link })
  links = [...links.filter((l) => l.businessId !== businessId), link]
  currentId = (await db.meta.get(CURRENT_BUSINESS))?.value
  set({ link: linkOfCurrent() })
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

/** Descarga un negocio de la cuenta y lo deja como actual: en un aparato nuevo (p. ej. el del mostrador) o como un negocio más (T14). */
export async function downloadBusiness(businessId: string) {
  const b = need()
  if (await db.business.get(businessId)) throw new Error('Ese negocio ya está en este aparato.')
  if (await deviceIsEmpty()) {
    // Quita el negocio vacío que se pudo crear en la bienvenida, junto con lo que dejó en la cola.
    await db.transaction('rw', [db.business, db.outbox, db.meta, db.syncState], async () => {
      await db.business.clear()
      await db.outbox.clear()
      await db.syncState.delete(`cursor:${businessId}`)
    })
  } else {
    // T14: el aparato ya tiene otros negocios; este se suma sin tocarlos.
    await db.syncState.delete(`cursor:${businessId}`)
  }
  await pull(db, b, businessId)
  if (!(await db.business.get(businessId))) throw new Error('El negocio no tiene datos en el servidor.')
  await db.meta.put({ key: CURRENT_BUSINESS, value: businessId })
  await saveLink(businessId)
}

/** Restaurar una copia borra filas de verdad, y eso no se sincroniza: con la cuenta conectada no se permite. */
export const restoreBlocked = () => links.length > 0
