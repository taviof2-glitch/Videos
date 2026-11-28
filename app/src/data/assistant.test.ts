import { beforeEach, describe, expect, it, test } from 'vitest'
import { businessContext } from './assistant'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { createSale } from './transactions'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('el resumen trae el balance del día y quién debe', async () => {
  const b = await createBusiness({ name: 'House Lite' })
  const today = '2026-11-26'
  const ana = await createContact(b.id, 'customer', { name: 'Ana Ruiz' })
  await createSale(b.id, { amountCents: 150_000, date: `${today}T18:00:00.000Z` })
  await createSale(b.id, { amountCents: 80_000, date: `${today}T18:00:00.000Z`, credit: true, contactId: ana.id })
  const text = await businessContext((await db.business.get(b.id))!, today)
  expect(text).toContain('Negocio: House Lite. Hoy es 2026-11-26.')
  expect(text).toMatch(/Hoy: cobrado \$1,500\.00 \(2 ventas registradas/)
  expect(text).toMatch(/Ana Ruiz: \$800\.00/)
  expect(text).toContain('Obras en curso: ninguno.')
})

describe('ventas preparadas por el asistente', () => {
  it('crea cliente y producto nuevos (sobre pedido), la venta fiada con anticipo y la obra', async () => {
    const { planSale, executeSale } = await import('./assistant')
    const { listJobs } = await import('./jobs')
    const b = (await db.business.get((await createBusiness({ name: 'House Lite' })).id))!
    const action = { type: 'venta' as const, cliente: 'Juan Pérez', cliente_id: '', telefono: '33 1111 2222', productos: [{ nombre: 'Closet sencillo', producto_id: '', cantidad: 1, precio: 4500, medidas: '90 × 210 × 50 cm, 2 tubos' }], pago: 'fiado' as const, metodo: 'efectivo' as const, anticipo: 2000, encargo: true }
    const plan = await planSale(b, action)
    expect(plan.newContact).toBe('Juan Pérez')
    expect(plan.lines[0].newProduct).toEqual({ name: 'Closet sencillo', description: '90 × 210 × 50 cm, 2 tubos' })
    expect(plan.totalCents).toBe(450000)
    const sale = await executeSale(b, action)
    expect(sale.status).toBe('credit')
    const product = (await db.product.toArray())[0]
    expect(product).toMatchObject({ name: 'Closet sencillo', madeToOrder: true, priceCents: 450000 })
    const [job] = await listJobs(b.id)
    expect(job.balanceCents).toBe(250000)
    // La segunda vez reconoce al cliente y al producto que ya existen.
    const again = await planSale(b, { ...action, pago: 'contado', anticipo: 0, encargo: false })
    expect(again.contact?.name).toBe('Juan Pérez')
    expect(again.lines[0].product?.id).toBe(product.id)
  })
  it('una venta fiada sin cliente no se puede preparar', async () => {
    const { planSale } = await import('./assistant')
    const b = (await db.business.get((await createBusiness({ name: 'Taller' })).id))!
    await expect(planSale(b, { type: 'venta', cliente: '', cliente_id: '', telefono: '', productos: [{ nombre: 'Repisa', producto_id: '', cantidad: 1, precio: 500, medidas: '' }], pago: 'fiado', metodo: 'efectivo', anticipo: 0, encargo: false })).rejects.toThrow(/cliente/)
  })
})

describe('contexto corto', () => {
  it('manda los mencionados y los recientes, no toda la lista', async () => {
    const { relevant } = await import('./assistant')
    const list = Array.from({ length: 50 }, (_, i) => ({ name: `Cliente ${i}`, updatedAt: `2026-11-${String((i % 28) + 1).padStart(2, '0')}` })).concat([{ name: 'Marta López', updatedAt: '2020-01-01' }])
    const r = relevant(list, 'vendí un closet a marta', 5)
    expect(r.shown[0].name).toBe('Marta López')
    expect(r.shown).toHaveLength(5)
    expect(r.more).toBe(46)
  })
})
