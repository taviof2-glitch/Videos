// Asistente de cocinas: reparte cada pared en módulos de medidas estándar (máximo 1 m) respetando fregadero, estufa y refri,
// y avisa de los errores de diseño más comunes. Medidas en mm.
import type { BaseOpts, BaseState } from './bases'

export type Forma = 'lineal' | 'L' | 'U' | 'paralela'
export type Pared = 'A' | 'B' | 'C'
export type Spot = { pared: Pared; /** Distancia desde el inicio de la pared hasta la orilla del aparato (mm). */ pos: number; ancho: number }

export type KitchenState = {
  forma: Forma
  /** Largo de cada pared en mm (B solo en L y U; C solo en U). */
  paredes: Record<Pared, number>
  fregadero: Spot
  estufa: Spot
  refri: Spot
  alacenas: boolean
  torre: boolean
  /** La lista editada a mano; si falta, se reparte sola. */
  modules?: KModule[]
}

export type KKind = 'bajo' | 'cajonera' | 'fregadero' | 'estufa' | 'refri' | 'esquinero' | 'ajuste' | 'alacena' | 'torre'
export type KModule = { id: string; pared: Pared; kind: KKind; ancho: number }

export const KIND_NAME: Record<KKind, string> = {
  bajo: 'Puertas', cajonera: 'Cajonera', fregadero: 'Fregadero', estufa: 'Estufa', refri: 'Refri', esquinero: 'Esquinero', ajuste: 'Ajuste', alacena: 'Alacena', torre: 'Torre',
}

/** Anchos estándar de módulo (mm), de costado a costado por fuera. Nunca más de 1 m. */
export const STD = [1000, 900, 800, 750, 600, 500, 450, 400, 300]
const CORNER = 900
const TOWER = 600

export const DEFAULT_KITCHEN: KitchenState = {
  forma: 'L', paredes: { A: 3000, B: 2400, C: 2000 },
  fregadero: { pared: 'A', pos: 1200, ancho: 900 }, estufa: { pared: 'B', pos: 300, ancho: 600 }, refri: { pared: 'A', pos: 0, ancho: 750 },
  alacenas: true, torre: false,
}

export const walls = (k: Pick<KitchenState, 'forma'>): Pared[] => (k.forma === 'lineal' ? ['A'] : k.forma === 'L' || k.forma === 'paralela' ? ['A', 'B'] : ['A', 'B', 'C'])

/** Pasillo entre las dos filas de una cocina paralela (mm, de frente a frente) más los fondos de 550. */
const PASILLO = 1200

/**
 * Llena un tramo con anchos estándar: deja de 0 a 100 mm de sobrante (para el panel de ajuste) y usa los menos módulos posibles.
 * Devuelve los anchos y el sobrante.
 */
export function fill(len: number): { mods: number[]; rest: number } {
  if (len < 300) return { mods: [], rest: Math.max(0, len) }
  const u = 10
  const n = Math.floor(len / u)
  const best: (number[] | undefined)[] = new Array(n + 1)
  best[0] = []
  for (let i = 1; i <= n; i++) {
    for (const w of STD) {
      const prev = best[i - w / u]
      if (i - w / u < 0 || !prev) continue
      const cand = [...prev, w]
      if (!best[i] || cand.length < best[i]!.length) best[i] = cand
    }
  }
  // El sobrante más chico posible (hasta 100 mm), y con eso, los menos módulos.
  for (let rest = 0; rest <= 100; rest += u) {
    const i = n - rest / u
    if (i >= 0 && best[i]) return { mods: [...best[i]!].sort((a, b) => b - a), rest: len - i * u }
  }
  // No se pudo dejar ≤ 100: se usa el mejor posible.
  for (let i = n; i >= 0; i--) if (best[i]) return { mods: [...best[i]!].sort((a, b) => b - a), rest: len - i * u }
  return { mods: [], rest: len }
}

let seq = 0
const id = () => `m${++seq}`

