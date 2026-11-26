// Despiece: de las medidas de un mueble a la lista de piezas por cortar y su acomodo en hojas de 2.44 × 1.22 m.
// Todo en centímetros. Es una guía de taller: las fórmulas son las de un mueble de melamina armado «costados por fuera».

export const SHEET = { largo: 244, ancho: 122 }
/** Lo que se come el disco en cada corte (cm). */
export const KERF = 0.4

export type FurnitureKind = 'bajo' | 'alacena' | 'closet' | 'tv' | 'escritorio'
export const KIND_LABEL: Record<FurnitureKind, string> = {
  bajo: 'Cocina – mueble bajo',
  alacena: 'Cocina – alacena',
  closet: 'Closet',
  tv: 'Mueble de TV',
  escritorio: 'Escritorio',
}

export type CutSpec = {
  kind: FurnitureKind
  largo: number
  alto: number
  fondo: number
  puertas: number
  cajones: number
  entrepanos: number
  divisiones: number
  /** Grosor de la melamina en mm. */
  grosor: number
}

export const DEFAULT_SPECS: Record<FurnitureKind, CutSpec> = {
  bajo: { kind: 'bajo', largo: 100, alto: 90, fondo: 58, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 0, grosor: 16 },
  alacena: { kind: 'alacena', largo: 100, alto: 70, fondo: 32, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 0, grosor: 16 },
  closet: { kind: 'closet', largo: 180, alto: 240, fondo: 60, puertas: 0, cajones: 3, entrepanos: 4, divisiones: 1, grosor: 16 },
  tv: { kind: 'tv', largo: 180, alto: 45, fondo: 40, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 2, grosor: 16 },
  escritorio: { kind: 'escritorio', largo: 120, alto: 75, fondo: 60, puertas: 0, cajones: 2, entrepanos: 0, divisiones: 0, grosor: 16 },
}

export type Material = 'melamina' | 'fondo'
export type Piece = { name: string; qty: number; largo: number; ancho: number; material: Material }

const r1 = (n: number) => Math.round(n * 10) / 10
const int = (n: number) => Math.max(0, Math.round(n || 0))

/** Alto del zoclo de los muebles bajos, ancho de los amarres, alto de la caja y del frente de un cajón, y ancho de la cajonera del escritorio. */
const ZOCLO = 10
const AMARRE = 10
const CAJA_CAJON = 12
const FRENTE_CAJON = 18
const CAJONERA = 40
/** Holgura de puertas y frentes, y lo que ocupa cada corredera. */
const LUZ = 0.3
const CORREDERA = 1.3

