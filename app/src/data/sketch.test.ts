import { describe, expect, it } from 'vitest'
import { DEFAULT_SPECS } from './cutlist'
import { sketch, type Shape } from './sketch'

const count = (shapes: Shape[], role: string) => shapes.filter((s) => s.t !== 'text' && s.role === role).length

describe('boceto 2D', () => {
  it('cocina de 3 m con una cajonera: 3 módulos, 3 cajones y 4 puertas', () => {
    const sk = sketch({ ...DEFAULT_SPECS.bajo, largo: 300, cajones: 3, modCajones: 1 })
    expect(count(sk.shapes, 'body')).toBe(3)
    expect(count(sk.shapes, 'drawer')).toBe(3)
    expect(count(sk.shapes, 'door')).toBe(4)
    expect(count(sk.shapes, 'zoclo')).toBe(1)
    expect(sk.notes).toContain('3 módulos')
  })

  it('con 1 cajón arriba el módulo conserva sus puertas debajo', () => {
    const sk = sketch({ ...DEFAULT_SPECS.bajo, cajones: 1 })
    expect(count(sk.shapes, 'drawer')).toBe(1)
    expect(count(sk.shapes, 'door')).toBe(2)
    const door = sk.shapes.find((s) => s.t === 'rect' && s.role === 'door') as Extract<Shape, { t: 'rect' }>
    expect(door.y).toBeGreaterThan(17)
  })

  it('closet: torres, cajones y entrepaños por torre, tubos y puertas punteadas', () => {
    const sk = sketch({ ...DEFAULT_SPECS.closet, divisiones: 2, cajones: 2, entrepanos: 3, tubos: 3, puertas: 2, puertaTipo: 'corrediza' })
    expect(count(sk.shapes, 'split')).toBe(2)
    expect(count(sk.shapes, 'drawer')).toBe(6)
    expect(count(sk.shapes, 'shelf')).toBe(9)
    expect(count(sk.shapes, 'tube')).toBe(3)
    expect(count(sk.shapes, 'ghost')).toBe(2)
    expect(sk.notes.join(' ')).toContain('2 puertas corredizas')
  })

  it('escritorio: cubierta, dos costados y sus cajones', () => {
    const sk = sketch(DEFAULT_SPECS.escritorio)
    expect(count(sk.shapes, 'top')).toBe(1)
    expect(count(sk.shapes, 'drawer')).toBe(2)
  })

  it('todo queda dentro del mueble y lleva sus medidas', () => {
    for (const spec of Object.values(DEFAULT_SPECS)) {
      const sk = sketch(spec)
      for (const s of sk.shapes) {
        if (s.t === 'rect') {
          expect(s.x).toBeGreaterThanOrEqual(-2)
          expect(s.x + s.w).toBeLessThanOrEqual(sk.w + 2)
          expect(s.y + s.h).toBeLessThanOrEqual(sk.h + 0.1)
        }
      }
      const dims = sk.shapes.filter((s) => s.t === 'text' && s.role === 'dim').map((s) => (s as Extract<Shape, { t: 'text' }>).text)
      expect(dims).toEqual([`${spec.largo} cm`, `${spec.alto} cm`])
    }
  })
})
