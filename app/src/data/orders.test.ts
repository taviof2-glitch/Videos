import { beforeEach, describe, expect, it } from 'vitest'
import { balanceForRange } from './balance'
import { buildCatalog, catalogFileName, catalogIssues, parseCatalog, shortId } from './catalog'
import { createContact } from './contacts'
import { db } from './db'
import { buildOrderMessage, decodeOrderCode, encodeOrderCode, findOrderCode, type OrderCodePayload } from './orderCode'
import { cancelOrder, createOrder, getOrder, getOrderItems, listOrders, orderDraftFromMessage, payOrder, reopenOrder, setOrderStatus, updateOrder } from './orders'
import { createProduct, getProduct, stockFromMovements } from './products'
import { getItems, getTransaction, updateSale, voidTransaction } from './transactions'
import type { Business } from './types'
import { listVariants, setVariantAttributes, updateVariant } from './variants'

const B = 'negocio-1'
const business: Business = { id: B, name: 'Carpintería López', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', phone: '33 1234 5678', address: 'Reforma 123', openingHours: 'L-V 9 a 6', catalogNote: 'Hechos a mano', createdAt: '', updatedAt: '' }

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('código de pedido', () => {
  const payload: OrderCodePayload = { n: 'Olga Acevedo ñandú 😀', m: 'Entregar el sábado\ncon "cuidado" & <prisa>', i: [{ p: 'ab12cd34', q: 2, c: 350000 }, { p: 'ef56ab78', v: '99aa88bb', q: 1.5, c: 12050 }] }

  it('se escribe y se lee igual, con acentos, emoji y saltos de línea', () => {
    const code = encodeOrderCode(payload)
    expect(code).toMatch(/^CP1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/)
    expect(decodeOrderCode(code)).toEqual({ ok: true, payload })
  })

  it('se encuentra dentro del mensaje completo de WhatsApp', () => {
    const code = encodeOrderCode(payload)
    const msg = buildOrderMessage({ businessName: 'Carpintería López', lines: [{ quantity: 2, name: 'Librero', totalCents: 700000 }], totalCents: 700000, customer: 'Olga', notes: '', code, money: (c) => `$${c / 100}` })
    expect(msg).toContain('2 × Librero — $7000')
    expect(msg).toContain('Total: $7000')
    expect(msg).toContain('Nombre: Olga')
    expect(msg).not.toContain('Notas:')
    expect(findOrderCode(msg)).toBe(code)
    expect(decodeOrderCode(`  ${msg}\n\n(reenviado)  `)).toMatchObject({ ok: true })
  })

  it('detecta códigos cortados, alterados o que no son de pedido', () => {
    const code = encodeOrderCode(payload)
    const [pre, data, crc] = code.split('.')
    expect(decodeOrderCode(`${pre}.${data.slice(0, -4)}`)).toMatchObject({ ok: false, error: expect.stringMatching(/incompleto/) })
    expect(decodeOrderCode(`${pre}.${data.slice(0, -2)}XX.${crc}`)).toMatchObject({ ok: false, error: expect.stringMatching(/dañado/) })
    expect(decodeOrderCode('hola, quiero comprar un librero')).toMatchObject({ ok: false, error: expect.stringMatching(/No encontré/) })
    expect(decodeOrderCode('')).toMatchObject({ ok: false })
  })

  it('rechaza datos con forma inválida aunque el CRC sea correcto', () => {
    const bad = (p: unknown) => decodeOrderCode(encodeOrderCode(p as OrderCodePayload))
    expect(bad({ i: [] })).toMatchObject({ ok: false })
    expect(bad({})).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x', q: 0, c: 1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x', q: -1, c: 1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x', q: 1, c: 1.5 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x', q: Number.NaN, c: 1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x', q: 1, c: 'abc' }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'a,b', q: 1, c: 1 }] })).toMatchObject({ ok: false }) // un id con coma no se cuela
    expect(bad({ i: [{ p: 'x', q: 1, c: -1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: '', q: 1, c: 1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: [{ p: 'x'.repeat(40), q: 1, c: 1 }] })).toMatchObject({ ok: false })
    expect(bad({ i: Array.from({ length: 101 }, () => ({ p: 'a', q: 1, c: 1 })) })).toMatchObject({ ok: false })
    const long = decodeOrderCode(encodeOrderCode({ n: 'x'.repeat(500), m: 'y'.repeat(900), i: [{ p: 'a', q: 1, c: 1 }] }))
    expect(long).toMatchObject({ ok: true, payload: { n: 'x'.repeat(80), m: 'y'.repeat(300) } })
  })

  it('un pedido grande sigue cabiendo en un enlace de WhatsApp', () => {
    const big: OrderCodePayload = { n: 'Cliente', i: Array.from({ length: 40 }, (_, i) => ({ p: `p${String(i).padStart(7, '0')}`, v: `v${String(i).padStart(7, '0')}`, q: 3, c: 123456 })) }
    expect(encodeOrderCode(big).length).toBeLessThan(2000)
  })
})

async function tienda() {
  const silla = await createProduct(B, { name: 'Silla de pino', priceCents: 85000, costCents: 40000, stock: 10 })
  const mesa = await createProduct(B, { name: 'Mesa', priceCents: 300000, costCents: 200000, stock: 5 })
  return { silla, mesa }
}
const line = (productId: string, quantity: number, unitPriceCents: number, variantId?: string) => ({ productId, variantId, quantity, unitPriceCents })

describe('pedidos', () => {
  it('se numeran por negocio, calculan el total y validan', async () => {
    const { silla, mesa } = await tienda()
    const a = await createOrder(B, { customerName: ' Olga ', notes: ' Para el sábado ', items: [line(silla.id, 4, 85000), line(mesa.id, 1, 300000)] })
    const b = await createOrder(B, { items: [line(silla.id, 1, 85000)] })
    expect(a).toMatchObject({ number: 1, customerName: 'Olga', notes: 'Para el sábado', status: 'pending', totalCents: 640000, source: 'manual' })
    expect(b.number).toBe(2)
    expect((await createOrder('otro', { items: [line((await createProduct('otro', { name: 'X' })).id, 1, 1)] })).number).toBe(1)
    expect((await getOrderItems(a.id)).map((i) => [i.name, i.quantity])).toEqual([['Silla de pino', 4], ['Mesa', 1]])
    await expect(createOrder(B, { items: [] })).rejects.toThrow(/al menos un producto/)
    await expect(createOrder(B, { items: [line(silla.id, 0, 1)] })).rejects.toThrow(/cantidad/)
    await expect(createOrder(B, { items: [line(silla.id, 1, -1)] })).rejects.toThrow(/precio/)
    await expect(createOrder(B, { items: [line('nope', 1, 1)] })).rejects.toThrow(/ya no existe/)
    expect((await listOrders(B)).map((o) => o.number)).toEqual([2, 1])
  })

  it('editar reemplaza los productos solo mientras está abierto', async () => {
    const { silla, mesa } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 4, 85000)] })
    const u = await updateOrder(o.id, { customerName: 'Beto', items: [line(mesa.id, 2, 290000)] })
    expect(u).toMatchObject({ customerName: 'Beto', totalCents: 580000, number: 1 })
    expect((await getOrderItems(o.id)).map((i) => i.name)).toEqual(['Mesa'])
    await expect(updateOrder(o.id, { items: [line('nope', 1, 1)] })).rejects.toThrow()
    expect((await getOrderItems(o.id))).toHaveLength(1) // el error no deja nada a medias
    await setOrderStatus(o.id, 'processing')
    await expect(updateOrder(o.id, { items: [line(silla.id, 1, 1)] })).resolves.toBeTruthy()
    await cancelOrder(o.id)
    await expect(updateOrder(o.id, { items: [line(silla.id, 1, 1)] })).rejects.toThrow(/Reabre/)
  })

  it('pendiente ↔ en proceso, y solo estando abierto', async () => {
    const { silla } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 1, 1000)] })
    await setOrderStatus(o.id, 'processing')
    expect((await getOrder(o.id))!.status).toBe('processing')
    await setOrderStatus(o.id, 'pending')
    expect((await getOrder(o.id))!.status).toBe('pending')
    await cancelOrder(o.id)
    await expect(setOrderStatus(o.id, 'processing')).rejects.toThrow(/abierto/)
  })
})

