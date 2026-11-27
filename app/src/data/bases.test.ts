import { describe, expect, it } from 'vitest'
import { buildBase, calcBase, cutCsv, cutText, defaultOpts, defaultValues, edgeText, packSheets, slideFor, templateOf, TEMPLATES, type BaseState } from './bases'
import { DEFAULT_CONFIG, priceFromCost } from './quoter'

const cfg = DEFAULT_CONFIG
const state = (key: string, values: Record<string, number>, opts: Partial<BaseState['opts']> = {}): BaseState => {
  const t = templateOf(key)
  return { key, values: { ...defaultValues(t), ...values }, opts: { ...defaultOpts(cfg, t), ...opts } }
}
const piece = (s: BaseState, name: string) => buildBase(s, cfg).pieces.find((p) => p.n === name)
const dims = (s: BaseState, name: string) => { const p = piece(s, name); return p && [p.l, p.a, p.q] }

describe('fórmulas de los planos (tablero de 18)', () => {
  it('alacena de 900×600×300 con 2 puertas', () => {
    const s = state('alacena', { ancho: 900, alto: 600, fondo: 300, puertas: 2, repisas: 1 }, { esp: 18 })
    expect(dims(s, 'Base y techo')).toEqual([864, 300, 2])
    expect(dims(s, 'Repisa')).toEqual([864, 278, 1])
    expect(dims(s, 'Amarre para colgar')).toEqual([864, 100, 1])
    expect(dims(s, 'Puerta')).toEqual([594, 442, 2])
    expect(dims(s, 'Fondo')).toEqual([878, 578, 1])
  })
  it('alacena de 600×800×300: puertas de 292×794 y fondo de 578×778', () => {
    const s = state('alacena', { ancho: 600, alto: 800, fondo: 300, puertas: 2 }, { esp: 18 })
    expect(dims(s, 'Puerta')).toEqual([794, 292, 2])
    expect(dims(s, 'Fondo')).toEqual([778, 578, 1])
  })
  it('bajo de cocina de 900 × 780 × 550: base 864×550 y fondo 878×758', () => {
    const s = state('coc_bajo', { ancho: 900, alto: 780, fondo: 550 }, { esp: 18 })
    expect(dims(s, 'Base')).toEqual([864, 550, 1])
    expect(dims(s, 'Fondo')).toEqual([878, 758, 1])
  })
  it('cajonera de 550 × 550: base 514, frente de cajón 452, tapa 544, corredera de 50', () => {
    const s = state('coc_caj', { ancho: 550, fondo: 550 }, { esp: 18 })
    expect(dims(s, 'Base')).toEqual([550, 514, 1])
    expect(piece(s, 'Frente y contrafrente de cajón')!.l).toBe(452)
    expect(piece(s, 'Tapa de cajón')!.l).toBe(544)
    expect(Object.keys(buildBase(s, cfg).hw.corr)).toEqual(['500'])
  })
})

describe('cajones (anexo A)', () => {
  it('fondo libre de 500 → corredera de 45 y lateral de 480; de 450 → 40 y 430', () => {
    expect(slideFor(500)).toEqual({ lc: 450, lateral: 480 })
    expect(slideFor(450)).toEqual({ lc: 400, lateral: 430 })
  })
  it('cómoda de 450 de fondo: corredera de 40 y lateral de 430', () => {
    const s = state('comoda', { fondo: 450 }, { esp: 18 })
    expect(piece(s, 'Lateral de cajón')!.l).toBe(430)
    expect(Object.keys(buildBase(s, cfg).hw.corr)).toEqual(['400'])
  })
})