/** Las piezas de un mueble. Se omiten las que salen sin medida. */
export function cutList(s: CutSpec): Piece[] {
  const t = Math.max(0.3, (s.grosor || 16) / 10)
  const L = Math.max(0, s.largo)
  const H = Math.max(0, s.alto)
  const F = Math.max(0, s.fondo)
  const puertas = int(s.puertas)
  const cajones = int(s.cajones)
  const entrepanos = int(s.entrepanos)
  const divisiones = int(s.divisiones)
  const out: Piece[] = []
  const add = (name: string, qty: number, largo: number, ancho: number, material: Material = 'melamina') => {
    if (qty > 0 && largo > 0 && ancho > 0) out.push({ name, qty, largo: r1(Math.max(largo, ancho)), ancho: r1(Math.min(largo, ancho)), material })
  }

  /** Las piezas de los cajones para un hueco de ese ancho. */
  const drawers = (hueco: number, frenteAlto: number) => {
    const caja = hueco - 2 * CORREDERA
    add('Frente de cajón', cajones, hueco + t - LUZ, frenteAlto - LUZ)
    add('Lateral de cajón', cajones * 2, F - 5, CAJA_CAJON)
    add('Frente y trasera de caja', cajones * 2, caja - 2 * t, CAJA_CAJON)
    add('Fondo de cajón', cajones, caja - 0.2, F - 5, 'fondo')
  }

  if (s.kind === 'escritorio') {
    add('Cubierta', 1, L, F)
    add('Costado', 2, H - t, F)
    add('Faldón trasero', 1, L - 2 * t, 35)
    if (cajones) {
      add('División de cajonera', 1, H - t, F - 2)
      add('Piso de cajonera', 1, CAJONERA, F - 2)
      drawers(CAJONERA, Math.min(FRENTE_CAJON, (H - t - 5) / cajones))
    }
    return out
  }

  const bajo = s.kind === 'bajo'
  const cuerpo = bajo ? H - ZOCLO : H
  const interior = L - 2 * t
  const hueco = (interior - divisiones * t) / (divisiones + 1)
  add('Costado', 2, cuerpo, F)
  add('Piso', 1, interior, F)
  if (bajo) {
    add('Amarre superior', 2, interior, AMARRE)
    add('Zoclo', 1, L, ZOCLO)
  } else add('Techo', 1, interior, F)
  add('División vertical', divisiones, cuerpo - (bajo ? t : 2 * t), F - 2)
  add('Entrepaño', entrepanos, hueco - 0.2, F - 2)
  if (puertas) add('Puerta', puertas, cuerpo - LUZ, L / puertas - LUZ)
  if (cajones) drawers(hueco, FRENTE_CAJON)
  add('Fondo trasero', 1, cuerpo - 0.4, L - 0.4, 'fondo')
  return out
}

/** Nombre corto de cada mueble en la lista de un proyecto («Mueble de TV», «Closet 2»…). */
export function furnitureLabels(specs: CutSpec[]): string[] {
  const total: Partial<Record<FurnitureKind, number>> = {}
  for (const s of specs) total[s.kind] = (total[s.kind] ?? 0) + 1
  const seen: Partial<Record<FurnitureKind, number>> = {}
  return specs.map((s) => {
    seen[s.kind] = (seen[s.kind] ?? 0) + 1
    return (total[s.kind] ?? 0) > 1 ? `${KIND_LABEL[s.kind]} ${seen[s.kind]}` : KIND_LABEL[s.kind]
  })
}

/**
 * Las piezas de todo un proyecto. Con un solo mueble salen igual que en `cutList`; con varios, cada pieza lleva
 * el nombre de su mueble por delante y todas se acomodan juntas en las mismas hojas.
 */
export function projectPieces(specs: CutSpec[]): Piece[] {
  if (specs.length === 1) return cutList(specs[0])
  const labels = furnitureLabels(specs)
  return specs.flatMap((s, i) => cutList(s).map((p) => ({ ...p, name: `${labels[i]} · ${p.name}` })))
}

export type Placed = { name: string; x: number; y: number; w: number; h: number }
export type SheetLayout = { pieces: Placed[]; usedPct: number }
export type Packing = { sheets: SheetLayout[]; tooBig: Piece[] }

/**
 * Acomoda las piezas de un material en hojas. Cada pieza va al hueco libre donde mejor ajusta y el sobrante del hueco
 * se parte en dos con un corte recto, así todo sale con cortes de lado a lado (como en la escuadradora).
 * Con `girar` las piezas pueden ir atravesadas; sin él conservan el sentido de la veta (su largo a lo largo de la hoja).
 */
