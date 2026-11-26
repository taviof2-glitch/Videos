import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { listContacts } from './contacts'
import { db } from './db'
import { DEFAULT_SPECS } from './cutlist'
import { saveQuoteCut, calcQuote, measuredJob, medSummary, DEFAULT_DESK, DESK_KEY, deskJob, DEFAULT_CONFIG, DEFAULT_FORM, DEFAULT_TYPES, quoteMessage, quoterSettings, saveQuoterQuote, saveQuoterSettings } from './quoter'
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

describe('escritorio a la medida', () => {
  const desk = { type: DESK_KEY, q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0 }

  it('saca material y horas de las medidas y los cajones', () => {
    const t = deskJob({ largo: 120, fondo: 60, alto: 75, cajones: 2 })
    // cubierta 0.72 + costados 0.90 + faldón 0.42 + 2 cajones 0.90 = 2.94 m² de melamina
    expect(t.h * 2.98).toBeCloseTo(2.94)
    expect(t).toMatchObject({ c: 2, j: 2, hr: 7, u: 'piezas' })
  })

  it('más cajones o más grande cuesta más', () => {
    const base = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...desk, desk: DEFAULT_DESK })
    const drawers = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...desk, desk: { ...DEFAULT_DESK, cajones: 4 } })
    const bigger = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...desk, desk: { ...DEFAULT_DESK, largo: 180 } })
    expect(base.priceCents).toBeGreaterThan(0)
    expect(drawers.costCents).toBeGreaterThan(base.costCents)
    expect(bigger.costCents).toBeGreaterThan(base.costCents)
    expect(drawers.hours).toBe(base.hours + 3)
  })

  it('lo propio del escritorio se puede cambiar en los costos y baja el precio', () => {
    const f = { ...desk, desk: DEFAULT_DESK }
    const base = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, f)
    const cheaper = calcQuote({ ...DEFAULT_CONFIG, deskHBase: 2, deskHCajon: 0.5, deskCajonM2: 0.3 }, DEFAULT_TYPES, f)
    expect(cheaper.hours).toBe(3)
    expect(cheaper.costCents).toBeLessThan(base.costCents)
    expect(deskJob(DEFAULT_DESK, { ...DEFAULT_CONFIG, deskExtra: 150 }).m).toBe(150)
  })

  it('se guarda con sus medidas y el mensaje las menciona', async () => {
    const f = { ...desk, desk: { largo: 140, fondo: 60, alto: 75, cajones: 3 } }
    const q = await saveQuoterQuote(biz, f, x)
    expect((await getQuote(q.id))!.quoter!.desk).toEqual(f.desk)
    expect((await getQuoteItems(q.id))[0].name).toContain('140 × 60 × 75 cm, 3 cajones')
    const { cfg, types } = quoterSettings(biz)
    expect(quoteMessage(biz, cfg, types, f, calcQuote(cfg, types, f), x)).toContain('*Escritorio*: 1 pieza (medidas 140 × 60 × 75 cm, 3 cajones')
  })
})

describe('muebles por medidas (cocina, closet, TV)', () => {
  const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }

  it('el mueble de TV saca material y herrajes de su despiece', () => {
    const t = measuredJob(DEFAULT_SPECS.tv, DEFAULT_CONFIG, DEFAULT_TYPES.tv)
    expect(t).toMatchObject({ n: 'Mueble de TV', u: 'piezas', b: 4, c: 0, j: 2 })
    // 3.1 m² de melamina ≈ 1.04 hojas
    expect(t.h).toBeCloseTo(1.04, 1)
    expect(t.f).toBeGreaterThan(0)
  })

  it('más grande, con más puertas o cajones cuesta más; sin medidas se cotiza por metro como antes', () => {
    const base = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, tv)
    const bigger = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...tv, med: { ...DEFAULT_SPECS.tv, largo: 240 } })
    const drawers = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...tv, med: { ...DEFAULT_SPECS.tv, cajones: 2 } })
    expect(bigger.costCents).toBeGreaterThan(base.costCents)
    expect(drawers.costCents).toBeGreaterThan(base.costCents)
    const perMeter = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...tv, med: undefined, q: 1.8 })
    expect(perMeter.hours).toBeCloseTo(10.8)
  })

  it('la cubierta del mueble bajo se cobra por su largo y la lista por metro', () => {
    const f = { type: 'cocina_inf', q: 1, km: 0, suave: true, pint: false, cub: true, xmat: 0, xhrs: 0, med: { ...DEFAULT_SPECS.bajo, largo: 200 } }
    const con = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, f)
    const sin = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...f, cub: false })
    expect(con.materialCents - sin.materialCents).toBe(2 * DEFAULT_CONFIG.cubML * 100)
    expect(con.list?.totalCents).toBe(2 * 6000 * 100)
  })

  it('puertas altas llevan más bisagras', () => {
    expect(measuredJob({ ...DEFAULT_SPECS.closet, puertas: 2 }, DEFAULT_CONFIG).b).toBe(8)
  })

  it('se guarda con sus medidas y el mensaje las menciona', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    expect((await getQuote(q.id))!.quoter!.med).toEqual(DEFAULT_SPECS.tv)
    expect((await getQuoteItems(q.id))[0].name).toContain(medSummary(DEFAULT_SPECS.tv))
    expect(medSummary(DEFAULT_SPECS.tv)).toBe('180 × 45 × 40 cm, 2 puertas, 1 entrepaño, 2 divisiones')
    const { cfg, types } = quoterSettings(biz)
    expect(quoteMessage(biz, cfg, types, tv, calcQuote(cfg, types, tv), x)).toContain('*Mueble de TV*: 1 pieza (medidas 180 × 45 × 40 cm, 2 puertas')
  })
})

