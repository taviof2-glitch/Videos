import { describe, expect, it } from 'vitest'
import { baseTitle, calcBase, cutText, defaultValues, templateOf, type BaseState } from './bases'
import { DEFAULT_CONFIG, DEFAULT_MATS, quoterSettings } from './quoter'

const state = (tablero?: 'melamina' | 'mdf' | 'madera'): BaseState => {
  const t = templateOf('closet')
  return { key: 'closet', values: defaultValues(t), opts: { esp: 16, veta: false, suave: true, cubierta: false, iguales: 1, fondo: 'embutido', estilo: 'A', ...(tablero && { tablero }) } }
}

describe('material del tablero en Bases', () => {
  it('melamina lleva canto; MDF y madera no, pero llevan acabado y más horas', () => {
    const mel = calcBase(state(), DEFAULT_CONFIG)
    const mdf = calcBase(state('mdf'), DEFAULT_CONFIG)
    const wood = calcBase(state('madera'), DEFAULT_CONFIG)
    expect(mel.edge.d + mel.edge.g).toBeGreaterThan(0)
    expect(mdf.edge.d + mdf.edge.g).toBe(0)
    expect(mdf.parts.map(([n]) => n)).toContain('Hojas de MDF')
    expect(mdf.parts.map(([n]) => n)).toContain('Pintura o laca y sellador')
    expect(wood.parts.map(([n]) => n)).toContain('Tableros de madera')
    expect(wood.parts.map(([n]) => n)).toContain('Barniz o tinta')
    expect(mdf.hours).toBeGreaterThan(mel.hours)
    expect(wood.material).toBeGreaterThan(mel.material)
  })
  it('título y despiece dicen el material', () => {
    const s = state('madera')
    expect(baseTitle(s)).toContain('en madera')
    expect(cutText(s, calcBase(s, DEFAULT_CONFIG), DEFAULT_CONFIG)).toContain('sin cubrecanto')
  })
  it('Servicios trae MDF y madera de fábrica', () => {
    expect(quoterSettings({} as never).mats).toEqual(DEFAULT_MATS)
  })
})

import { suggestedPrice, variantFactor } from './woods'
describe('variantes de madera', () => {
  it('parota y grande suben el precio; pino mediana es el base', () => {
    expect(variantFactor(['Pino', 'Mediana'])).toBe(1)
    expect(suggestedPrice(30000, ['Parota'])).toBe(48000)
    expect(suggestedPrice(30000, ['Cedro', 'Grande'])).toBe(57000)
    expect(suggestedPrice(30000, ['Otra madera'])).toBe(30000)
  })
})

import { BOARD_KEY, boardUnitCents, calcQuote, DEFAULT_BOARD, DEFAULT_TYPES, quoteMessage } from './quoter'
describe('tablas de picar en Cotizar', () => {
  const cfg = DEFAULT_CONFIG
  it('cm² × precio de la madera, redonda +%, con mango cuenta el largo total', () => {
    expect(boardUnitCents(cfg, DEFAULT_BOARD)).toBe(14000) // 25 × 35 = 875 cm² × 0.16
    expect(boardUnitCents(cfg, { ...DEFAULT_BOARD, madera: 'parota' })).toBe(17500)
    expect(boardUnitCents(cfg, { ...DEFAULT_BOARD, madera: 'cedro' })).toBe(17500)
    expect(boardUnitCents(cfg, { ...DEFAULT_BOARD, redonda: true })).toBe(15400)
    expect(boardUnitCents(cfg, { ...DEFAULT_BOARD, mango: true, mangoLargo: 12 })).toBe(18800) // 25 × 47
  })
  it('se multiplica por la cantidad y el texto dice la madera', () => {
    const f = { type: BOARD_KEY, q: 3, km: 0, suave: false, pint: false, cub: false, xmat: 0, xhrs: 0, board: { ...DEFAULT_BOARD, madera: 'parota' as const, mango: true, mangoLargo: 10 } }
    const r = calcQuote(cfg, DEFAULT_TYPES, f)
    expect(r.perUnitCents).toBe(22500) // 25 × 45 = 1125 cm² × 0.2
    expect(r.priceCents).toBe(67500)
    const text = quoteMessage({ name: 'House Lite', currency: 'MXN' }, cfg, DEFAULT_TYPES, f, r, { customer: 'Ana', description: '', delivery: '1 semana', iva: false, ivaRate: 16 })
    expect(text).toContain('Parota, 25 × 35 cm + mango de 10 cm')
    expect(text).toContain('$225.00 cada una')
  })
})

import { wholesalePct } from './quoter'
describe('mayoreo de tablas', () => {
  it('escalones 15/50/100 → 5/10/15 %', () => {
    expect(wholesalePct(DEFAULT_CONFIG, 14)).toBe(0)
    expect(wholesalePct(DEFAULT_CONFIG, 15)).toBe(5)
    expect(wholesalePct(DEFAULT_CONFIG, 50)).toBe(10)
    expect(wholesalePct(DEFAULT_CONFIG, 120)).toBe(15)
  })
  it('descuenta el precio por pieza y el total', () => {
    const f = { type: BOARD_KEY, q: 50, km: 0, suave: false, pint: false, cub: false, xmat: 0, xhrs: 0, board: DEFAULT_BOARD }
    const r = calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, f)
    expect(r.listUnitCents).toBe(14000)
    expect(r.perUnitCents).toBe(12600) // 140 − 10 %
    expect(r.priceCents).toBe(630000)
    expect(calcQuote(DEFAULT_CONFIG, DEFAULT_TYPES, { ...f, q: 10 }).wholesalePct).toBeUndefined()
  })
})
