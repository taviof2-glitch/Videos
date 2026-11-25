import { describe, expect, it } from 'vitest'
import { parseMoney } from './money'
import { normalizeNumber } from './number'
import { parseQuantity } from './quantity'

describe('números con separador de miles', () => {
  it('importes', () => {
    expect(parseMoney('1,500')).toBe(150000)
    expect(parseMoney('1,250.50')).toBe(125050)
    expect(parseMoney('$1500')).toBe(150000)
    expect(parseMoney('1.250,50')).toBe(125050)
    expect(parseMoney('12,345,678')).toBe(1234567800)
    expect(parseMoney('12,50')).toBe(1250)
    expect(parseMoney('1500.555')).toBeNull()
    expect(parseMoney('1,50,0')).toBeNull()
  })
  it('cantidades', () => {
    expect(parseQuantity('1,500')).toBe(1500)
    expect(parseQuantity('0,250')).toBe(0.25)
    expect(parseQuantity('2,5')).toBe(2.5)
    expect(parseQuantity('1,500.25')).toBe(1500.25)
  })
  it('no confunde basura con número', () => {
    for (const x of ['', ' ', 'abc', '-3', '1..2', ',', '.5a']) expect(normalizeNumber(x)).toBeNull()
  })
})
