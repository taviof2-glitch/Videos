// Despiece: de las medidas de un mueble a la lista de piezas por cortar y su acomodo en hojas de 2.44 × 1.22 m.
// Todo en centímetros. Es una guía de taller: las fórmulas son las de un mueble de melamina armado «costados por fuera».

export const SHEET = { largo: 244, ancho: 122 }
/** Lo que se come el disco en cada corte (cm). */
export const KERF = 0.4

export type FurnitureKind = 'bajo' | 'alacena' | 'closet' | 'tv' | 'escritorio' | 'librero' | 'bano' | 'barra'
export const KIND_LABEL: Record<FurnitureKind, string> = {
  bajo: 'Cocina – mueble bajo',
  alacena: 'Cocina – alacena',
  closet: 'Closet',
  tv: 'Mueble de TV',
  escritorio: 'Escritorio',
  librero: 'Librero',
  bano: 'Mueble de baño',
  barra: 'Barra / mostrador',
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
  /** Cocina: cómo se reparte el largo en módulos de 1 m como máximo. */
  reparto?: Reparto
  /** Cocina: cuántos módulos son de cajones (los demás son de puertas). Si hay cajones y no se indica, uno. */
  modCajones?: number
  /** Closet: puertas abatibles (con bisagras) o corredizas (con riel). */
  puertaTipo?: PuertaTipo
  /** Closet: cuántos tubos para colgar. */
  tubos?: number
  /** Closet: lleva maletero (entrepaño corrido arriba de las torres). Si no se indica, sí. */
  maletero?: boolean
  /** Closet: costados exteriores de piso a techo. 0 = empotrado entre muros. */
  costados?: number
}

export type PuertaTipo = 'abatible' | 'corrediza'
export const PUERTA_LABEL: Record<PuertaTipo, string> = { abatible: 'Abatibles (con bisagras)', corrediza: 'Corredizas (con riel)' }

export const DEFAULT_SPECS: Record<FurnitureKind, CutSpec> = {
  bajo: { kind: 'bajo', largo: 100, alto: 90, fondo: 58, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 0, grosor: 15 },
  alacena: { kind: 'alacena', largo: 100, alto: 70, fondo: 32, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 0, grosor: 15 },
  closet: { kind: 'closet', largo: 240, alto: 240, fondo: 60, puertas: 0, cajones: 2, entrepanos: 3, divisiones: 1, grosor: 15, tubos: 2, puertaTipo: 'abatible', maletero: true, costados: 0 },
  tv: { kind: 'tv', largo: 180, alto: 45, fondo: 40, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 2, grosor: 15 },
  escritorio: { kind: 'escritorio', largo: 120, alto: 75, fondo: 60, puertas: 0, cajones: 2, entrepanos: 0, divisiones: 0, grosor: 15 },
  librero: { kind: 'librero', largo: 90, alto: 180, fondo: 30, puertas: 0, cajones: 0, entrepanos: 4, divisiones: 0, grosor: 15 },
  bano: { kind: 'bano', largo: 80, alto: 60, fondo: 45, puertas: 2, cajones: 0, entrepanos: 1, divisiones: 0, grosor: 15 },
  barra: { kind: 'barra', largo: 150, alto: 105, fondo: 45, puertas: 0, cajones: 0, entrepanos: 1, divisiones: 1, grosor: 15 },
}

/** «tubo» no es de hoja: se corta a lo largo (su ancho es 0) y no entra en el acomodo. */
export type Material = 'melamina' | 'fondo' | 'tubo'
export type Piece = { name: string; qty: number; largo: number; ancho: number; material: Material }

const r1 = (n: number) => Math.round(n * 10) / 10
const int = (n: number) => Math.max(0, Math.round(n || 0))

/** Alto del zoclo de los muebles bajos, ancho de los amarres, alto de la caja y del frente de un cajón, y ancho de la cajonera del escritorio. */
const ZOCLO = 10
const AMARRE = 10
const CAJA_CAJON = 12
const FRENTE_CAJON = 18
const CAJONERA = 40
/** Lo que se enciman dos puertas corredizas y lo que se les quita de alto por el riel. */
const TRASLAPE = 3
const RIEL = 4
/** Cuántos módulos de cocina llevan cajones. */
export const drawerModules = (s: Pick<CutSpec, 'kind' | 'largo' | 'reparto' | 'cajones' | 'modCajones'>) =>
  isKitchen(s.kind) && int(s.cajones) > 0 ? Math.min(modules(s).length, int(s.modCajones ?? 1)) : 0