/** Lo que ocupa cada pared: esquineros en las esquinas y los aparatos en su lugar; lo demás se reparte. */
export function planKitchen(k: KitchenState): KModule[] {
  const out: KModule[] = []
  for (const pared of walls(k)) {
    const len = Math.max(0, k.paredes[pared] || 0)
    // Tramos ocupados: [inicio, fin, módulo].
    const fixed: [number, number, KModule][] = []
    const cornerAtEnd = (k.forma === 'L' && pared === 'A') || (k.forma === 'U' && pared === 'B')
    const cornerAtStart = k.forma === 'U' && pared === 'B'
    const blockedStart = (k.forma === 'L' && pared === 'B') || (k.forma === 'U' && pared === 'C') ? CORNER : 0
    const blockedEnd = k.forma === 'U' && pared === 'A' ? CORNER : 0
    if (cornerAtStart) fixed.push([0, CORNER, { id: id(), pared, kind: 'esquinero', ancho: CORNER }])
    if (cornerAtEnd) fixed.push([len - CORNER, len, { id: id(), pared, kind: 'esquinero', ancho: CORNER }])
    if (blockedStart) fixed.push([0, blockedStart, { id: id(), pared, kind: 'ajuste', ancho: 0 }])
    if (blockedEnd) fixed.push([len - blockedEnd, len, { id: id(), pared, kind: 'ajuste', ancho: 0 }])
    for (const [kind, s] of [['fregadero', k.fregadero], ['estufa', k.estufa], ['refri', k.refri]] as const) {
      if (s.pared !== pared || !walls(k).includes(s.pared)) continue
      const start = Math.max(blockedStart, Math.min(len - s.ancho, s.pos))
      fixed.push([start, start + s.ancho, { id: id(), pared, kind, ancho: s.ancho }])
    }
    if (k.torre && pared === 'A') {
      // Al principio de la pared, después de lo que ya esté ahí (por ejemplo el refri).
      let start = 0
      for (const [a, b] of [...fixed].sort((x, y) => x[0] - y[0])) if (a < start + TOWER && b > start) start = b
      if (start + TOWER <= len) fixed.push([start, start + TOWER, { id: id(), pared, kind: 'torre', ancho: TOWER }])
    }
    fixed.sort((a, b) => a[0] - b[0])
    let at = 0
    const free = (end: number) => {
      const gap = end - at
      if (gap <= 0) return
      const { mods, rest } = fill(gap)
      for (const w of mods) out.push({ id: id(), pared, kind: 'bajo', ancho: w })
      if (rest >= 20) out.push({ id: id(), pared, kind: 'ajuste', ancho: Math.round(rest) })
    }
    for (const [a, b, m] of fixed) {
      free(a)
      if (m.ancho > 0) out.push(m)
      at = Math.max(at, b)
    }
    free(len)
  }
  if (k.alacenas) {
    // Alacenas arriba de los bajos (no sobre la estufa ni el refri, ni en las esquinas).
    for (const m of [...out]) if (m.kind === 'bajo' || m.kind === 'cajonera' || m.kind === 'fregadero') out.push({ id: id(), pared: m.pared, kind: 'alacena', ancho: m.ancho })
  }
  return out
}

export const modulesOf = (k: KitchenState) => k.modules ?? planKitchen(k)