describe('roperos (anexo A)', () => {
  it('estilo B de 1800×1800×500 con zoclo de 80: techo 1800, base 1764, laterales 1782, fondo de 1720 en 2 partes', () => {
    const s = state('ropero', { alto: 1800, ancho: 1800, fondo: 500, zoclo: 80, tapeta: 0 }, { esp: 18, estilo: 'B' })
    expect(dims(s, 'Techo')).toEqual([1800, 500, 1])
    expect(dims(s, 'Base')).toEqual([1764, 500, 1])
    expect(dims(s, 'Lateral')).toEqual([1782, 500, 2])
    expect(dims(s, 'Fondo (en 2 partes)')).toEqual([1720, 900, 2])
  })
  it('estilo A de 1800×1200×500 con zoclo 80 y tapeta 50: laterales 1800, techo y base 1164, fondo 1670×1200', () => {
    const s = state('ropero', { alto: 1800, ancho: 1200, fondo: 500, zoclo: 80, tapeta: 50 }, { esp: 18, estilo: 'A' })
    expect(dims(s, 'Lateral')).toEqual([1800, 500, 2])
    expect(dims(s, 'Techo y base')).toEqual([1164, 500, 2])
    expect(dims(s, 'Fondo')).toEqual([1670, 1200, 1])
  })
  it('corredizas de 2300 de alto y 1700 de ancho: 2 hojas de 2122×842', () => {
    const s = state('ropero', { alto: 2300, ancho: 1700, fondo: 600, corrediza: 1 }, { esp: 18 })
    expect(dims(s, 'Hoja corrediza')).toEqual([2122, 842, 2])
  })
})

describe('escritorio y presets', () => {
  it('tablero de 1200×450 y alto de 780: laterales de 762 con tablero de 18', () => {
    const s = state('escritorio', { ancho: 1200, fondo: 450, alto: 780 }, { esp: 18 })
    expect(piece(s, 'Pata lateral')!.l).toBe(762)
  })
  it('los presets del ropero rellenan las medidas', () => {
    const r9 = templateOf('ropero').presets!.find((p) => p.name.startsWith('R9'))!
    expect(r9.v).toMatchObject({ alto: 2300, ancho: 1700, fondo: 600, corrediza: 1, cajones: 8 })
  })
})

describe('acomodo en hojas', () => {
  it('una alacena de 900×700×300 con tablero de 16 cabe en una hoja de 2440×1830', () => {
    const r = calcBase(state('alacena', { alto: 700 }), { ...cfg, hojaA: 1830 })
    expect(r.board.sheets.length).toBe(1)
    expect(r.board.sheets[0].usedPct).toBeGreaterThan(0)
  })
  it('con veta ninguna pieza sale girada', () => {
    const r = calcBase(state('ropero', {}, { veta: true }), cfg)
    expect(r.board.sheets.flatMap((s) => s.placed).every((p) => !p.rot)).toBe(true)
  })
  it('una pieza más grande que la hoja se avisa', () => {
    const lay = packSheets([{ n: 'Lateral', l: 2600, a: 500, q: 1, e: 'D---' }], [0], { l: 2440, a: 1220, sierra: 4, refile: 10 }, false)
    expect(lay.tooBig).toEqual([0])
  })
  it('la hoja de 2440×2150 usa menos hojas que la de 2440×1220', () => {
    const s = state('ropero', { ancho: 2000 })
    expect(calcBase(s, { ...cfg, hojaA: 2150 }).board.sheets.length).toBeLessThan(calcBase(s, cfg).board.sheets.length)
  })
})

