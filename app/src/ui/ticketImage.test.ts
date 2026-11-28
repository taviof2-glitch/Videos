import { describe, expect, it } from 'vitest'
import { ticketImageSize } from './ticketImage'

describe('imagen del comprobante', () => {
  it('el tamaño crece con las líneas y las columnas, con margen alrededor', () => {
    const a = ticketImageSize(20, 44, 13.2, 22, 28)
    expect(a).toEqual({ width: Math.ceil(44 * 13.2 + 56), height: 20 * 32 + 56, lineHeight: 32 })
    expect(ticketImageSize(40, 44, 13.2, 22, 28).height).toBeGreaterThan(a.height)
    expect(ticketImageSize(20, 80, 13.2, 22, 28).width).toBeGreaterThan(a.width)
    expect(ticketImageSize(0, 44, 13.2, 22, 28).height).toBe(56)
  })
})