describe('cobrar un pedido', () => {
  it('crea la venta (balance e inventario) y deja el pedido pagado', async () => {
    const { silla, mesa } = await tienda()
    const olga = await createContact(B, 'customer', { name: 'Olga' })
    const o = await createOrder(B, { customerName: 'Olga', items: [line(silla.id, 4, 80000), line(mesa.id, 1, 300000)] })
    const { order, sale } = await payOrder(o.id, { method: 'transfer', contactId: olga.id })
    expect(order).toMatchObject({ status: 'paid', transactionId: sale.id })
    expect(sale).toMatchObject({ type: 'sale', amountCents: 620000, status: 'paid', paymentMethod: 'transfer', contactId: olga.id, orderId: o.id, concept: 'Pedido #1 · Olga' })
    expect((await getItems(sale.id)).map((i) => [i.name, i.quantity, i.unitPriceCents])).toEqual([['Silla de pino', 4, 80000], ['Mesa', 1, 300000]])
    expect((await getProduct(silla.id))!.stock).toBe(6)
    expect(await stockFromMovements(silla.id)).toBe(6)
    expect((await balanceForRange(B)).incomeCents).toBe(620000)
    await expect(payOrder(o.id)).rejects.toThrow(/ya está pagado/)
  })

  it('si un producto ya no existe no queda venta ni cambia el pedido', async () => {
    const { silla, mesa } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 1, 1000), line(mesa.id, 1, 1000)] })
    await db.product.delete(mesa.id)
    await expect(payOrder(o.id)).rejects.toThrow(/ya no existe/)
    expect(await db.txn.count()).toBe(0)
    expect((await getProduct(silla.id))!.stock).toBe(10)
    expect((await getOrder(o.id))!.status).toBe('pending')
  })

  it('no se puede editar ni anular por fuera la venta de un pedido', async () => {
    const { silla } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 1, 1000)] })
    const { sale } = await payOrder(o.id)
    await expect(voidTransaction(sale.id)).rejects.toThrow(/viene de un pedido/)
    await expect(updateSale(sale.id, { amountCents: 5 })).rejects.toThrow(/viene de un pedido/)
    expect((await getTransaction(sale.id))!.deletedAt).toBeUndefined()
    expect((await getProduct(silla.id))!.stock).toBe(9)
  })

  it('cancelar un pedido pagado anula la venta, devuelve el inventario y saca el dinero del balance; se puede reabrir', async () => {
    const { silla } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 3, 85000)] })
    const { sale } = await payOrder(o.id)
    await cancelOrder(o.id)
    expect(await getTransaction(sale.id)).toBeUndefined()
    expect((await getProduct(silla.id))!.stock).toBe(10)
    expect(await stockFromMovements(silla.id)).toBe(10)
    expect((await balanceForRange(B)).incomeCents).toBe(0)
    expect((await getOrder(o.id))!.status).toBe('cancelled')
    expect((await getOrder(o.id))!.transactionId).toBeUndefined() // ya no apunta a ninguna venta
    await expect(cancelOrder(o.id)).rejects.toThrow(/ya está cancelado/)
    await reopenOrder(o.id)
    const again = await payOrder(o.id) // se puede cobrar de nuevo
    expect(again.sale.id).not.toBe(sale.id)
    expect((await getProduct(silla.id))!.stock).toBe(7)
    await expect(reopenOrder(o.id)).rejects.toThrow(/cancelado/)
  })

  it('cancelar uno sin cobrar no toca inventario ni balance', async () => {
    const { silla } = await tienda()
    const o = await createOrder(B, { items: [line(silla.id, 3, 85000)] })
    await cancelOrder(o.id)
    expect((await getProduct(silla.id))!.stock).toBe(10)
    expect(await db.txn.count()).toBe(0)
  })
})

