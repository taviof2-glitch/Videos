import { describe, expect, it } from 'vitest'
import { cutList, cutListText, DEFAULT_SPECS, KERF, pack, SHEET } from './cutlist'

const find = (kind: keyof typeof DEFAULT_SPECS, name: string) => cutList(DEFAULT_SPECS[kind]).find((p) => p.name === name)

describe('despiece', () => {
  it('escritorio de 120 × 75 × 60 con 2 cajones', () => {
    expect(find('escritorio', 'Cubierta')).toMatchObject({ qty: 1, largo: 120, ancho: 60 })
    expect(find('escritorio', 'Costado')).toMatchObject({ qty: 2, largo: 73.4, ancho: 60 })
    expect(find('escritorio', 'Faldón trasero')).toMatchObject({ qty: 1, largo: 116.8, ancho: 35 })
    expect(find('escritorio', 'Frente de cajón')).toMatchObject({ qty: 2 })
    expect(find('escritorio', 'Lateral de cajón')).toMatchObject({ qty: 4, largo: 55, ancho: 12 })
    expect(find('escritorio', 'Fondo de cajón')).toMatchObject({ qty: 2, material: 'fondo' })
  })

  it('closet: costados de piso a techo, divisiones y entrepaños al hueco', () => {
    expect(find('closet', 'Costado')).toMatchObject({ qty: 2, largo: 240, ancho: 60 })
    expect(find('closet', 'Techo')).toMatchObject({ largo: 176.8, ancho: 60 })
    expect(find('closet', 'División vertical')).toMatchObject({ qty: 1, largo: 236.8, ancho: 58 })
    // hueco = (176.8 − 1.6) / 2 = 87.6
    expect(find('closet', 'Entrepaño')).toMatchObject({ qty: 4, largo: 87.4, ancho: 58 })
    expect(find('closet', 'Fondo trasero')).toMatchObject({ material: 'fondo' })
  })

  it('mueble bajo: lleva zoclo y amarres en vez de techo', () => {
    const names = cutList(DEFAULT_SPECS.bajo).map((p) => p.name)
    expect(names).toContain('Zoclo')
    expect(names).toContain('Amarre superior')
    expect(names).not.toContain('Techo')
    expect(find('bajo', 'Puerta')).toMatchObject({ qty: 2, largo: 79.7, ancho: 49.7 })
  })

  it('sin puertas ni cajones no salen esas piezas', () => {
    const names = cutList({ ...DEFAULT_SPECS.alacena, puertas: 0, cajones: 0 }).map((p) => p.name)
    expect(names.some((n) => /Puerta|cajón/.test(n))).toBe(false)
  })
})

describe('acomodo en hojas de 244 × 122', () => {
  for (const kind of Object.keys(DEFAULT_SPECS) as (keyof typeof DEFAULT_SPECS)[]) {
    it(`${kind}: todas las piezas caben, dentro de la hoja y sin encimarse`, () => {
      const pieces = cutList(DEFAULT_SPECS[kind])
      for (const material of ['melamina', 'fondo'] as const) {
        const { sheets, tooBig } = pack(pieces, material)
        const total = pieces.filter((p) => p.material === material && !tooBig.includes(p)).reduce((a, p) => a + p.qty, 0)
        expect(sheets.reduce((a, s) => a + s.pieces.length, 0)).toBe(total)
        for (const s of sheets) {
          for (const p of s.pieces) {
            expect(p.x + p.w).toBeLessThanOrEqual(SHEET.largo + 0.01)
            expect(p.y + p.h).toBeLessThanOrEqual(SHEET.ancho + 0.01)
          }
          for (const a of s.pieces) for (const b of s.pieces) {
            if (a === b) continue
            const apart = a.x + a.w + KERF <= b.x + 0.01 || b.x + b.w + KERF <= a.x + 0.01 || a.y + a.h + KERF <= b.y + 0.01 || b.y + b.h + KERF <= a.y + 0.01
            expect(apart).toBe(true)
          }
        }
      }
    })
  }

  it('un escritorio sin cajones sale de una hoja de melamina; el closet necesita varias', () => {
    expect(pack(cutList({ ...DEFAULT_SPECS.escritorio, cajones: 0 }), 'melamina').sheets.length).toBe(1)
    expect(pack(cutList(DEFAULT_SPECS.closet), 'melamina').sheets.length).toBeGreaterThan(2)
  })

  it('respetando la veta ninguna pieza va atravesada', () => {
    const pieces = cutList(DEFAULT_SPECS.escritorio)
    for (const s of pack(pieces, 'melamina', false).sheets) for (const p of s.pieces) expect(p.w).toBeGreaterThanOrEqual(p.h)
  })

  it('avisa de la pieza que no cabe en una hoja', () => {
    const spec = { ...DEFAULT_SPECS.closet, largo: 300 }
    expect(pack(cutList(spec), 'melamina').tooBig.map((p) => p.name)).toContain('Techo')
    expect(cutListText(spec)).toContain('no cabe en una hoja')
  })

  it('el texto lleva título, hojas y cada pieza con su medida', () => {
    const text = cutListText(DEFAULT_SPECS.escritorio)
    expect(text).toContain('*Despiece: Escritorio de 120 × 75 × 60 cm*')
    expect(text).toMatch(/Melamina de 16 mm\* — 2 hojas de 244 × 122 cm/)
    expect(text).toContain('1 × Cubierta: 120 × 60 cm')
  })
})
