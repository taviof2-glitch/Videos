import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from '../data/business'
import { db } from '../data/db'
import type { SyncBackend } from './backend'
import { fetchWithTimeout } from './supabase'
import { getSyncStatus, initSync, setRoundTimeoutForTests, stopSyncForTests, syncNow } from './runner'
import { linkKey } from './tables'

const session = { userId: 'u1', email: 'duena@example.com' }

function fakeBackend(hangFirstPush: boolean): SyncBackend & { pushes: number } {
  const b = {
    pushes: 0,
    getSession: async () => session,
    onSessionChange: () => undefined,
    signIn: async () => session,
    signUp: async () => undefined,
    resendConfirmation: async () => undefined,
    signOut: async () => undefined,
    businessStatus: async () => 'member' as const,
    claimBusiness: async () => undefined,
    myBusinesses: async () => [],
    getCatalogPage: async () => null,
    setCatalogPage: async () => ({ slug: 'x', enabled: true }),
    push: async () => {
      b.pushes++
      if (hangFirstPush && b.pushes === 1) return new Promise<never>(() => undefined) // una petición que nunca contesta
      return []
    },
    pull: async () => [],
  }
  return b
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})
afterEach(() => {
  stopSyncForTests()
  setRoundTimeoutForTests(90_000)
})

describe('sincronización colgada', () => {
  it('suelta la vuelta que no termina y la siguiente sincroniza normal', async () => {
    const biz = await createBusiness({ name: 'Muebles' }) // deja algo en la cola para que haya que subir
    await db.syncState.put({ key: linkKey(biz.id), value: { businessId: biz.id, ...session } })
    setRoundTimeoutForTests(60)
    const backend = fakeBackend(true)
    await initSync(backend)
    await syncNow()
    expect(getSyncStatus().phase).toBe('offline') // «Sin conexión», no «Sincronizando…» para siempre
    await syncNow()
    expect(getSyncStatus().phase).toBe('idle')
    expect(backend.pushes).toBeGreaterThanOrEqual(2)
  })
})

describe('fetchWithTimeout', () => {
  it('corta una petición que no contesta', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = ((_: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)))) as typeof fetch
    try {
      await expect(fetchWithTimeout('https://example.invalid', {}, 20)).rejects.toThrow(/timeout/)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
