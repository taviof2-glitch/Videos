import { describe, expect, it } from 'vitest'
import { drawerModules, modules, modulesSummary, cutList, cutListText, DEFAULT_SPECS, furnitureLabels, KERF, pack, projectPieces, SHEET } from './cutlist'

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

describe('proyecto con varios muebles', () => {
  const proyecto = [DEFAULT_SPECS.escritorio, DEFAULT_SPECS.tv, { ...DEFAULT_SPECS.tv, largo: 120 }]

  it('con un solo mueble sale igual que antes', () => {
    expect(projectPieces([DEFAULT_SPECS.tv])).toEqual(cutList(DEFAULT_SPECS.tv))
  })

  it('cada pieza lleva el nombre de su mueble y los repetidos se numeran', () => {
    expect(furnitureLabels(proyecto)).toEqual(['Escritorio', 'Mueble de TV 1', 'Mueble de TV 2'])
    const pieces = projectPieces(proyecto)
    expect(pieces.filter((p) => p.name.startsWith('Mueble de TV 2 · ')).length).toBe(cutList(proyecto[2]).length)
    expect(pieces.length).toBe(proyecto.reduce((n, s) => n + cutList(s).length, 0))
  })

  it('todas las piezas se acomodan juntas y gastan menos hojas que cada mueble por separado', () => {
    const juntas = pack(projectPieces(proyecto), 'melamina').sheets
    const total = projectPieces(proyecto).filter((p) => p.material === 'melamina').reduce((a, p) => a + p.qty, 0)
    expect(juntas.reduce((a, s) => a + s.pieces.length, 0)).toBe(total)
    const separadas = proyecto.reduce((n, s) => n + pack(cutList(s), 'melamina').sheets.length, 0)
    expect(juntas.length).toBeLessThanOrEqual(separadas)
    for (const s of juntas) for (const p of s.pieces) {
      expect(p.x + p.w).toBeLessThanOrEqual(SHEET.largo + 0.01)
      expect(p.y + p.h).toBeLessThanOrEqual(SHEET.ancho + 0.01)
    }
  })

  it('el texto lista los muebles del proyecto', () => {
    const text = cutListText(proyecto)
    expect(text).toContain('*Despiece: Proyecto de 3 muebles*')
    expect(text).toContain('Mueble de TV 2: 120 × 45 × 40 cm')
    expect(text).toContain('Escritorio · Cubierta: 120 × 60 cm')
  })
})

describe('cocina por módulos de 1 m como máximo', () => {
  const bajo = (largo: number, reparto?: 'auto' | 'metro' | 'iguales') => ({ ...DEFAULT_SPECS.bajo, largo, reparto })

  it('reparte el largo según la regla', () => {
    expect(modules(bajo(100))).toEqual([100])
    expect(modules(bajo(80))).toEqual([80])
    expect(modules(bajo(150))).toEqual([75, 75]) // hasta 2 m: en dos iguales
    expect(modules(bajo(200))).toEqual([100, 100])
    expect(modules(bajo(250))).toEqual([100, 100, 50]) // más largo: de 1 m y el resto
    expect(modules(bajo(320))).toEqual([80, 80, 80, 80]) // el resto quedaría de 20 cm: partes iguales
    expect(modules(bajo(150, 'metro'))).toEqual([100, 50])
    expect(modules(bajo(250, 'iguales'))).toEqual([83.3, 83.3, 83.3])
    for (const l of [101, 150, 250, 333, 480]) for (const r of ['auto', 'metro', 'iguales'] as const) expect(Math.max(...modules(bajo(l, r)))).toBeLessThanOrEqual(100)
    expect(modules({ ...DEFAULT_SPECS.closet, largo: 250 })).toEqual([250]) // solo la cocina va por módulos
    expect(modulesSummary(bajo(250))).toBe('3 módulos: 100 + 100 + 50 cm')
  })

  it('cada módulo es un mueble completo: costados, piso, amarres, zoclo, puertas y fondo', () => {
    const p = cutList(bajo(250))
    const get = (name: string) => p.find((x) => x.name === name)
    expect(get('Costado')).toMatchObject({ qty: 6, largo: 80, ancho: 58 }) // 3 módulos × 2
    expect(get('Piso (módulo de 100)')).toMatchObject({ qty: 2, largo: 96.8 })
    expect(get('Piso (módulo de 50)')).toMatchObject({ qty: 1, largo: 58, ancho: 46.8 })
    // 2 + 2 puertas en los módulos de 1 m y una sola en el angosto; como miden lo mismo, van en una línea
    expect(get('Puerta')).toMatchObject({ qty: 5, largo: 79.7, ancho: 49.7 })
    expect(get('Zoclo (módulo de 100)')).toMatchObject({ qty: 2, largo: 100 })
    expect(p.every((x) => x.largo <= 244)).toBe(true)
  })

  it('con módulos iguales no hace falta decir de cuál es cada pieza', () => {
    const names = cutList(bajo(200)).map((x) => x.name)
    expect(names).toContain('Piso')
    expect(names.some((n) => n.includes('módulo'))).toBe(false)
    expect(cutList(bajo(200)).find((x) => x.name === 'Puerta')).toMatchObject({ qty: 4 })
  })
})

