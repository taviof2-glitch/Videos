import { beforeEach, describe, expect, it } from 'vitest'
import { prepareAction, type AppAction } from './actions'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { contactBalance } from './debts'
import { saveFixed } from './fixed'
import { listJobs } from './jobs'
import { createProduct } from './products'
import { createQuote, listQuotes } from './quotes'
import { createSale } from './transactions'
import type { Business } from './types'

let biz: Business
const fresh = async () => (await db.business.get(biz.id))!
const run = async (a: AppAction) => (await prepareAction(await fresh(), a)).run()

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'House Lite' })
})

describe('acciones del asistente', () => {
  it('gasto con categoría y proveedor nuevos', async () => {
    const prep = await prepareAction(biz, { type: 'gasto', concepto: 'Hojas de melamina', monto: 2200, categoria: 'Material', proveedor: 'Maderería López', proveedor_id: '', pago: 'contado', metodo: 'efectivo' })
    expect(prep.lines.join(' ')).toContain('Maderería López (nuevo)')
    await prep.run()
    const t = (await db.txn.toArray())[0]
    expect(t).toMatchObject({ type: 'expense', amountCents: 220000, concept: 'Hojas de melamina' })
  })
  it('abono de un cliente que debe', async () => {
    const ana = await createContact(biz.id, 'customer', { name: 'Ana Ruiz' })
    await createSale(biz.id, { amountCents: 500000, credit: true, contactId: ana.id })
    await run({ type: 'abono', nombre: 'ana ruiz', contacto_id: '', de: 'cliente', monto: 2000, metodo: 'transferencia' })
    expect(await contactBalance(ana.id)).toBe(300000)
  })
  it('cotización con cliente nuevo, y luego pasarla a obra', async () => {
    await run({ type: 'cotizacion', cliente: 'Luis', cliente_id: '', telefono: '3312345678', titulo: 'Cocina', lineas: [{ nombre: 'Cocina integral', producto_id: '', cantidad: 1, precio: 25000 }], anticipo: 12500, iva: false, vigencia_dias: 15 })
    const [q] = await listQuotes(biz.id)
    expect(q).toMatchObject({ title: 'Cocina', totalCents: 2500000, advanceCents: 1250000 })
    await run({ type: 'estado_cotizacion', numero: q.number, estado: 'obra' })
    expect((await listJobs(biz.id)).length).toBe(1)
  })
  it('mover una obra de etapa, poner fecha y marcarla liquidada', async () => {
    const c = await createContact(biz.id, 'customer', { name: 'Marta' })
    const q = await createQuote(biz.id, { contactId: c.id, validUntil: '2027-01-01', title: 'Closet', items: [{ name: 'Closet', quantity: 1, unitPriceCents: 900000 }] })
    await run({ type: 'estado_cotizacion', numero: q.number, estado: 'obra' })
    await run({ type: 'obra', referencia: 'marta', etapa: 'armado', fecha_entrega: '2026-12-15', nota: 'color nogal', liquidado: 'si' })
    const [j] = await listJobs(biz.id)
    expect(j.job).toMatchObject({ stage: 'armado', deliveryDate: '2026-12-15', note: 'color nogal', paid: true })
    expect(j.balanceCents).toBe(0)
  })
  it('pago habitual del taller', async () => {
    await saveFixed(biz.id, { name: 'Renta', amountCents: 500000, freq: 'mensual', day: 1 })
    await run({ type: 'pago_taller', nombre: 'renta', monto: 0, metodo: 'transferencia' })
    expect((await db.txn.toArray())[0]).toMatchObject({ type: 'expense', amountCents: 500000 })
  })
  it('crear y cambiar productos', async () => {
    await run({ type: 'producto', nombre: 'Repisa flotante', producto_id: '', precio: 350, costo: 120, existencias: 5, sobre_pedido: '', descripcion: '80 × 25 cm' })
    const p = (await db.product.toArray())[0]
    expect(p).toMatchObject({ name: 'Repisa flotante', priceCents: 35000, stock: 5, description: '80 × 25 cm' })
    await run({ type: 'producto', nombre: 'Repisa flotante', producto_id: '', precio: 400, costo: -1, existencias: -1, sobre_pedido: 'si', descripcion: '' })
    expect(await db.product.get(p.id)).toMatchObject({ priceCents: 40000, costCents: 12000, madeToOrder: true })
  })
  it('crear un proveedor y cambiarle el teléfono', async () => {
    await run({ type: 'contacto', nombre: 'Herrajes Tepa', contacto_id: '', tipo: 'proveedor', telefono: '' })
    await run({ type: 'contacto', nombre: 'Herrajes Tepa', contacto_id: '', tipo: 'proveedor', telefono: '378 111 2233' })
    const [c] = await db.contact.toArray()
    expect(c).toMatchObject({ type: 'supplier', name: 'Herrajes Tepa', phone: '3781112233' })
  })
  it('avisa cuando no encuentra lo que se pide', async () => {
    await expect(prepareAction(biz, { type: 'abono', nombre: 'Nadie', contacto_id: '', de: 'cliente', monto: 100, metodo: 'efectivo' })).rejects.toThrow(/No encontré/)
    await expect(prepareAction(biz, { type: 'estado_cotizacion', numero: 99, estado: 'aceptada' })).rejects.toThrow(/#99/)
    await createProduct(biz.id, { name: 'Mesa', priceCents: 100 })
  })
  it('cita en la agenda y marcarla hecha', async () => {
    const ana = await createContact(biz.id, 'customer', { name: 'Ana Ruiz' })
    await run({ type: 'cita', tipo: 'instalar', fecha: '2026-12-01', hora: '10:00', cliente: 'Ana Ruiz', cliente_id: '', titulo: 'Closet', direccion: 'Hidalgo 10', nota: '' })
    const [a] = await db.appointment.toArray()
    expect(a).toMatchObject({ kind: 'instalar', contactId: ana.id, address: 'Hidalgo 10', time: '10:00' })
    await run({ type: 'estado_cita', cita_id: a.id.slice(0, 8), hecha: true })
    expect((await db.appointment.get(a.id))!.done).toBe(true)
  })
  it('material, retazo, meta y precio del cotizador en línea', async () => {
    await run({ type: 'material', nombre: 'Bisagras', cambio: 0, existencia: 20, minimo: 10, unidad: 'piezas' })
    await run({ type: 'material', nombre: 'bisagras', cambio: -4, existencia: -1, minimo: -1, unidad: '' })
    expect((await fresh()).materials?.[0]).toMatchObject({ name: 'Bisagras', stock: 16, min: 10 })
    await run({ type: 'retazo', largo_mm: 400, ancho_mm: 900, grosor_mm: 16, color: 'Blanco', tipo: 'tablero' })
    expect((await fresh()).offcuts?.[0]).toMatchObject({ l: 900, a: 400, esp: 16 })
    await run({ type: 'meta_mes', monto: 80000 })
    expect((await fresh()).monthGoalCents).toBe(8000000)
    await run({ type: 'precio_linea', tipo: 'closet', precio_por_metro: 7000 })
    expect((await fresh()).leadPrices?.closet).toBe(700000)
  })
  it('mensaje y pantalla dan un botón en vez de guardar', async () => {
    await createContact(biz.id, 'customer', { name: 'Luis Pérez', phone: '3781234567' })
    const m = await prepareAction(await fresh(), { type: 'mensaje', nombre: 'Luis Pérez', contacto_id: '', telefono: '', texto: 'Hola Luis' })
    expect(m.open?.href).toContain('wa.me')
    const p = await prepareAction(await fresh(), { type: 'abrir_pantalla', pantalla: 'campanas', motivo: 'x' })
    expect(p.open).toMatchObject({ href: '/campanas', external: false })
  })
  it('obra con horas y material reales', async () => {
    await run({ type: 'cotizacion', cliente: 'Luis', cliente_id: '', telefono: '', titulo: 'Closet', lineas: [{ nombre: 'Closet', producto_id: '', cantidad: 1, precio: 10000 }], anticipo: 0, iva: false, vigencia_dias: 15 })
    const [q] = await listQuotes(biz.id)
    await run({ type: 'estado_cotizacion', numero: q.number, estado: 'obra' })
    await run({ type: 'obra', referencia: 'Closet', etapa: '', fecha_entrega: '', nota: '', liquidado: '', horas_reales: 12, material_real: 3500 })
    const [j] = await listJobs(biz.id)
    expect(j.job).toMatchObject({ realHours: 12, realMaterialCents: 350000 })
  })
})
