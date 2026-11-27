import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, priceFromCost } from './quoter'
import { calcService, SERVICES, type ServState } from './services'

const qty = (st: ServState, name: RegExp) => calcService(st, DEFAULT_CONFIG).lines.find((l) => name.test(l.n))?.qty

describe('servicios extra', () => {
  it('muro de drywall de 4 × 2.44 m, una cara, postes a 61 cm', () => {
    const st: ServState = { key: 'drywall', values: { tipo: 1, largo: 4, alto: 2.44, caras: 1, sep: 0.61 } }
    expect(qty(st, /^Canal/)).toBe(3)
    expect(qty(st, /^Poste/)).toBe(8)
    expect(qty(st, /^Placa/)).toBe(4)
    expect(qty(st, /^Tornillo 1/)).toBe(100)
    const a = calcService(st, DEFAULT_CONFIG)
    const b = calcService({ ...st, values: { ...st.values, sep: 0.406 } }, DEFAULT_CONFIG)
    expect(priceFromCost(DEFAULT_CONFIG, b.material, b.hours).costCents).toBeGreaterThan(priceFromCost(DEFAULT_CONFIG, a.material, a.hours).costCents)
  })
  it('mesa de río de 1800 × 900 con río de 200 y 40 de espesor: unos 15.8 L de resina', () => {
    expect(qty({ key: 'resina', values: { tipo: 1, largo: 180, ancho: 90, espesor: 4, rio: 20 } }, /^Resina/)).toBeCloseTo(15.84, 1)
  })
  it('la estantería industrial del ejemplo lleva 2 tramos de tubo de 20×20', () => {
    expect(qty({ key: 'herreria', values: { m20: 9.6, repisas: 4, repL: 600, repA: 300, tornillos: 20 } }, /^Tubo 20×20/)).toBe(2)
  })
  it('todos los servicios calculan algo con sus valores iniciales', () => {
    for (const s of SERVICES) {
      const r = calcService({ key: s.key, values: {} }, DEFAULT_CONFIG)
      expect(r.hours, s.key).toBeGreaterThan(0)
      expect(Number.isFinite(r.material), s.key).toBe(true)
    }
  })
})
