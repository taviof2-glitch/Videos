import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { listContacts } from './contacts'
import { db } from './db'
import { calcQuote, DEFAULT_CONFIG, DEFAULT_FORM, DEFAULT_TYPES, quoteMessage, quoterSettings, saveQuoterQuote, saveQuoterSettings } from './quoter'
import { getQuote, getQuoteItems, listQuotes } from './quotes'
import type { Business } from './types'

let biz: Business
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'Carpintería López' })
})
const x = { customer: 'Olga', description: 'color nogal', delivery: '2 a 3 semanas', iva: false, ivaRate: 16, phone: '33 1234 5678' }

describe('cálculo del cotizador (mismos números que el artefacto Cotizador Houselite)', () => {
  it('cocina de 3 m lineales con cierre suave y cubierta, a 5 km', () => {
    const r = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, DEFAULT_FORM)
    expect(r).toMatchObject({ materialCents: 952350, costCents: 1266961, priceCents: 1650000, advanceCents: 825000, withTop: true, withPaint: false })
    expect(Math.round(r.laborCents)).toBe(222222)
    expect(r.shopCents).toBe(92389)
    expect(r.hours).toBe(24)
    expect(r.profitCents).toBe(1650000 - 1266961)
    expect(r.perUnitCents).toBe(550000)
    // contra su precio de lista de $6,000 por metro: cobraría 18,000 y le quedarían 5,330.39
    expect(r.list).toEqual({ totalCents: 1800000, diffCents: 1800000 - 1266961 })
  })

  it('2 m con pintura, bisagras normales, sin cubierta y sin distancia', () => {
    const r = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { type: 'cocina_inf', q: 2, km: 0, suave: false, pint: true, cub: false, xmat: 0, xhrs: 0 })
    expect(r).toMatchObject({ materialCents: 461900, costCents: 684863, priceCents: 895000 })
    expect(r.hours).toBeCloseTo(17.2)
  })

  it('el precio siempre sube a múltiplos de $50 y nunca queda por debajo del costo', () => {
    for (const q of [0.5, 1, 2.3, 7]) {
      const r = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...DEFAULT_FORM, q })
      expect(r.priceCents % 5000).toBe(0)
      expect(r.priceCents).toBeGreaterThanOrEqual(r.costCents)
    }
  })

  it('material y horas extra suman; la pintura de un trabajo de restauración va siempre', () => {
    const a = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { type: 'otro', q: 1, km: 0, suave: false, pint: false, cub: false, xmat: 1000, xhrs: 9 })
    expect(a.materialCents).toBe(100000)
    expect(a.hours).toBe(9)
    expect(calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { type: 'rest', q: 4, km: 0, suave: false, pint: false, cub: false, xmat: 0, xhrs: 0 }).withPaint).toBe(true)
  })

  it('cantidad cero da precio cero y no revienta', () => {
    expect(calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...DEFAULT_FORM, q: 0, km: 0 }).priceCents).toBe(0)
  })
})

describe('costos del negocio', () => {
  it('sin cambios usa los valores iniciales; lo que se guarda se conserva y se completa con los iniciales', async () => {
    expect(quoterSettings(biz).cfg).toEqual(DEFAULT_CONFIG)
    const { cfg, types } = quoterSettings(biz)
    await saveQuoterSettings(biz.id, { ...cfg, margen: 40 }, { ...types, mesa: { ...DEFAULT_TYPES.otro, n: 'Mesa', u: 'piezas', hr: 5, m: 1000 } })
    const b = (await db.business.get(biz.id))!
    expect(quoterSettings(b).cfg.margen).toBe(40)
    expect(quoterSettings(b).cfg.hoja).toBe(1100)
    expect(Object.keys(quoterSettings(b).types)).toContain('mesa')
  })
})