describe('pedido a partir del mensaje de WhatsApp', () => {
  it('encuentra los productos por su id corto, con el precio que vio el cliente', async () => {
    const { silla, mesa } = await tienda()
    const code = encodeOrderCode({ n: 'Olga', m: 'Sábado', i: [{ p: shortId(silla.id), q: 2, c: 80000 }, { p: shortId(mesa.id), q: 1, c: 300000 }] })
    const { input, unmatched } = await orderDraftFromMessage(B, `Hola, quiero un pedido\n${code}`)
    expect(unmatched).toEqual([])
    expect(input).toMatchObject({ customerName: 'Olga', notes: 'Sábado', source: 'catalog' })
    expect(input.items.map((i) => [i.name, i.quantity, i.unitPriceCents])).toEqual([['Silla de pino', 2, 80000], ['Mesa', 1, 300000]])
    const o = await createOrder(B, input)
    expect(o).toMatchObject({ totalCents: 460000, source: 'catalog' })
  })

  it('avisa de lo que ya no existe y falla si no queda nada o el texto no sirve', async () => {
    const { silla } = await tienda()
    const code = encodeOrderCode({ i: [{ p: shortId(silla.id), q: 1, c: 1 }, { p: 'zzzzzzzz', q: 1, c: 1 }] })
    const { input, unmatched } = await orderDraftFromMessage(B, code)
    expect(input.items).toHaveLength(1)
    expect(unmatched).toHaveLength(1)
    await expect(orderDraftFromMessage(B, encodeOrderCode({ i: [{ p: 'zzzzzzzz', q: 1, c: 1 }] }))).rejects.toThrow(/Ninguno de los productos/)
    await expect(orderDraftFromMessage(B, 'hola')).rejects.toThrow(/No encontré/)
  })

  it('las variantes se resuelven por su id corto; sin variante o con una que ya no existe se avisa', async () => {
    const p = await createProduct(B, { name: 'Librero', priceCents: 300000, stock: 0 })
    await setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Natural', 'Nogal'] }])
    const [natural, nogal] = await listVariants(p.id)
    await updateVariant(nogal.id, { stock: 3, priceCents: 350000 })
    const ok = await orderDraftFromMessage(B, encodeOrderCode({ i: [{ p: shortId(p.id), v: shortId(nogal.id), q: 1, c: 350000 }] }))
    expect(ok.input.items[0]).toMatchObject({ name: 'Librero (Nogal)', variantId: nogal.id })
    const sinVariante = encodeOrderCode({ i: [{ p: shortId(p.id), q: 1, c: 1 }, { p: shortId(p.id), v: shortId(natural.id), q: 1, c: 1 }] })
    const r = await orderDraftFromMessage(B, sinVariante)
    expect(r.unmatched).toHaveLength(1)
    expect(r.input.items).toHaveLength(1)
    const o = await createOrder(B, ok.input)
    await payOrder(o.id)
    expect((await listVariants(p.id)).find((v) => v.id === nogal.id)!.stock).toBe(2)
  })
})

