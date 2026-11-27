import { describe, expect, it } from 'vitest'
import { buildBase, calcBase, defaultOpts, templateOf, type BaseState } from './bases'
import { DEFAULT_KITCHEN, fill, kitchenWarnings, planKitchen, STD, type KitchenState } from './kitchen'
import { DEFAULT_CONFIG } from './quoter'

const k = (over: Partial<KitchenState>): KitchenState => ({ ...DEFAULT_KITCHEN, ...over })

describe('asistente de cocinas', () => {
  it('reparte un tramo en anchos estándar de máximo 1 m y deja ≤ 10 cm para el panel de ajuste', () => {
    const r = fill(2430)
    expect(r.mods.every((w) => STD.includes(w) && w <= 1000)).toBe(true)
    expect(r.rest).toBeLessThanOrEqual(100)
    expect(r.mods.reduce((a, b) => a + b, 0) + r.rest).toBe(2430)
  })
  it('el fregadero y la estufa quedan completos en su módulo, nunca partidos', () => {
    const mods = planKitchen(k({ forma: 'lineal', paredes: { A: 3600, B: 0, C: 0 }, fregadero: { pared: 'A', pos: 1000, ancho: 900 }, estufa: { pared: 'A', pos: 2400, ancho: 600 }, refri: { pared: 'A', pos: 0, ancho: 750 }, alacenas: false }))
    expect(mods.filter((m) => m.kind === 'fregadero')).toEqual([expect.objectContaining({ ancho: 900 })])
    expect(mods.filter((m) => m.kind === 'estufa')).toEqual([expect.objectContaining({ ancho: 600 })])
    expect(mods.reduce((a, m) => a + m.ancho, 0)).toBe(3600)
  })
  it('en L lleva esquinero bajo de 900 × 900 con 550 de fondo', () => {
    const mods = planKitchen(k({ forma: 'L' }))
    expect(mods.filter((m) => m.kind === 'esquinero')).toHaveLength(1)
    const s: BaseState = { key: 'esquinero_L', values: { ladoA: 900, ladoB: 900, alto: 780, fondo: 550 }, opts: defaultOpts(DEFAULT_CONFIG, templateOf('esquinero_L')) }
    expect(buildBase(s, DEFAULT_CONFIG).pieces.find((p) => p.n === 'Base (caja ciega)')).toMatchObject({ l: 868, a: 550 })
  })
  it('las alacenas van sobre los bajos y el fregadero, no sobre la estufa ni el refri', () => {
    const mods = planKitchen(k({ forma: 'lineal', paredes: { A: 3000, B: 0, C: 0 }, fregadero: { pared: 'A', pos: 900, ancho: 900 }, estufa: { pared: 'A', pos: 2100, ancho: 600 }, refri: { pared: 'A', pos: 0, ancho: 750 } }))
    const low = mods.filter((m) => ['bajo', 'cajonera', 'fregadero'].includes(m.kind)).reduce((a, m) => a + m.ancho, 0)
    expect(mods.filter((m) => m.kind === 'alacena').reduce((a, m) => a + m.ancho, 0)).toBe(low)
  })
  it('avisa si el triángulo de trabajo queda fuera de 1.2 a 2.7 m', () => {
    const w = kitchenWarnings(k({ forma: 'lineal', paredes: { A: 6000, B: 0, C: 0 }, fregadero: { pared: 'A', pos: 0, ancho: 900 }, estufa: { pared: 'A', pos: 4500, ancho: 600 }, refri: { pared: 'A', pos: 1000, ancho: 750 } }))
    expect(w.some((x) => x.includes('fregadero–estufa'))).toBe(true)
  })
  it('la cocina completa junta el despiece y el precio de todos los módulos', () => {
    const s: BaseState = { key: 'cocina', values: {}, opts: { ...defaultOpts(DEFAULT_CONFIG, templateOf('cocina')), cubierta: true }, kitchen: DEFAULT_KITCHEN }
    const r = calcBase(s, DEFAULT_CONFIG)
    expect(r.board.sheets.length).toBeGreaterThan(3)
    expect(r.parts.find(([n]) => n === 'Cubierta')![1]).toBeGreaterThan(0)
  })
})

describe('cocina paralela', () => {
  it('dos filas sin esquinero', () => {
    const mods = planKitchen(k({ forma: 'paralela', paredes: { A: 3000, B: 2400, C: 0 }, fregadero: { pared: 'A', pos: 1000, ancho: 900 }, estufa: { pared: 'B', pos: 900, ancho: 600 }, refri: { pared: 'A', pos: 0, ancho: 750 } }))
    expect(mods.some((m) => m.kind === 'esquinero')).toBe(false)
    expect(mods.filter((m) => m.pared === 'B' && m.kind !== 'alacena').reduce((a, m) => a + m.ancho, 0)).toBe(2400)
  })
})
