// Cuenta, conexión del negocio y aparato nuevo, contra el servidor real (Postgres) con una sesión simulada.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createBusiness, getCurrentBusiness } from '../data/business'
import { createContact } from '../data/contacts'
import { db } from '../data/db'
import { DEFAULT_EXPENSE_CATEGORIES } from '../data/categories'
import { createProduct } from '../data/products'
import type { Session, SyncBackend } from './backend'
import type { PullRow } from './engine'
import { createTestServer, PG_URL, type TestServer } from './pgTestServer'
import { connectBusiness, deviceIsEmpty, downloadBusiness, getSyncStatus, initSync, myBusinesses, restoreBlocked, signIn, signOut, stopSyncForTests, syncNow } from './runner'

describe.skipIf(!PG_URL)('cuenta y conexión del negocio', () => {
  let s: TestServer
  let session: Session | null = null
  const users: Record<string, string> = { 'duena@taller.mx': crypto.randomUUID(), 'otra@x.mx': crypto.randomUUID() }
  const uid = () => {
    if (!session) throw new Error('not_authenticated')
    return session.userId
  }
  const backend: SyncBackend = {
    getSession: async () => session,
    onSessionChange: () => {},
    signIn: async (email, password) => {
      if (!users[email] || password !== 'secreta123') throw new Error('Invalid login credentials')
      session = { userId: users[email], email }
      return session
    },
    signUp: async () => {},
    resendConfirmation: async () => {},
    signOut: async () => {
      session = null
    },
    businessStatus: (b) => s.rpc(uid(), 'sync_business_status', [b]),
    claimBusiness: async (b) => {
      await s.rpc(uid(), 'sync_claim_business', [b])
    },
    myBusinesses: async () => (await s.rpc<{ business_id: string; name: string }[]>(uid(), 'sync_my_businesses', [])).map((r) => ({ businessId: r.business_id, name: r.name })),
    getCatalogPage: (b) => s.rpc(uid(), 'sync_get_catalog', [b]),
    setCatalogPage: (b, slug, enabled) => s.rpc(uid(), 'sync_set_catalog', [b, slug, enabled]),
    push: (b, changes) => s.rpc(uid(), 'sync_push', [b, changes]),
    pull: (b, after, limit) => s.rpc<PullRow[]>(uid(), 'sync_pull', [b, after, limit]),
  }

  beforeAll(async () => {
    s = await createTestServer()
    await initSync(backend)
  })
  afterAll(async () => {
    stopSyncForTests()
    await s?.close()
  })
  beforeEach(async () => {
    if (session) await signOut()
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  it('entra, sube el negocio de este aparato y otro aparato vacío lo descarga', async () => {
    const biz = await createBusiness({ name: 'Carpintería López' })
    const p = await createProduct(biz.id, { name: 'Silla', priceCents: 1000, stock: 4 })
    await createContact(biz.id, 'customer', { name: 'Ana' })
    await expect(signIn('duena@taller.mx', 'mala')).rejects.toThrow(/Invalid login/)
    await signIn('duena@taller.mx', 'secreta123')
    expect(getSyncStatus().phase).toBe('not-linked')
    expect(restoreBlocked()).toBe(false)
    const progress: number[] = []
    await connectBusiness(biz.id, (done) => progress.push(done))
    expect(progress.at(-1)).toBe(4 + DEFAULT_EXPENSE_CATEGORIES.length) // negocio, producto, su movimiento de stock, el contacto y las categorías de gasto
    expect(getSyncStatus()).toMatchObject({ phase: 'idle', pending: 0, link: { businessId: biz.id, email: 'duena@taller.mx' } })
    expect(restoreBlocked()).toBe(true)
    expect(await myBusinesses()).toEqual([{ businessId: biz.id, name: 'Carpintería López' }])

    // Un cambio nuevo sube con la siguiente vuelta.
    await createContact(biz.id, 'customer', { name: 'Beto' })
    await syncNow()
    expect(await db.outbox.count()).toBe(0)

    // Aparato nuevo: se borra todo lo local (como un navegador recién estrenado) y se descarga.
    await signOut()
    await Promise.all(db.tables.map((t) => t.clear()))
    expect(await deviceIsEmpty()).toBe(true)
    await signIn('duena@taller.mx', 'secreta123')
    await downloadBusiness(biz.id)
    expect((await getCurrentBusiness())?.name).toBe('Carpintería López')
    expect((await db.product.get(p.id))?.stock).toBe(4)
    expect((await db.contact.toArray()).map((c) => c.name).sort()).toEqual(['Ana', 'Beto'])
    expect(await db.outbox.count()).toBe(0)
    expect(getSyncStatus().link?.businessId).toBe(biz.id)
  })

  it('otra cuenta no puede conectar un negocio ajeno, y un aparato con datos no se reemplaza', async () => {
    const biz = await createBusiness({ name: 'Taller' })
    await signIn('duena@taller.mx', 'secreta123')
    await connectBusiness(biz.id)
    await signOut()
    await signIn('otra@x.mx', 'secreta123')
    await expect(connectBusiness(biz.id)).rejects.toThrow(/forbidden/)
    expect(getSyncStatus().phase).toBe('not-linked')
    await createContact(biz.id, 'customer', { name: 'Local' })
    await expect(downloadBusiness(biz.id)).rejects.toThrow(/ya tiene datos/)
  })

  it('cerrar sesión deja lo pendiente en la cola', async () => {
    const biz = await createBusiness({ name: 'Taller' })
    await signIn('duena@taller.mx', 'secreta123')
    await connectBusiness(biz.id)
    await signOut()
    await createContact(biz.id, 'customer', { name: 'Sin subir' })
    expect(await db.outbox.count()).toBe(1)
    expect(getSyncStatus().phase).toBe('signed-out')
  })
})
