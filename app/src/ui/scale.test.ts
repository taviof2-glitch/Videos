import { describe, expect, it } from 'vitest'
import { niceScale } from './scale'

describe('escala de la gráfica', () => {
  it('tope y paso redondos que cubren el máximo', () => {
    expect(niceScale(0)).toEqual({ top: 4, step: 1 })
    expect(niceScale(100)).toEqual({ top: 100, step: 50 })
    expect(niceScale(820000)).toEqual({ top: 1000000, step: 500000 })
    expect(niceScale(37)).toEqual({ top: 40, step: 10 })
    expect(niceScale(9)).toEqual({ top: 10, step: 5 })
    for (const max of [1, 7, 99, 1234, 56789, 170000]) {
      const { top, step } = niceScale(max)
      expect(top).toBeGreaterThanOrEqual(max)
      expect(top / step).toBeLessThanOrEqual(5)
      expect([1, 2, 5].includes(step / 10 ** Math.floor(Math.log10(step)))).toBe(true)
    }
  })
})
