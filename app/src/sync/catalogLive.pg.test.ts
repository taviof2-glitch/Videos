// Catálogo en vivo y pedidos automáticos (0004_live_catalog.sql) contra un Postgres real.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestServer, PG_URL, type TestServer } from './pgTestServer'

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

describe.skipIf(!PG_URL)('catálogo en vivo', () => {
  let s: TestServer
  const owner = uuid()
  const stranger = uuid()
  const biz = uuid()
  const silla = uuid()
  const mesa = uuid()
  const oculto = uuid()
  const nogal = uuid()
  const natural = uuid()
  const cat = uuid()
  const row = (extra: Record<string, unknown>) => ({ id: uuid(), businessId: biz, createdAt: now(), updatedAt: now(), ...extra })
  const push = (changes: unknown[]) => s.rpc(owner, 'sync_push', [biz, changes])
  const short = (id: string) => id.slice(0, 8)
  const catalog = () => s.rpc<Record<string, any> | null>(null, 'public_catalog', ['taller-lopez'])
  const order = (items: unknown, who: string | null = null, slug = 'taller-lopez') => s.rpc<{ number: number; totalCents: number }>(who, 'place_order', [slug, 'Olga', 'Sábado', items])

  beforeAll(async () => {
    s = await createTestServer()
    await s.rpc(owner, 'sync_claim_business', [biz])
    await push([
      { tbl: 'business', row: { id: biz, name: 'Taller López', phone: '33 1', country: 'MX', currency: 'MXN', address: 'Reforma 1', openingHours: 'L-V', catalogNote: 'Hecho a mano', createdAt: now(), updatedAt: now() } },
      { tbl: 'category', row: row({ id: cat, kind: 'product', name: 'Sillas' }) },
      { tbl: 'product', row: row({ id: silla, name: 'Silla', priceCents: 85000, costCents: 40000, stock: 7, minStock: 2, categoryId: cat, visibleInCatalog: true, description: 'De pino', photos: [], photoPaths: [`${biz}/${silla}/aaaaaaaaaaaaaaaa.jpg`] }) },
      { tbl: 'product', row: row({ id: mesa, name: 'Mesa', priceCents: 200000, costCents: 90000, stock: 0, minStock: 0, visibleInCatalog: true, hasVariants: true }) },
      { tbl: 'productVariant', row: row({ id: nogal, productId: mesa, name: 'Nogal', priceCents: 250000, stock: 0, minStock: 0, position: 0 }) },
      { tbl: 'productVariant', row: row({ id: natural, productId: mesa, name: 'Natural', stock: 3, minStock: 0, position: 1 }) },
      { tbl: 'product', row: row({ id: oculto, name: 'Secreto', priceCents: 100, costCents: 1, stock: 1, minStock: 0 }) },
    ])
  })
  afterAll(async () => {
    await s?.close()
  })

  it('el dueño elige el nombre de su página; otro no puede, ni repetirlo', async () => {
    await expect(s.rpc(stranger, 'sync_set_catalog', [biz, 'robado', true])).rejects.toThrow('forbidden')
    await expect(s.rpc(owner, 'sync_set_catalog', [biz, 'Ab', true])).rejects.toThrow('bad_slug')
    await expect(s.rpc(owner, 'sync_set_catalog', [biz, 'con espacios', true])).rejects.toThrow('bad_slug')
    expect(await s.rpc(owner, 'sync_get_catalog', [biz])).toBeNull()
    expect(await s.rpc(owner, 'sync_set_catalog', [biz, 'Taller-Lopez', false])).toEqual({ slug: 'taller-lopez', enabled: false })
    expect(await s.rpc(owner, 'sync_get_catalog', [biz])).toEqual({ slug: 'taller-lopez', enabled: false })
    await expect(s.rpc(null, 'sync_get_catalog', [biz])).rejects.toThrow()
    // Otro negocio no puede quedarse con el mismo nombre.
    const biz2 = uuid()
    await s.rpc(stranger, 'sync_claim_business', [biz2])
    await expect(s.rpc(stranger, 'sync_set_catalog', [biz2, 'taller-lopez', true])).rejects.toThrow('slug_taken')
  })

  it('apagado, el catálogo no existe ni recibe pedidos', async () => {
    expect(await catalog()).toBeNull()
    await expect(order([{ p: short(silla), q: 1 }])).rejects.toThrow('not_found')
  })

  it('encendido, muestra solo lo visible y nunca costos ni existencias', async () => {
    await s.rpc(owner, 'sync_set_catalog', [biz, 'taller-lopez', true])
    const c = (await catalog())!
    expect(c.v).toBe(1)
    expect(c.business).toEqual({ name: 'Taller López', phone: '33 1', country: 'MX', address: 'Reforma 1', openingHours: 'L-V', currency: 'MXN', note: 'Hecho a mano' })
    expect(c.categories).toEqual(['Sillas'])
    expect(c.products.map((p: { name: string }) => p.name)).toEqual(['Mesa', 'Silla'])
    const sil = c.products.find((p: { name: string }) => p.name === 'Silla')
    expect(sil).toMatchObject({ id: short(silla), priceCents: 85000, category: 'Sillas', description: 'De pino', soldOut: false, photoPath: `${biz}/${silla}/aaaaaaaaaaaaaaaa.jpg` })
    const mes = c.products.find((p: { name: string }) => p.name === 'Mesa')
    expect(mes.soldOut).toBe(false) // una variante tiene existencias
    expect(mes.variants).toEqual([
      { id: short(nogal), name: 'Nogal', priceCents: 250000, soldOut: true },
      { id: short(natural), name: 'Natural', priceCents: 200000, soldOut: false },
    ])
    const text = JSON.stringify(c)
    for (const leak of ['costCents', 'stock', 'minStock', 'Secreto', '40000']) expect(text).not.toContain(leak)
    // Las fotos solo son públicas mientras el producto es visible y el catálogo está encendido.
    expect(await s.rpc(null, 'sync_photo_public', [`${biz}/${silla}/aaaaaaaaaaaaaaaa.jpg`])).toBe(true)
    expect(await s.rpc(null, 'sync_photo_public', [`${biz}/${silla}/bbbbbbbbbbbbbbbb.jpg`])).toBe(false)
    expect(await s.rpc(null, 'sync_photo_public', ['basura'])).toBe(false)
  })

  it('un pedido entra con precios del servidor y el siguiente folio, y llega al dueño por la descarga', async () => {
    // Precio y nombre que manda la página no cuentan: el servidor usa los suyos.
    const r = await order([{ p: short(silla), q: 2, c: 1 }, { p: short(mesa), v: short(nogal), q: 1 }])
    expect(r).toEqual({ number: 1, totalCents: 2 * 85000 + 250000 })
    expect((await order([{ p: short(silla), q: 1 }])).number).toBe(2)
    const rows = await s.rpc<{ tbl: string; data: Record<string, any>; parent_id: string | null }[]>(owner, 'sync_pull', [biz, 0, 1000])
    const o = rows.find((x) => x.tbl === 'order' && x.data.number === 1)!
    expect(o.data).toMatchObject({ customerName: 'Olga', notes: 'Sábado', status: 'pending', source: 'catalog', totalCents: 420000, businessId: biz })
    expect(o.data).not.toHaveProperty('numberPending')
    const lines = rows.filter((x) => x.tbl === 'orderItem' && x.parent_id === o.data.id).map((x) => x.data)
    expect(lines.map((l) => [l.name, l.quantity, l.unitPriceCents, l.position]).sort()).toEqual([['Mesa (Nogal)', 1, 250000, 1], ['Silla', 2, 85000, 0]].sort())
  })

  it('rechaza pedidos inválidos y no deja nada a medias', async () => {
    const before = (await s.rpc<unknown[]>(owner, 'sync_pull', [biz, 0, 1000])).length
    await expect(order([])).rejects.toThrow('bad_items')
    await expect(order({})).rejects.toThrow('bad_items')
    await expect(order([{ p: short(silla), q: 0 }])).rejects.toThrow('bad_quantity')
    await expect(order([{ p: short(silla), q: 1 }, { p: short(oculto), q: 1 }])).rejects.toThrow('product_unavailable')
    await expect(order([{ p: short(mesa), q: 1 }])).rejects.toThrow('product_unavailable') // falta la variante
    await expect(order([{ p: short(mesa), v: short(silla), q: 1 }])).rejects.toThrow('product_unavailable')
    expect((await s.rpc<unknown[]>(owner, 'sync_pull', [biz, 0, 1000])).length).toBe(before)
  })

  it('frena a quien manda demasiados pedidos seguidos', async () => {
    await s.admin('delete from order_throttle')
    for (let i = 0; i < 5; i++) await order([{ p: short(silla), q: 1 }])
    await expect(order([{ p: short(silla), q: 1 }])).rejects.toThrow('rate_limited')
  })

  it('el navegador no puede leer ni escribir las tablas nuevas', async () => {
    await expect(s.queryAs(null, 'select * from catalog_page')).rejects.toThrow()
    await expect(s.queryAs(owner, 'select * from order_throttle')).rejects.toThrow()
  })
})
