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