describe('guardar como cotización de Conta', () => {
  it('crea el cliente, la cotización con el precio, el anticipo y los datos para reabrirla', async () => {
    const q = await saveQuoterQuote(biz, DEFAULT_FORM, x)
    expect(q).toMatchObject({ title: 'Cocina – muebles bajos', totalCents: 1650000, advanceCents: 825000, status: 'pending', taxRate: 0 })
    expect(q.quoter).toMatchObject({ type: 'cocina_inf', q: 3, desc: 'color nogal', costCents: 1266961 })
    const items = await getQuoteItems(q.id)
    expect(items).toHaveLength(1)
    expect(items[0].name).toBe('Cocina – muebles bajos · 3 metros lineales · color nogal')
    const clientes = await listContacts(biz.id, 'customer')
    expect(clientes.map((c) => [c.name, c.phone])).toEqual([['Olga', '33 1234 5678']])
    expect((await listQuotes(biz.id)).map((r) => r.id)).toEqual([q.id])
  })

  it('un cliente que ya existe se reutiliza (sin importar mayúsculas)', async () => {
    await saveQuoterQuote(biz, DEFAULT_FORM, x)
    await saveQuoterQuote(biz, { ...DEFAULT_FORM, q: 1 }, { ...x, customer: ' olga ' })
    expect(await listContacts(biz.id, 'customer')).toHaveLength(1)
    expect(await listQuotes(biz.id)).toHaveLength(2)
  })

  it('con IVA suma el impuesto y el anticipo se calcula sobre el total', async () => {
    const q = await saveQuoterQuote(biz, DEFAULT_FORM, { ...x, iva: true })
    expect(q.taxRate).toBe(16)
    expect(q.subtotalCents).toBe(1650000)
    expect(q.totalCents).toBe(1914000)
    expect(q.advanceCents).toBe(957000)
  })

  it('actualizar una cotización guardada cambia el precio sin crear otra', async () => {
    const q = await saveQuoterQuote(biz, DEFAULT_FORM, x)
    const q2 = await saveQuoterQuote(biz, { ...DEFAULT_FORM, q: 1 }, { ...x, quoteId: q.id })
    expect(q2.id).toBe(q.id)
    expect(q2.totalCents).toBeLessThan(q.totalCents)
    expect((await getQuote(q.id))?.quoter?.q).toBe(1)
    expect(await listQuotes(biz.id)).toHaveLength(1)
  })

  it('rechaza lo que no se puede guardar', async () => {
    await expect(saveQuoterQuote(biz, DEFAULT_FORM, { ...x, customer: ' ' })).rejects.toThrow('nombre del cliente')
    await expect(saveQuoterQuote(biz, { ...DEFAULT_FORM, q: 0 }, x)).rejects.toThrow('mayor que cero')
    await expect(saveQuoterQuote(biz, { ...DEFAULT_FORM, type: 'no-existe' }, x)).rejects.toThrow('ya no existe')
    expect(await listQuotes(biz.id)).toEqual([])
  })
})

describe('texto para WhatsApp', () => {
  it('lleva el negocio, el precio, el anticipo y la vigencia', () => {
    const r = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, DEFAULT_FORM)
    const t = quoteMessage(biz, DEFAULT_CONFIG, DEFAULT_TYPES, DEFAULT_FORM, r, x)
    expect(t).toContain('Hola Olga, te comparto la cotización de Carpintería López:')
    expect(t).toContain('*Cocina – muebles bajos*: 3 metros lineales (con cubierta, herrajes de cierre suave)')
    expect(t).toContain('color nogal')
    expect(t).toContain('Precio: *$16,500.00*')
    expect(t).toContain('Anticipo para iniciar: $8,250.00')
    expect(t).toContain('Entrega aprox.: 2 a 3 semanas')
    expect(t).toContain('Vigencia de la cotización: 15 días.')
    expect(quoteMessage(biz, DEFAULT_CONFIG, DEFAULT_TYPES, DEFAULT_FORM, r, { ...x, iva: true })).toContain('Total: *$19,140.00*')
  })
})
