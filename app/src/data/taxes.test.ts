import { describe, expect, it } from 'vitest'
import { estimateTaxes, resicoRate } from './taxes'

describe('impuestos aproximados', () => {
  it('RESICO por tramos y sin IVA', () => {
    expect(resicoRate(2_000_000)).toBe(0.01)
    expect(resicoRate(6_000_000)).toBe(0.015)
    expect(estimateTaxes({ regime: 'resico', chargesIva: false, invoicedPct: 0 }, 6_000_000, 2_000_000)).toMatchObject({ isrCents: 90_000, ivaCents: 0, totalCents: 90_000 })
  })
  it('con IVA: trasladado menos acreditable', () => {
    const t = estimateTaxes({ regime: 'resico', chargesIva: true, invoicedPct: 100 }, 11_600_000, 2_320_000)
    expect(t.baseCents).toBe(10_000_000)
    expect(t.ivaCents).toBe(1_600_000 - 320_000)
    expect(t.isrRate).toBe(0.02)
  })
})