describe('cocina: cajones solo en algunos módulos', () => {
  const cocina = (extra: object) => ({ ...DEFAULT_SPECS.bajo, largo: 300, ...extra })
  const get = (spec: ReturnType<typeof cocina>, name: string) => cutList(spec).find((x) => x.name === name)

  it('3 cajones en 1 de 3 módulos: una cajonera completa y los otros dos con puertas', () => {
    const s = cocina({ cajones: 3, modCajones: 1 })
    expect(drawerModules(s)).toBe(1)
    expect(get(s, 'Frente de cajón')).toMatchObject({ qty: 3, largo: 98.1, ancho: 26.4 }) // 80 / 3 − 0.3 de alto
    expect(get(s, 'Puerta')).toMatchObject({ qty: 4 }) // 2 módulos × 2 puertas
    expect(get(s, 'Entrepaño')).toMatchObject({ qty: 2 })
    expect(get(s, 'Puerta bajo cajones')).toBeUndefined()
    expect(get(s, 'Costado')).toMatchObject({ qty: 6 })
  })

  it('1 cajón arriba en 2 módulos: llevan puertas más cortas debajo', () => {
    const s = cocina({ cajones: 1, modCajones: 2 })
    expect(get(s, 'Frente de cajón')).toMatchObject({ qty: 2, ancho: 17.7 })
    expect(get(s, 'Puerta bajo cajones')).toMatchObject({ qty: 4, largo: 61.7 }) // 80 − 18 − 0.3
    expect(get(s, 'Puerta')).toMatchObject({ qty: 2, largo: 79.7 })
  })

  it('sin indicar cuántos, va en un solo módulo; nunca más módulos de los que hay', () => {
    expect(drawerModules(cocina({ cajones: 2 }))).toBe(1)
    expect(drawerModules(cocina({ cajones: 2, modCajones: 9 }))).toBe(3)
    expect(drawerModules(cocina({ cajones: 0, modCajones: 2 }))).toBe(0)
  })
})

describe('closet por torres, con puertas corredizas y tubos', () => {
  const closet = (extra: object = {}) => ({ ...DEFAULT_SPECS.closet, ...extra })
  const get = (spec: ReturnType<typeof closet>, name: string) => cutList(spec).find((x) => x.name === name)

  it('cajones y entrepaños son por torre', () => {
    const s = closet({ divisiones: 2, cajones: 2, entrepanos: 3 }) // 3 torres
    expect(get(s, 'Frente de cajón')).toMatchObject({ qty: 6 })
    expect(get(s, 'Entrepaño')).toMatchObject({ qty: 9 })
    expect(get(s, 'División vertical')).toMatchObject({ qty: 2 })
  })

  it('los tubos van al ancho de la torre y no entran en las hojas', () => {
    const s = closet({ tubos: 3 })
    expect(get(s, 'Tubo para colgar')).toMatchObject({ qty: 3, largo: 87.1, material: 'tubo' }) // hueco 87.6 − 0.5
    expect(pack(cutList(s), 'melamina').sheets.flatMap((x) => x.pieces).some((p) => p.name.startsWith('Tubo'))).toBe(false)
    expect(cutListText(s)).toContain('3 × Tubo para colgar: 87.1 cm')
  })

  it('puertas corredizas: se enciman 3 cm, más cortas por el riel y mínimo 2', () => {
    const s = closet({ puertas: 2, puertaTipo: 'corrediza' as const })
    expect(get(s, 'Puerta corrediza')).toMatchObject({ qty: 2, largo: 236, ancho: 91.5 }) // (180 + 3) / 2
    expect(get(s, 'Puerta')).toBeUndefined()
    expect(get(closet({ puertas: 1, puertaTipo: 'corrediza' as const }), 'Puerta corrediza')).toMatchObject({ qty: 2 })
    expect(get(closet({ puertas: 2 }), 'Puerta')).toMatchObject({ qty: 2, largo: 239.7, ancho: 89.7 })
  })
})
