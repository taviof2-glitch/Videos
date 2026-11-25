import { describe, expect, it } from 'vitest'
import { daysBetween, isValidDayKey } from './dates'

describe('claves de día', () => {
  it('valida fechas reales y rechaza las que se desbordan', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2026-12-31']) expect(isValidDayKey(ok)).toBe(true)
    for (const bad of ['2026-02-31', '2027-02-29', '2026-13-01', '2026-1-1', '31/12/2026', '', 'hoy']) expect(isValidDayKey(bad)).toBe(false)
  })
  it('cuenta días entre fechas', () => {
    expect(daysBetween('2026-03-01', '2026-03-04')).toBe(3)
    expect(daysBetween('2026-03-04', '2026-03-01')).toBe(-3)
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1)
    expect(daysBetween('2026-05-05', '2026-05-05')).toBe(0)
  })
})