describe('foto del catálogo', () => {
  async function fake(blob: Blob) { return `data:image/jpeg;base64,${blob.size}` }

  it('solo lleva los productos visibles, sin stock ni costo, con categoría y agotados', async () => {
    const { ensureCategory } = await import('./categories')
    const muebles = await ensureCategory(B, 'product', 'Muebles')
    await ensureCategory(B, 'product', 'Sin usar')
    const foto = new Blob(['abc'], { type: 'image/jpeg' })
    const silla = await createProduct(B, { name: 'Silla', priceCents: 85000, costCents: 40000, stock: 10, categoryId: muebles.id, description: ' Pino macizo ', visibleInCatalog: true, photos: [foto] })
    await createProduct(B, { name: 'Escondido', priceCents: 1, stock: 3 })
    await createProduct(B, { name: 'Agotada', priceCents: 5000, stock: 0, visibleInCatalog: true })
    const lib = await createProduct(B, { name: 'Librero', priceCents: 300000, stock: 0, visibleInCatalog: true })
    await setVariantAttributes(lib.id, [{ name: 'Acabado', values: ['Natural', 'Nogal'] }])
    const [, nogal] = await listVariants(lib.id)
    await updateVariant(nogal.id, { stock: 2, priceCents: 350000 })
    const c = await buildCatalog(business, fake, new Date('2026-03-05T12:00:00Z'))
    expect(c).toMatchObject({ v: 1, generatedAt: '2026-03-05T12:00:00.000Z', categories: ['Muebles'], business: { name: 'Carpintería López', phone: '33 1234 5678', note: 'Hechos a mano', currency: 'MXN' } })
    expect(c.products.map((p) => p.name)).toEqual(['Agotada', 'Librero', 'Silla'])
    const s = c.products.find((p) => p.name === 'Silla')!
    expect(s).toEqual({ id: shortId(silla.id), name: 'Silla', description: 'Pino macizo', category: 'Muebles', priceCents: 85000, photo: 'data:image/jpeg;base64,3', soldOut: false })
    expect(c.products.find((p) => p.name === 'Agotada')!.soldOut).toBe(true)
    const l = c.products.find((p) => p.name === 'Librero')!
    expect(l.soldOut).toBe(false)
    expect(l.variants).toEqual([{ id: shortId((await listVariants(lib.id))[0].id), name: 'Natural', priceCents: 300000, soldOut: true }, { id: shortId(nogal.id), name: 'Nogal', priceCents: 350000, soldOut: false }])
    const text = JSON.stringify(c)
    expect(text).not.toContain('costCents')
    expect(text).not.toContain('"stock"')
    expect(text).not.toContain('Escondido')
  })

  it('avisa lo que falta y nombra el archivo', () => {
    expect(catalogIssues({ phone: '33 1234 5678' }, 2)).toEqual([])
    expect(catalogIssues({ phone: '' }, 2)).toHaveLength(1)
    expect(catalogIssues({ phone: ' - ' }, 0)).toHaveLength(2)
    expect(catalogFileName({ name: 'Carpintería López' }, new Date('2026-03-05T12:00:00Z'))).toBe('catalogo-carpinteria-lopez-2026-03-05.json')
  })
})