/** Las torres que se pidieron para un closet (se guardan como divisiones + 1). */
export const towers = (s: Pick<CutSpec, 'divisiones'>) => int(s.divisiones) + 1
/** Ancho y fondo de cada torre de closet: siempre 60 cm, para dejar espacio libre a los lados. */
export const TORRE = 60
/** Alto del maletero de un closet (cm). */
export const MALETERO = 40
export const hasMaletero = (s: Pick<CutSpec, 'maletero'>) => s.maletero !== false
/** Costados exteriores de un closet: 0 (empotrado), 1 o 2. */
export const outerSides = (s: Pick<CutSpec, 'costados'>) => Math.min(2, int(s.costados ?? 0))

/**
 * Cómo queda un closet: `n` torres de 60 cm (las que quepan) y el resto del largo libre para colgar.
 * Con una torre el espacio libre queda a un lado; con varias, las torres van a los extremos y repartidas, con un espacio entre cada dos.
 */
export function closetLayout(s: Pick<CutSpec, 'largo' | 'divisiones'>): { n: number; ancho: number; libre: number; espacios: number; espacio: number } {
  const L = Math.max(0, s.largo)
  const ancho = Math.min(TORRE, L)
  const n = Math.max(1, Math.min(towers(s), Math.floor(L / TORRE + 1e-9) || 1))
  const libre = r1(Math.max(0, L - n * ancho))
  const espacios = libre > 0 ? (n === 1 ? 1 : n - 1) : 0
  return { n, ancho, libre, espacios, espacio: espacios ? r1(libre / espacios) : 0 }
}

/** Holgura de puertas y frentes, y lo que ocupa cada corredera. */
const LUZ = 0.3
const CORREDERA = 1.3

export type Reparto = 'auto' | 'metro' | 'iguales'
export const REPARTO_LABEL: Record<Reparto, string> = { auto: 'Automático', metro: 'De 1 m y el resto', iguales: 'Partes iguales' }
/** Largo máximo de un módulo de cocina (cm). */
export const MODULO_MAX = 100
export const isKitchen = (kind: FurnitureKind) => kind === 'bajo' || kind === 'alacena'

/**
 * Los módulos de un mueble de cocina: nunca de más de 1 m. Hasta 1 m es un solo módulo.
 * «metro»: partes de 1 m y la última con lo que sobra. «iguales»: todas del mismo largo.
 * «auto»: en 2 iguales si pasa de 1 m sin llegar a más de 2 m; si es más largo, de 1 m y el resto
 * (salvo que el resto quede de menos de 30 cm: entonces partes iguales). Los demás muebles van en una pieza.
 */
export function modules(s: Pick<CutSpec, 'kind' | 'largo' | 'reparto'>): number[] {
  const L = Math.max(0, s.largo)
  if (!isKitchen(s.kind) || L <= MODULO_MAX) return [L]
  const n = Math.ceil(L / MODULO_MAX - 1e-9)
  const rest = L - (n - 1) * MODULO_MAX
  const mode = s.reparto ?? 'auto'
  const equal = mode === 'iguales' || (mode === 'auto' && (n === 2 || rest < 30))
  return equal ? Array.from({ length: n }, () => r1(L / n)) : [...Array.from({ length: n - 1 }, () => MODULO_MAX), r1(rest)]
}

/** «3 módulos: 100 + 100 + 50 cm» (vacío si el mueble va en una pieza). */
export function modulesSummary(s: Pick<CutSpec, 'kind' | 'largo' | 'reparto'>): string {
  const m = modules(s)
  return m.length > 1 ? `${m.length} módulos: ${m.map((x) => String(r1(x))).join(' + ')} cm` : ''
}

/**
 * Las piezas de un mueble. Se omiten las que salen sin medida.
 * - Cocina: se arma por módulos (ver `modules`). Hay módulos con puertas (con sus entrepaños) y módulos con cajones
 *   (`modCajones`; solo cajones, con los frentes repartidos en todo el alto). Puertas y cajones son por módulo.
 * - Closet: torres sueltas de 60 × 60 cm con espacio libre entre ellas; cajones y entrepaños son por torre;
 *   las puertas (abatibles o corredizas) cubren todo el largo; los tubos van en los espacios libres. Puede llevar
 *   maletero (entrepaño corrido arriba) y 0, 1 o 2 costados exteriores (0 = empotrado entre muros).
 */
