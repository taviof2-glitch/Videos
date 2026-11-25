// Dos dispositivos (dos bases Dexie) sincronizando contra el servidor real (Postgres con la migración).
// Se salta sin SYNC_PG_URL. El dispositivo A usa las funciones de src/data/; B es otra base.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from '../data/business'
import { docNumber } from '../data/folio'
import { createContact, deleteContact, updateContact } from '../data/contacts'
import { AppDB, db } from '../data/db'
import { createOrder } from '../data/orders'
import { createProduct, updateProduct } from '../data/products'
import { createQuote } from '../data/quotes'
import { createSale, updateSale } from '../data/transactions'
import type { Product, Quote } from '../data/types'
import { type PullRow, push, type SyncTransport, syncOnce, uploadAll } from './engine'
import type { PhotoStore } from './photos'
import { linkKey } from './tables'
import { createTestServer, PG_URL, type TestServer } from './pgTestServer'

describe.skipIf(!PG_URL)('sincronización entre dos dispositivos', () => {
  let s: TestServer
  let transport: SyncTransport
  let B: string
  const user = crypto.randomUUID()
  const b = new AppDB(`device-b-${crypto.randomUUID()}`)
  const syncA = () => syncOnce(db, transport, B)
  const syncB = () => syncOnce(b, transport, B)

  beforeAll(async () => {
    s = await createTestServer()
    transport = {
      push: (biz, changes) => s.rpc(user, 'sync_push', [biz, changes]),
      pull: (biz, after, limit) => s.rpc<PullRow[]>(user, 'sync_pull', [biz, after, limit]),
    }
  })
  afterAll(async () => {
    b.close()
    await s?.close()
  })
  beforeEach(async () => {
    await Promise.all([...db.tables, ...b.tables].map((t) => t.clear()))
    B = (await createBusiness({ name: 'Taller' })).id
    await s.rpc(user, 'sync_claim_business', [B])
  })

  it('subida inicial: lo que ya había en A llega completo a B y se puede cortar y seguir', async () => {
    const p = await createProduct(B, { name: 'Silla', priceCents: 85000, stock: 10, photos: [new Blob(['x'], { type: 'image/jpeg' })] })
    const c = await createContact(B, 'customer', { name: 'Ana' })
    await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 1000 }], contactId: c.id })
    const failing: SyncTransport = { ...transport, push: async (biz, ch) => (ch.some((x) => x.tbl === 'contact') ? Promise.reject(new Error('sin red')) : transport.push(biz, ch)) }
    await expect(uploadAll(db, failing, B)).rejects.toThrow('sin red')
    const progress: number[] = []
    await uploadAll(db, transport, B, (done) => progress.push(done))
    expect(progress[0]).toBeGreaterThan(0) // siguió donde se quedó
    expect(await db.outbox.count()).toBe(0)
    await syncB()
    expect((await b.business.get(B))?.name).toBe('Taller')
    const pb = (await b.product.get(p.id)) as Product
    expect(pb.stock).toBe(7)
    expect(pb.photos).toEqual([]) // las fotos van aparte (Storage)
    expect(await b.txnItem.count()).toBe(1)
    expect(await b.stockMovement.count()).toBe(2)
  })

  it('dos dispositivos venden el mismo producto sin red: el stock baja por las dos', async () => {
    const p = await createProduct(B, { name: 'Mesa', priceCents: 100000, stock: 10 })
    await syncA()
    await syncB()
    // A vende 3 (con las funciones normales); B vende 2 escribiendo como lo haría la app en ese dispositivo.
    await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 1000 }] })
    const now = new Date().toISOString()
    const saleB = crypto.randomUUID()
    await b.transaction('rw', [b.txn, b.txnItem, b.stockMovement, b.product], async () => {
      await b.txn.add({ id: saleB, businessId: B, type: 'sale', amountCents: 200000, concept: 'Mesa', date: now, paymentMethod: 'cash', status: 'paid', createdAt: now, updatedAt: now })
      await b.txnItem.add({ id: crypto.randomUUID(), transactionId: saleB, productId: p.id, name: 'Mesa', quantity: 2, unitPriceCents: 100000, unitCostCents: 0, position: 0 })
      await b.stockMovement.add({ id: crypto.randomUUID(), businessId: B, productId: p.id, transactionId: saleB, delta: -2, reason: 'sale', createdAt: now })
      await b.product.update(p.id, { stock: 8, updatedAt: now })
    })
    await syncB()
    await syncA()
    await syncB()
    expect((await db.product.get(p.id))?.stock).toBe(5)
    expect((await b.product.get(p.id))?.stock).toBe(5)
    expect(await db.txn.count()).toBe(2)
    expect(await db.outbox.count()).toBe(0)
    expect(await b.outbox.count()).toBe(0)
  })

  it('uno borra un cliente y el otro lo edita sin enterarse: queda borrado en los dos', async () => {
    const c = await createContact(B, 'customer', { name: 'Beto' })
    await syncA()
    await syncB()
    await deleteContact(c.id)
    await syncA()
    // B edita su copia vieja.
    await b.contact.update(c.id, { name: 'Beto Ruiz', updatedAt: new Date().toISOString() })
    await syncB()
    await syncA()
    expect((await b.contact.get(c.id))?.deletedAt).toBeTruthy()
    expect((await b.contact.get(c.id))?.name).toBe('Beto')
    expect((await db.contact.get(c.id))?.deletedAt).toBeTruthy()
  })

  it('la última edición que llega gana, con todas sus líneas', async () => {
    const p = await createProduct(B, { name: 'Banco', priceCents: 1000, stock: 20 })
    const s0 = await createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 1000 }] })
    await syncA()
    await syncB()
    await updateSale(s0.id, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 1000 }] })
    await syncA()
    await syncB()
    const items = await b.txnItem.where({ transactionId: s0.id }).toArray()
    expect(items.map((i) => i.quantity)).toEqual([4])
    expect((await b.product.get(p.id))?.stock).toBe(16)
    await updateContact((await createContact(B, 'customer', { name: 'X' })).id, { name: 'Y' })
    await syncA()
    await syncB()
    expect((await b.contact.toArray()).map((c) => c.name)).toEqual(['Y'])
  })

  it('folios: dos cotizaciones creadas sin red reciben números distintos', async () => {
    const c = await createContact(B, 'customer', { name: 'Cliente' })
    const q1 = await createQuote(B, { contactId: c.id, title: 'Cocina', validUntil: '2099-12-31', items: [{ name: 'Puerta', quantity: 1, unitPriceCents: 1000 }] })
    await syncA()
    await syncB()
    // Las dos sin red: A crea la 2; B también cree que es la 2.
    const qa = await createQuote(B, { contactId: c.id, title: 'Closet', validUntil: '2099-12-31', items: [{ name: 'Puerta', quantity: 1, unitPriceCents: 1000 }] })
    await db.quote.update(qa.id, { numberPending: true })
    const qb: Quote = { ...qa, id: crypto.randomUUID(), title: 'Baño', number: 2 }
    await b.quote.add({ ...qb, numberPending: true })
    await syncA()
    await syncB()
    await syncA()
    const numbers = (await db.quote.toArray()).map((q) => [q.title, q.number]).sort()
    expect(numbers).toEqual([['Baño', 3], ['Closet', 2], ['Cocina', q1.number]])
    expect((await b.quote.get(qb.id))?.number).toBe(3)
    expect((await b.quote.get(qb.id))?.numberPending).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
    // Los pedidos van aparte.
    const p = await createProduct(B, { name: 'Repisa', priceCents: 500, stock: 1 })
    const o = await createOrder(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 500 }] })
    await db.order.update(o.id, { numberPending: true })
    await syncA()
    expect((await db.order.get(o.id))?.number).toBe(1)
  })

  it('folios provisionales: con la cuenta conectada se crean con P-… y el servidor asigna el número al subir', async () => {
    await db.syncState.put({ key: linkKey(B), value: { businessId: B, userId: user, email: 'x@y.z' } })
    const c = await createContact(B, 'customer', { name: 'Cliente' })
    const mk = (title: string) => createQuote(B, { contactId: c.id, title, validUntil: '2099-12-31', items: [{ name: 'Puerta', quantity: 1, unitPriceCents: 1000 }] })
    const q1 = await mk('Cocina')
    const q2 = await mk('Closet')
    expect([q1.numberPending, q2.numberPending]).toEqual([true, true])
    expect(docNumber(q1)).toMatch(/^P-/)
    await syncA()
    const a1 = (await db.quote.get(q1.id))!
    const a2 = (await db.quote.get(q2.id))!
    expect([a1.numberPending, a2.numberPending]).toEqual([undefined, undefined])
    expect([a1.number, a2.number].sort()).toEqual([1, 2])
    expect(docNumber(a1)).toBe(`#${a1.number}`)
    await syncB()
    expect((await b.quote.get(q1.id))?.number).toBe(a1.number)
    const p = await createProduct(B, { name: 'Repisa', priceCents: 500, stock: 1 })
    const o = await createOrder(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 500 }] })
    expect(o.numberPending).toBe(true)
    await syncA()
    expect(await db.outbox.count()).toBe(0)
    expect(await db.order.get(o.id)).toMatchObject({ number: 1 })
    expect((await db.order.get(o.id))?.numberPending).toBeUndefined()
  })

  it('fotos: A sube las suyas, B las descarga, y quitar una en A la quita en B', async () => {
    const files = new Map<string, Blob>()
    const store: PhotoStore = {
      upload: async (path, blob) => void files.set(path, blob),
      download: async (path) => files.get(path) ?? Promise.reject(new Error('no existe')),
      remove: async (paths) => paths.forEach((x) => files.delete(x)),
    }
    const withPhotos: SyncTransport = { ...transport, photos: store }
    const jpg = (t: string) => new Blob([t], { type: 'image/jpeg' })
    const p = await createProduct(B, { name: 'Silla', priceCents: 1000, stock: 1, photos: [jpg('uno'), jpg('dos')] })
    await syncOnce(db, withPhotos, B)
    const paths = (await db.product.get(p.id))?.photoPaths ?? []
    expect(paths).toHaveLength(2)
    expect(paths.every((x) => x.startsWith(`${B}/${p.id}/`) && x.endsWith('.jpg'))).toBe(true)
    expect(files.size).toBe(2)
    expect(await db.outbox.count()).toBe(0) // photoPaths ya subió
    await syncOnce(b, withPhotos, B)
    expect(((await b.product.get(p.id))?.photoPaths ?? []).sort()).toEqual([...paths].sort())
    expect(await Promise.all(((await b.product.get(p.id))?.photos ?? []).map((x) => x.text()))).toEqual(['uno', 'dos'])
    expect(await b.outbox.count()).toBe(0) // descargar fotos no es un cambio propio
    // A quita la primera foto.
    await updateProduct(p.id, { photos: [(await db.product.get(p.id))!.photos[1]] })
    await syncOnce(db, withPhotos, B)
    expect(files.size).toBe(1)
    await syncOnce(b, withPhotos, B)
    expect(await Promise.all(((await b.product.get(p.id))?.photos ?? []).map((x) => x.text()))).toEqual(['dos'])
    // Sin cambios, una vuelta más no sube ni descarga nada.
    await syncOnce(db, withPhotos, B)
    expect(await db.outbox.count()).toBe(0)
  })

  it('fotos: una descarga que falla deja los datos al día y avisa el error', async () => {
    const files = new Map<string, Blob>()
    const good: PhotoStore = { upload: async (x, bl) => void files.set(x, bl), download: async (x) => files.get(x)!, remove: async () => undefined }
    const p = await createProduct(B, { name: 'Mesa', priceCents: 1000, stock: 1, photos: [new Blob(['m'], { type: 'image/jpeg' })] })
    await syncOnce(db, { ...transport, photos: good }, B)
    const bad: PhotoStore = { ...good, download: () => Promise.reject(new Error('Failed to fetch')) }
    await expect(syncOnce(b, { ...transport, photos: bad }, B)).rejects.toThrow('Failed to fetch')
    expect((await b.product.get(p.id))?.name).toBe('Mesa')
    await syncOnce(b, { ...transport, photos: good }, B)
    expect((await b.product.get(p.id))?.photos).toHaveLength(1)
  })

  it('catálogo en vivo: el pedido de un cliente llega solo a Conta con su número y los precios del servidor', async () => {
    const p = await createProduct(B, { name: 'Banca', priceCents: 70000, stock: 5, visibleInCatalog: true })
    await syncA()
    await s.rpc(user, 'sync_set_catalog', [B, `taller-${B.slice(0, 8)}`, true])
    const placed = await s.rpc<{ number: number; totalCents: number }>(null, 'place_order', [`taller-${B.slice(0, 8)}`, 'Olga', '', [{ p: p.id.slice(0, 8), q: 2 }]])
    expect(placed).toEqual({ number: 1, totalCents: 140000 })
    await syncA()
    const orders = await db.order.toArray()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ number: 1, customerName: 'Olga', source: 'catalog', status: 'pending', totalCents: 140000 })
    expect(await db.orderItem.where({ orderId: orders[0].id }).toArray()).toMatchObject([{ productId: p.id, quantity: 2, unitPriceCents: 70000, name: 'Banca' }])
    expect(await db.outbox.count()).toBe(0)
  })

  it('empleados: el dueño con PIN, sus empleados y quién registró cada venta viajan al otro aparato', async () => {
    const { setOwnerPin, createEmployee, login } = await import('../data/team')
    const owner = await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: ['expenses'] })
    await login(B, rosa.id, '1234')
    const venta = await createSale(B, { amountCents: 5000 })
    expect(venta.createdBy).toBe(rosa.id)
    await syncA()
    await syncB()
    expect((await b.employee.toArray()).map((e) => [e.name, e.role]).sort()).toEqual([['Dueño', 'owner'], ['Rosa', 'employee']])
    expect((await b.employee.get(rosa.id))?.permissions).toEqual(['expenses'])
    expect((await b.employee.get(owner.id))?.pinHash).toMatch(/^[0-9a-f]{64}$/)
    expect((await b.txn.get(venta.id))?.createdBy).toBe(rosa.id)
    // La sesión (quién está dentro) es de cada aparato: B no hereda la de A.
    expect(await b.meta.get(`activeUser:${B}`)).toBeUndefined()
  })

  it('si el envío falla, nada sale de la cola y el siguiente intento lo sube', async () => {
    await createContact(B, 'customer', { name: 'Dora' })
    const down: SyncTransport = { ...transport, push: () => Promise.reject(new Error('sin red')) }
    await expect(push(db, down, B)).rejects.toThrow('sin red')
    expect(await db.outbox.count()).toBeGreaterThan(0)
    await syncA()
    expect(await db.outbox.count()).toBe(0)
    await syncB()
    expect((await b.contact.toArray()).map((c) => c.name)).toEqual(['Dora'])
  })
})