describe('archivo de catálogo', () => {
  const sample = () => ({
    v: 1, generatedAt: '2026-03-05T12:00:00.000Z', categories: ['Muebles', 'Fantasma'],
    business: { name: ' Carpintería López ', phone: '33 1234 5678', country: 'MX', address: 'Reforma 123', openingHours: 'L-V 9 a 6', currency: 'MXN', note: 'Hechos a mano' },
    products: [
      { id: 'ab12cd34', name: 'Silla', description: 'Pino', category: 'Muebles', priceCents: 85000, photo: 'data:image/jpeg;base64,/9j/4AAQ', soldOut: false },
      { id: 'ef56ab78', name: 'Librero', description: '', category: '', priceCents: 300000, soldOut: false, variants: [{ id: '11aa22bb', name: 'Nogal', priceCents: 350000, soldOut: false }] },
    ],
  })
  const parse = (o: unknown) => parseCatalog(JSON.stringify(o))

  it('acepta un catálogo bueno y lo limpia', () => {
    const r = parse(sample())
    expect(r).toMatchObject({ ok: true, data: { v: 1, categories: ['Muebles'], business: { name: 'Carpintería López', country: 'MX', currency: 'MXN' } } })
    if (r.ok) expect(r.data.products.map((p) => p.id)).toEqual(['ab12cd34', 'ef56ab78'])
  })

  it('descarta lo peligroso: fotos que no son JPEG, textos largos, ids raros', () => {
    const o = sample()
    o.products[0].photo = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    o.products[0].name = 'x'.repeat(500)
    o.products[0].description = '<img src=x onerror=alert(1)>'
    const r = parse(o)
    expect(r.ok && r.data.products[0].photo).toBeUndefined()
    expect(r.ok && r.data.products[0].name).toHaveLength(120)
    expect(r.ok && r.data.products[0].description).toBe('<img src=x onerror=alert(1)>') // se conserva como texto: la página lo muestra sin interpretarlo
    const javascript = sample()
    javascript.products[0].photo = 'javascript:alert(1)'
    expect(parse(javascript).ok && (parse(javascript) as { data: { products: { photo?: string }[] } }).data.products[0].photo).toBeUndefined()
    const huge = sample()
    huge.products[0].photo = 'data:image/jpeg;base64,' + 'A'.repeat(300_000)
    expect(parse(huge).ok && (parse(huge) as { data: { products: { photo?: string }[] } }).data.products[0].photo).toBeUndefined()
  })

  it('rechaza archivos que no son de Conta o están dañados', () => {
    expect(parseCatalog('no es json')).toMatchObject({ ok: false, error: expect.stringMatching(/no se puede leer/) })
    expect(parseCatalog('null')).toMatchObject({ ok: false })
    expect(parse({ ...sample(), v: 2 })).toMatchObject({ ok: false, error: expect.stringMatching(/de Conta/) })
    expect(parse({ ...sample(), products: [] })).toMatchObject({ ok: false, error: expect.stringMatching(/no tiene productos/) })
    expect(parse({ ...sample(), business: { ...sample().business, name: ' ' } })).toMatchObject({ ok: false, error: expect.stringMatching(/nombre/) })
    const badPrice = sample(); (badPrice.products[0] as { priceCents: number }).priceCents = 10.5
    expect(parse(badPrice)).toMatchObject({ ok: false, error: expect.stringMatching(/no es válido/) })
    const badId = sample(); badId.products[0].id = 'a b;c'
    expect(parse(badId)).toMatchObject({ ok: false })
    const badVariant = sample(); (badVariant.products[1].variants![0] as { priceCents: number }).priceCents = -5
    expect(parse(badVariant)).toMatchObject({ ok: false, error: expect.stringMatching(/variante/) })
    expect(parse({ ...sample(), products: Array.from({ length: 501 }, () => sample().products[0]) })).toMatchObject({ ok: false, error: expect.stringMatching(/más de 500/) })
  })

  it('usa valores por omisión razonables si faltan país, moneda o fecha', () => {
    const o = sample() as Record<string, unknown>
    o.generatedAt = 'ayer'
    o.business = { name: 'X', phone: '', address: '', openingHours: '', note: '' }
    expect(parse(o)).toMatchObject({ ok: true, data: { business: { country: 'MX', currency: 'MXN' }, generatedAt: '1970-01-01T00:00:00.000Z' } })
  })
})