describe('precio, texto y CSV', () => {
  it('el precio de Bases es el mismo que en Cotizar como «otro» con ese material y esas horas', () => {
    const r = calcBase(state('coc_bajo', {}), cfg)
    const p = priceFromCost(cfg, r.material, r.hours, 5)
    expect(p.priceCents % 5000).toBe(0)
    expect(p.materialCents).toBe(Math.round(r.material * 100))
  })
  it('«cuántos iguales» multiplica piezas y horas', () => {
    const one = calcBase(state('buro', {}), cfg)
    const three = calcBase(state('buro', {}, { iguales: 3 }), cfg)
    expect(three.built.pieces[0].q).toBe(one.built.pieces[0].q * 3)
    expect(three.hours).toBeCloseTo(one.hours * 3)
  })
  it('texto para la maderería y CSV con cantos', () => {
    const s = state('alacena', {})
    const r = calcBase(s, cfg)
    const text = cutText(s, r, cfg)
    expect(text).toContain('1. Lateral — 700 x 300 mm — 2 pzas — canto: 1 largo y 2 anchos')
    expect(text).toMatch(/Hojas de 2440×1220: \d/)
    const csv = cutCsv(r, true).split('\n')
    expect(csv[0]).toBe('Pieza,Largo,Ancho,Cantidad,CantoL1,CantoL2,CantoA1,CantoA2,Veta')
    expect(csv[1]).toBe('Lateral,700,300,2,D,,D,D,Sí')
    expect(edgeText('GGGG')).toBe('4 lados grueso')
  })
})

describe('más muebles de los catálogos', () => {
  it('cama alta para colchón de 900×1900: base de 1964×1000 y 1400 libres abajo', () => {
    const s = state('cama_alta', { colchon: 1, libre: 1400 })
    expect(dims(s, 'Base de la cama')).toEqual([1964, 1000, 1])
    expect(buildBase(s, cfg).notes.join(' ')).toContain('1400')
  })
  it('zapatera de 30 de fondo: corredera de 25', () => {
    expect(Object.keys(buildBase(state('zapatera', { fondo: 300, cajones: 1 }), cfg).hw.corr)).toEqual(['250'])
  })
  it('todos los muebles se arman con sus valores iniciales y tienen precio', () => {
    for (const t of TEMPLATES) {
      const r = calcBase(state(t.key, {}), cfg)
      if (t.key !== 'cocina') expect(r.built.pieces.length, t.key).toBeGreaterThan(0)
      expect(r.built.pieces.every((p) => p.l > 0 && p.a > 0 && Number.isFinite(p.l) && Number.isFinite(p.a)), t.key).toBe(true)
      expect(r.material, t.key).toBeGreaterThan(0)
    }
  })
  it('la cubierta de piedra cuesta más que la postformada y lo que va al piso lleva deslizadores', () => {
    const post = calcBase(state('barra', {}, { cubierta: true }), cfg).material
    const piedra = calcBase(state('barra', {}, { cubierta: true, cubiertaTipo: 'piedra' }), cfg).material
    expect(piedra).toBeGreaterThan(post)
    expect(calcBase(state('comoda', {}), cfg).deslizadores).toBe(4)
  })
})

describe('SketchCut PRO (.sct)', () => {
  it('escribe la hoja, cada pieza con su cantidad y una posición por copia, como el archivo de ejemplo', async () => {
    const { sketchCutFile } = await import('./bases')
    const r = calcBase(state('tv', {}), cfg)
    const lines = sketchCutFile(r, cfg).split('\n')
    expect(lines[0]).toBe('<V3.0>')
    expect(lines[2]).toBe(`2440X1220_${r.board.sheets.length}`)
    expect(lines[24]).toBe(`<Parts>${r.boardIdx.length}`)
    const first = r.built.pieces[r.boardIdx[0]]
    expect(lines[25]).toBe(`${first.l}X${first.a}X${first.q}`)
    const code = (ch: string) => (ch === 'D' ? 3 : ch === 'G' ? 2 : 0)
    expect(lines[26]).toBe(`${code(first.e[0])}X${code(first.e[1])}_${code(first.e[2])}X${code(first.e[3])}`)
    expect(lines[27]).toBe('10')
    expect(lines.slice(28, 28 + first.q).every((l) => /^1[01]\d+_-1X\d+X\d+$/.test(l))).toBe(true)
    expect(lines.slice(-5)).toEqual(['<NSnips>0', '8', '15', '4', ''])
    const placed = lines.filter((l) => /_-1X/.test(l)).length
    expect(placed).toBe(r.boardIdx.reduce((a, i) => a + r.built.pieces[i].q, 0))
  })
})