export function cutList(s: CutSpec): Piece[] {
  const t = Math.max(0.3, (s.grosor || 15) / 10)
  const L = Math.max(0, s.largo)
  const H = Math.max(0, s.alto)
  const F = Math.max(0, s.fondo)
  const cajones = int(s.cajones)
  const entrepanos = int(s.entrepanos)
  const divisiones = int(s.divisiones)
  const raw: (Piece & { modulo: number })[] = []
  let modulo = 0
  const add = (name: string, qty: number, largo: number, ancho: number, material: Material = 'melamina') => {
    if (qty > 0 && largo > 0 && ancho > 0) raw.push({ name, qty, largo: r1(Math.max(largo, ancho)), ancho: r1(Math.min(largo, ancho)), material, modulo })
  }

  /** Las piezas de `n` cajones para un hueco de ese ancho. */
  const drawers = (n: number, hueco: number, frenteAlto: number) => {
    const caja = hueco - 2 * CORREDERA
    add('Frente de cajón', n, hueco + t - LUZ, frenteAlto - LUZ)
    add('Lateral de cajón', n * 2, F - 5, CAJA_CAJON)
    add('Frente y trasera de caja', n * 2, caja - 2 * t, CAJA_CAJON)
    add('Fondo de cajón', n, caja - 0.2, F - 5, 'fondo')
  }

  if (s.kind === 'escritorio') {
    add('Cubierta', 1, L, F)
    add('Costado', 2, H - t, F)
    add('Faldón trasero', 1, L - 2 * t, 35)
    if (cajones) {
      add('División de cajonera', 1, H - t, F - 2)
      add('Piso de cajonera', 1, CAJONERA, F - 2)
      drawers(cajones, CAJONERA, Math.min(FRENTE_CAJON, (H - t - 5) / cajones))
    }
    return raw.map(({ modulo: _m, ...p }) => p)
  }

  if (s.kind === 'closet') {
    const { n, ancho, espacio } = closetLayout(s)
    const D = TORRE
    const interior = ancho - 2 * t
    // Con maletero las torres llegan hasta su piso; sin él, de piso a techo.
    const HT = hasMaletero(s) ? H - MALETERO - t : H
    add('Costado de torre', 2 * n, HT, D)
    add('Piso de torre', n, interior, D)
    add('Techo de torre', n, interior, D)
    add('Entrepaño', entrepanos * n, interior - 0.2, D - 2)
    const puertas = int(s.puertas)
    if (s.puertaTipo === 'corrediza' && puertas) {
      const k = Math.max(2, puertas)
      add('Puerta corrediza', k, H - RIEL, (L + TRASLAPE * (k - 1)) / k)
    } else if (puertas) add('Puerta', puertas, H - LUZ, L / puertas - LUZ)
    if (cajones) {
      const caja = interior - 2 * CORREDERA
      add('Frente de cajón', cajones * n, interior - LUZ, FRENTE_CAJON - LUZ)
      add('Lateral de cajón', cajones * n * 2, D - 5, CAJA_CAJON)
      add('Frente y trasera de caja', cajones * n * 2, caja - 2 * t, CAJA_CAJON)
      add('Fondo de cajón', cajones * n, caja - 0.2, D - 5, 'fondo')
    }
    add('Fondo de torre', n, HT - 0.4, ancho - 0.4, 'fondo')
    if (hasMaletero(s)) {
      // El piso del maletero corre todo el largo; si no cabe en una hoja se parte en tramos iguales.
      const tramos = Math.max(1, Math.ceil(L / SHEET.largo - 1e-9))
      add('Piso de maletero', tramos, L / tramos, D)
    }
    add('Costado exterior', outerSides(s), H, D)
    const tubos = int(s.tubos ?? 0)
    if (tubos && espacio > 1) raw.push({ name: 'Tubo para colgar', qty: tubos, largo: r1(espacio - 0.5), ancho: 0, material: 'tubo', modulo })
    return raw.map(({ modulo: _m, ...p }) => p)
  }

  const bajo = s.kind === 'bajo'
  const kitchen = isKitchen(s.kind)
  const cuerpo = bajo ? H - ZOCLO : H
  // Cada largo de módulo distinto se despieza una vez y se multiplica por cuántos hay de ese largo.
  const widths = modules(s)
  // Los cajones van en los primeros módulos (los más largos).
  const conCajones = drawerModules(s)
  for (const w of [...new Set(widths)]) {
    modulo = w
    const veces = widths.filter((x) => x === w).length
    const nCaj = kitchen ? widths.slice(0, conCajones).filter((x) => x === w).length : 0
    const interior = w - 2 * t
    const hueco = (interior - divisiones * t) / (divisiones + 1)
    add('Costado', 2 * veces, cuerpo, F)
    add('Piso', veces, interior, F)
    if (bajo) {
      add('Amarre superior', 2 * veces, interior, AMARRE)
      add('Zoclo', veces, w, ZOCLO)
    } else add('Techo', veces, interior, F)
    add('División vertical', divisiones * veces, cuerpo - (bajo ? t : 2 * t), F - 2)
    add('Fondo trasero', veces, cuerpo - 0.4, w - 0.4, 'fondo')

    if (kitchen) {
      // Un módulo angosto lleva una sola puerta.
      const puertas = Math.min(int(s.puertas), widths.length > 1 && w <= 60 ? 1 : Infinity)
      // Módulos con puertas: sus puertas y entrepaños.
      add('Entrepaño', entrepanos * (veces - nCaj), hueco - 0.2, F - 2)
      if (puertas) add('Puerta', puertas * (veces - nCaj), cuerpo - LUZ, w / puertas - LUZ)
      // Módulos con cajones: solo cajones, con los frentes repartidos en todo el alto.
      if (nCaj) drawers(cajones * nCaj, interior, cuerpo / cajones)
      continue
    }

    add('Entrepaño', entrepanos, hueco - 0.2, F - 2)
    const puertas = int(s.puertas)
    if (puertas) add('Puerta', puertas, cuerpo - LUZ, w / puertas - LUZ)
    if (cajones) drawers(cajones, hueco, FRENTE_CAJON)
  }
  // Piezas iguales de módulos distintos se juntan; si una misma pieza cambia de medida según el módulo, se dice de cuál es.
  const merged: (Piece & { modulo: number })[] = []
  for (const p of raw) {
    const same = merged.find((m) => m.name === p.name && m.largo === p.largo && m.ancho === p.ancho && m.material === p.material)
    if (same) same.qty += p.qty
    else merged.push({ ...p })
  }
  return merged.map(({ modulo: m, ...p }) => (merged.filter((x) => x.name === p.name).length > 1 ? { ...p, name: `${p.name} (módulo de ${r1(m)})` } : p))
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

/**
 * Metros de cubrecanto: puertas, frentes de cajón y cubiertas llevan canto en sus cuatro lados; las demás piezas
 * de melamina, solo en el lado largo que queda a la vista (el frente). Las piezas ocultas del cajón no llevan.
 */
export function edgeMeters(pieces: Piece[]): number {
  let cm = 0
  for (const p of pieces) {
    if (p.material !== 'melamina') continue
    const name = p.name.includes(' · ') ? p.name.slice(p.name.lastIndexOf(' · ') + 3) : p.name
    if (/^(Lateral de cajón|Frente y trasera de caja|Amarre|Zoclo)/.test(name)) continue
    cm += p.qty * (/^(Puerta|Frente de cajón|Cubierta)/.test(name) ? 2 * (p.largo + p.ancho) : p.largo)
  }
  return Math.round(cm / 10) / 10
}

export type Placed = { name: string; x: number; y: number; w: number; h: number }
/** `rest`: el sobrante rectangular más grande de la hoja (un retazo aprovechable), en cm. */
export type SheetLayout = { pieces: Placed[]; usedPct: number; rest: { w: number; h: number }; /** Todos los huecos libres de la hoja (cm). */ free: { w: number; h: number }[] }
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
  const biggest = (free: Free[]) => free.reduce((m, f) => (f.w * f.h > m.w * m.h ? { w: r1(Math.max(f.w, f.h)), h: r1(Math.min(f.w, f.h)) } : m), { w: 0, h: 0 })
  return { sheets: sheets.map((s) => ({ pieces: s.pieces, usedPct: Math.round((s.pieces.reduce((a, q) => a + q.w * q.h, 0) / area) * 100), rest: biggest(s.free), free: s.free.map((f) => ({ w: r1(f.w), h: r1(f.h) })) })), tooBig }
}

const num = (n: number) => String(r1(n))
export const specTitle = (s: CutSpec) => `${KIND_LABEL[s.kind]} de ${num(s.largo)} × ${num(s.alto)} × ${num(s.fondo)} cm${modulesSummary(s) ? ` (${modulesSummary(s)})` : ''}`
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
  const canto = edgeMeters(pieces)
  if (canto > 0) out.push('', `*Canto*: ${canto} m`)
  const tubes = pieces.filter((p) => p.material === 'tubo')
  if (tubes.length) {
    out.push('', '*Tubos*')
    for (const p of tubes) out.push(`${p.qty} × ${p.name}: ${num(p.largo)} cm`)
  }
  return out.join('\n')
}