describe('pedido del cliente: del catálogo a Conta', () => {
  it('el mensaje que arma la página lo lee Conta y crea el mismo pedido', async () => {
    const { silla, mesa } = await tienda()
    const lib = await createProduct(B, { name: 'Librero', priceCents: 300000, stock: 0, visibleInCatalog: true })
    await db.product.update(silla.id, { visibleInCatalog: true, description: 'Pino' })
    await db.product.update(mesa.id, { visibleInCatalog: true })
    await setVariantAttributes(lib.id, [{ name: 'Acabado', values: ['Natural', 'Nogal'] }])
    const [, nogal] = await listVariants(lib.id)
    await updateVariant(nogal.id, { stock: 4, priceCents: 350000 })
    const data = await buildCatalog(business, async () => undefined)
    const { orderMessage, orderLink, priceCart, cartTotal } = await import('./catalogOrder')
    const sillaId = shortId(silla.id)
    const cart = [
      { productId: sillaId, quantity: 4 },
      { productId: shortId(lib.id), variantId: shortId(nogal.id), quantity: 1 },
      { productId: shortId(mesa.id), quantity: 1 },
      { productId: 'fantasma', quantity: 3 }, // ya no está en el catálogo: se ignora
      { productId: shortId(lib.id), quantity: 2 }, // sin variante: se ignora
    ]
    expect(priceCart(data, cart)).toHaveLength(3)
    expect(cartTotal(priceCart(data, cart))).toBe(4 * 85000 + 350000 + 300000)
    const msg = orderMessage(data, cart, 'Olga Acevedo', 'Entregar el sábado')
    expect(msg.count).toBe(3)
    expect(msg.text).toContain('4 × Silla de pino — $3,400.00')
    expect(msg.text).toContain('1 × Librero (Nogal) — $3,500.00')
    expect(msg.text).toContain('Total: $9,900.00')
    const link = orderLink(data, msg.text)!
    expect(link.startsWith('https://wa.me/523312345678?text=')).toBe(true)
    expect(decodeURIComponent(link.split('?text=')[1])).toBe(msg.text)
    // Conta lee ese mismo mensaje
    const { input, unmatched } = await orderDraftFromMessage(B, msg.text)
    expect(unmatched).toEqual([])
    expect(input).toMatchObject({ customerName: 'Olga Acevedo', notes: 'Entregar el sábado', source: 'catalog' })
    const o = await createOrder(B, input)
    expect(o.totalCents).toBe(msg.totalCents)
    expect((await getOrderItems(o.id)).map((i) => [i.name, i.quantity, i.unitPriceCents])).toEqual([['Silla de pino', 4, 85000], ['Librero (Nogal)', 1, 350000], ['Mesa', 1, 300000]])
    // y al cobrarlo baja el inventario de cada uno
    await payOrder(o.id)
    expect((await getProduct(silla.id))!.stock).toBe(6)
    expect((await listVariants(lib.id)).find((v) => v.id === nogal.id)!.stock).toBe(3)
  })

  it('los agotados no entran al pedido y sin teléfono no hay enlace', async () => {
    const { silla } = await tienda()
    await db.product.update(silla.id, { visibleInCatalog: true, stock: 0 })
    const data = await buildCatalog({ ...business, phone: ' ' }, async () => undefined)
    const { orderMessage, orderLink } = await import('./catalogOrder')
    const m = orderMessage(data, [{ productId: shortId(silla.id), quantity: 1 }], '', '')
    expect(m.count).toBe(0)
    expect(orderLink(data, m.text)).toBeUndefined()
  })
})