describe('despiece guardado con la cotización', () => {
  const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }

  it('al guardar un mueble por medidas la cotización lleva su despiece', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    const cut = (await getQuote(q.id))!.quoter!.cut!
    expect(cut.spec).toMatchObject({ kind: 'tv', largo: 180, grosor: 16 })
    expect(cut.girar).toBe(true)
    expect(cut.pieces.find((p) => p.name === 'Puerta')).toMatchObject({ qty: 2 })
  })

  it('el escritorio también; lo cotizado por metro no lleva despiece', async () => {
    const desk = await saveQuoterQuote(biz, { type: DESK_KEY, q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, desk: DEFAULT_DESK }, x)
    expect((await getQuote(desk.id))!.quoter!.cut!.spec.kind).toBe('escritorio')
    const meter = await saveQuoterQuote(biz, { ...tv, med: undefined, q: 2 }, { ...x, customer: 'Otro' })
    expect((await getQuote(meter.id))!.quoter!.cut).toBeUndefined()
  })

  it('se puede cambiar el despiece (grosor, veta) y al actualizar la cotización se conserva esa elección', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await saveQuoteCut(q.id, { ...DEFAULT_SPECS.tv, grosor: 18 }, false)
    expect((await getQuote(q.id))!.quoter!.cut).toMatchObject({ girar: false, spec: { grosor: 18 } })
    await saveQuoterQuote(biz, { ...tv, med: { ...DEFAULT_SPECS.tv, largo: 200 } }, { ...x, quoteId: q.id, cutPrefs: { grosor: 18, girar: false } })
    expect((await getQuote(q.id))!.quoter!.cut).toMatchObject({ girar: false, spec: { grosor: 18, largo: 200 } })
  })
})

describe('proyecto de varios muebles guardado con la cotización', () => {
  const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }

  it('guarda los demás muebles y los conserva al actualizar la cotización', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await saveQuoteCut(q.id, [DEFAULT_SPECS.tv, DEFAULT_SPECS.escritorio, DEFAULT_SPECS.closet], false)
    const cut = (await getQuote(q.id))!.quoter!.cut!
    expect(cut.more?.map((s) => s.kind)).toEqual(['escritorio', 'closet'])
    expect(cut.pieces.some((p) => p.name.startsWith('Closet · '))).toBe(true)
    await saveQuoterQuote(biz, tv, { ...x, quoteId: q.id, cutPrefs: { grosor: 16, girar: false, more: cut.more } })
    expect((await getQuote(q.id))!.quoter!.cut!.more?.length).toBe(2)
  })

  it('un solo mueble no guarda «more»', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    expect((await getQuote(q.id))!.quoter!.cut!.more).toBeUndefined()
  })
})

describe('cocina cotizada por módulos', () => {
  const cocina = (largo: number) => ({ type: 'cocina_inf', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: { ...DEFAULT_SPECS.bajo, largo } })

  it('cuenta puertas, bisagras y jaladeras de todos los módulos', () => {
    const t = measuredJob(cocina(250).med, DEFAULT_CONFIG, DEFAULT_TYPES.cocina_inf)
    expect(t).toMatchObject({ b: 10, j: 5, c: 0 }) // 2 + 2 + 1 puertas, 2 bisagras cada una
  })

  it('cada módulo suma sus horas y su material extra, y se pueden cambiar', () => {
    const base = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, cocina(250))
    const mas = calcQuote({ ...DEFAULT_CONFIG, medHModulo: 2.5, medModuloExtra: 100 }, DEFAULT_TYPES, cocina(250))
    expect(mas.hours - base.hours).toBeCloseTo(3 * 2)
    expect(mas.materialCents - base.materialCents).toBe(3 * 100 * 100)
  })

  it('el resumen dice los módulos y que las cantidades son por módulo', () => {
    expect(medSummary(cocina(250).med)).toBe('250 × 90 × 58 cm, 3 módulos: 100 + 100 + 50 cm, 2 puertas por módulo, 1 entrepaño por módulo')
    expect(medSummary(cocina(100).med)).toBe('100 × 90 × 58 cm, 2 puertas, 1 entrepaño')
  })
})
