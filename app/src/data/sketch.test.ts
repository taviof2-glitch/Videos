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

  it('un módulo de cajones lleva solo cajones', () => {
    const sk = sketch({ ...DEFAULT_SPECS.bajo, cajones: 2, modCajones: 1 })
    expect(count(sk.shapes, 'drawer')).toBe(2)
    expect(count(sk.shapes, 'door')).toBe(0)
  })

  it('closet: torres de 60 con espacio libre, cajones y entrepaños por torre, tubos y puertas punteadas', () => {
    const sk = sketch({ ...DEFAULT_SPECS.closet, divisiones: 2, cajones: 2, entrepanos: 3, tubos: 3, puertas: 2, puertaTipo: 'corrediza' })
    const torres = sk.shapes.filter((s) => s.t === 'rect' && s.role === 'body') as Extract<Shape, { t: 'rect' }>[]
    expect(torres.map((t) => [t.x, t.w])).toEqual([[0, 60], [90, 60], [180, 60]]) // 240 cm: 3 torres y 2 espacios de 30
    expect(count(sk.shapes, 'drawer')).toBe(6)
    expect(count(sk.shapes, 'shelf')).toBe(9)
    expect(count(sk.shapes, 'tube')).toBe(3)
    expect(count(sk.shapes, 'ghost')).toBe(3) // el contorno del closet y sus 2 puertas
    expect(sk.notes.join(' ')).toContain('2 puertas corredizas')
    expect(sk.notes).toContain('3 torres de 60')
  })

  it('closet: el maletero baja las torres y los costados exteriores se dibujan', () => {
    const con = sketch({ ...DEFAULT_SPECS.closet, costados: 2 })
    const torre = con.shapes.find((s) => s.t === 'rect' && s.role === 'body') as Extract<Shape, { t: 'rect' }>
    expect(torre).toMatchObject({ y: 40, h: 200 })
    expect(count(con.shapes, 'zoclo')).toBe(2)
    expect(con.notes).toEqual(expect.arrayContaining(['con maletero', '2 costados exteriores']))
    const sin = sketch({ ...DEFAULT_SPECS.closet, maletero: false })
    expect((sin.shapes.find((s) => s.t === 'rect' && s.role === 'body') as Extract<Shape, { t: 'rect' }>).y).toBe(0)
    expect(sin.notes).toContain('empotrado')
    expect(sin.notes).not.toContain('con maletero')
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

describe('boceto del closet sencillo', () => {
  it('dibuja laterales, techo, zoclo, 2 tubos y las medidas', async () => {
    const { simpleClosetSketch } = await import('./sketch')
    const sk = simpleClosetSketch({ ancho: 90, alto: 210, fondo: 50, tubos: 2, repisas: 0 })
    expect(sk.w).toBe(90)
    expect(sk.h).toBe(210)
    expect(sk.shapes.filter((s) => s.t === 'line' && s.role === 'tube')).toHaveLength(2)
    expect(sk.shapes.some((s) => s.t === 'rect' && s.role === 'zoclo')).toBe(true)
    expect(sk.notes).toContain('2 tubos')
  })
})
