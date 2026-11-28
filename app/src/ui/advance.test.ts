import { describe, expect, it } from 'vitest'
import { halfOf, toInput } from './advance'

describe('anticipo', () => {
  it('50 % del total, sin pasar de lo que falta', () => {
    expect(halfOf(900000)).toBe(450000)
    expect(halfOf(900000, 200000)).toBe(200000)
    expect(halfOf(333)).toBe(167)
    expect(toInput(450000)).toBe('4500.00')
    expect(toInput(0)).toBe('')
  })
})