export function pack(pieces: Piece[], material: Material, girar = true): Packing {
  const all: { name: string; w: number; h: number }[] = []
  const tooBig: Piece[] = []
  for (const p of pieces.filter((x) => x.material === material)) {
    if (p.largo > SHEET.largo || p.ancho > SHEET.ancho) tooBig.push(p)
    else for (let i = 0; i < p.qty; i++) all.push({ name: p.name, w: p.largo, h: p.ancho })
  }
  all.sort((a, b) => b.w * b.h - a.w * a.h || b.w - a.w)
  type Free = { x: number; y: number; w: number; h: number }
  const sheets: { free: Free[]; pieces: Placed[] }[] = []
  const EPS = 0.001
  for (const p of all) {
    const options = girar && p.w !== p.h ? [[p.w, p.h], [p.h, p.w]] : [[p.w, p.h]]
    let best: { sheet: number; free: number; w: number; h: number; score: number } | undefined
    const tryFit = (si: number) => {
      sheets[si].free.forEach((f, fi) => {
        for (const [w, h] of options) {
          if (w > f.w + EPS || h > f.h + EPS) continue
          const score = Math.min(f.w - w, f.h - h)
          if (!best || score < best.score) best = { sheet: si, free: fi, w, h, score }
        }
      })
    }
    for (let si = 0; si < sheets.length && !best; si++) tryFit(si)
    if (!best) {
      sheets.push({ free: [{ x: 0, y: 0, w: SHEET.largo, h: SHEET.ancho }], pieces: [] })
      tryFit(sheets.length - 1)
    }
    const { sheet, free, w, h } = best!
    const sh = sheets[sheet]
    const f = sh.free.splice(free, 1)[0]
    sh.pieces.push({ name: p.name, x: r1(f.x), y: r1(f.y), w, h })
    const right = f.w - w - KERF
    const below = f.h - h - KERF
    // El corte largo se da por el lado que deja el sobrante más aprovechable.
    if (right > below) {
      if (right > 0) sh.free.push({ x: f.x + w + KERF, y: f.y, w: right, h: f.h })
      if (below > 0) sh.free.push({ x: f.x, y: f.y + h + KERF, w, h: below })
    } else {
      if (below > 0) sh.free.push({ x: f.x, y: f.y + h + KERF, w: f.w, h: below })
      if (right > 0) sh.free.push({ x: f.x + w + KERF, y: f.y, w: right, h })
    }
  }
  const area = SHEET.largo * SHEET.ancho
  return { sheets: sheets.map((s) => ({ pieces: s.pieces, usedPct: Math.round((s.pieces.reduce((a, q) => a + q.w * q.h, 0) / area) * 100) })), tooBig }
}

const num = (n: number) => String(r1(n))
export const specTitle = (s: CutSpec) => `${KIND_LABEL[s.kind]} de ${num(s.largo)} × ${num(s.alto)} × ${num(s.fondo)} cm`
export const projectTitle = (specs: CutSpec[]) => (specs.length === 1 ? specTitle(specs[0]) : `Proyecto de ${specs.length} muebles`)

/** La lista para copiar o mandar por WhatsApp. */
export function cutListText(input: CutSpec | CutSpec[], girar = true, saved?: Piece[]): string {
  const specs = Array.isArray(input) ? input : [input]
  const s = specs[0]
  const pieces = saved ?? projectPieces(specs)
  const out = [`*Despiece: ${projectTitle(specs)}*`]
  if (specs.length > 1) furnitureLabels(specs).forEach((label, i) => out.push(`${label}: ${num(specs[i].largo)} × ${num(specs[i].alto)} × ${num(specs[i].fondo)} cm`))
  for (const [material, label] of [['melamina', `Melamina de ${s.grosor} mm`], ['fondo', 'Fondo de 3 mm']] as const) {
    const mine = pieces.filter((p) => p.material === material)
    if (!mine.length) continue
    const { sheets, tooBig } = pack(pieces, material, girar)
    out.push('', `*${label}* — ${sheets.length} ${sheets.length === 1 ? 'hoja' : 'hojas'} de 244 × 122 cm`)
    for (const p of mine) out.push(`${p.qty} × ${p.name}: ${num(p.largo)} × ${num(p.ancho)} cm`)
    for (const p of tooBig) out.push(`⚠ ${p.name} (${num(p.largo)} × ${num(p.ancho)} cm) no cabe en una hoja: hay que unir dos piezas.`)
  }
  return out.join('\n')
}