/** Cómo se arma cada módulo en Bases (con las opciones de la cocina). */
export function moduleState(m: KModule, opts: BaseOpts): BaseState | undefined {
  const o = { ...opts, iguales: 1, cubierta: false }
  const base = { alto: 780, fondo: 550 }
  switch (m.kind) {
    case 'bajo': return { key: 'coc_bajo', values: { ...base, ancho: m.ancho, puertas: m.ancho >= 600 ? 2 : 1, repisas: 1 }, opts: o }
    case 'cajonera': return { key: 'coc_caj', values: { ...base, ancho: m.ancho, cajones: 3 }, opts: o }
    case 'fregadero': return { key: 'coc_fregadero', values: { ...base, ancho: m.ancho, puertas: m.ancho >= 600 ? 2 : 1 }, opts: o }
    case 'estufa': return { key: 'coc_bajo', values: { ...base, ancho: m.ancho, puertas: 2, repisas: 0 }, opts: o }
    case 'esquinero': return { key: 'esquinero_L', values: { ladoA: CORNER, ladoB: CORNER, alto: 780, fondo: 550 }, opts: o }
    case 'alacena': return { key: 'alacena', values: { ancho: m.ancho, alto: 700, fondo: 300, puertas: m.ancho >= 600 ? 2 : 1, repisas: 1 }, opts: o }
    case 'torre': return { key: 'torre', values: { ancho: m.ancho, alto: 2100, fondo: 600, repisas: 4, puertas: 2 }, opts: o }
    default: return undefined
  }
}

/** Metros de cubierta: lo que corre sobre los bajos (sin refri, torre ni alacenas). */
export const counterMeters = (mods: KModule[]) => mods.filter((m) => ['bajo', 'cajonera', 'fregadero', 'estufa', 'esquinero', 'ajuste'].includes(m.kind)).reduce((a, m) => a + m.ancho, 0) / 1000

/** Centro de un aparato en el plano (mm). A va en X; en L, B sube desde el final de A; en U, A y C suben y B va al fondo. */
function point(k: KitchenState, s: Spot): [number, number] {
  const c = s.pos + s.ancho / 2
  const { A, B } = k.paredes
  if (k.forma === 'lineal') return [c, 0]
  if (k.forma === 'paralela') return s.pared === 'A' ? [c, 0] : [c, PASILLO + 2 * 550]
  if (k.forma === 'L') return s.pared === 'A' ? [c, 0] : [A, c]
  if (s.pared === 'B') return [c, A]
  if (s.pared === 'A') return [0, A - c]
  return [B, A - c]
}

/** Avisos de diseño: triángulo de trabajo, aparatos entre módulos, huecos y alacenas. */
export function kitchenWarnings(k: KitchenState): string[] {
  const out: string[] = []
  const ws = walls(k)
  const spots = [['fregadero', k.fregadero], ['estufa', k.estufa], ['refri', k.refri]] as const
  for (const [n, s] of spots) if (!ws.includes(s.pared)) out.push(`El ${n} está en una pared que esta forma no tiene.`)
  if (out.length) return out
  const p = Object.fromEntries(spots.map(([n, s]) => [n, point(k, s)])) as Record<string, [number, number]>
  const d = (a: string, b: string) => Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1]) / 1000
  const sides: [string, number][] = [['fregadero–estufa', d('fregadero', 'estufa')], ['estufa–refri', d('estufa', 'refri')], ['refri–fregadero', d('refri', 'fregadero')]]
  for (const [n, m] of sides) {
    if (m < 1.2) out.push(`Triángulo de trabajo: ${n} queda a ${m.toFixed(2)} m (lo cómodo es de 1.2 a 2.7 m).`)
    else if (m > 2.7) out.push(`Triángulo de trabajo: ${n} queda a ${m.toFixed(2)} m (más de 2.7 m cansa).`)
  }
  const sameWall = (a: Spot, b: Spot) => a.pared === b.pared && a.pos < b.pos + b.ancho && b.pos < a.pos + a.ancho
  if (sameWall(k.fregadero, k.estufa)) out.push('El fregadero y la estufa se enciman: muévelos.')
  if (sameWall(k.fregadero, k.refri) || sameWall(k.estufa, k.refri)) out.push('El refri se encima con otro aparato: muévelo.')
  if (k.refri.ancho < 750) out.push('Para un refri de 70 cm deja un hueco de 75.')
  return out
}

export function kitchenTitle(k: KitchenState): string {
  const ws = walls(k)
  const forma = k.forma === 'lineal' ? 'lineal' : k.forma === 'paralela' ? 'paralela' : `en ${k.forma}`
  return `Cocina ${forma} ${ws.map((w) => k.paredes[w]).join(' + ')} mm`
}
