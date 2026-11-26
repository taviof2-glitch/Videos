// Boceto 2D (vista de frente) de un mueble a partir de sus medidas. Solo geometría, en centímetros;
// la pantalla lo dibuja como SVG. Es una muestra para platicar con el cliente, no un plano de taller.
import { drawerModules, isKitchen, modules, towers, type CutSpec } from './cutlist'

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; role: 'body' | 'door' | 'drawer' | 'zoclo' | 'top' | 'ghost' }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; role: 'shelf' | 'tube' | 'handle' | 'split' }
  | { t: 'text'; x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; role: 'dim' | 'note' }

export type Sketch = { w: number; h: number; shapes: Shape[]; notes: string[] }

const int = (n: number | undefined) => Math.max(0, Math.round(n || 0))
const r1 = (n: number) => Math.round(n * 10) / 10
const ZOCLO = 10
const FRENTE = 18
/** Separación que se deja ver entre frentes. */
const GAP = 0.8

export function sketch(s: CutSpec): Sketch {
  const L = Math.max(1, s.largo)
  const H = Math.max(1, s.alto)
  const out: Shape[] = []
  const notes: string[] = []
  const rect = (role: Extract<Shape, { t: 'rect' }>['role'], x: number, y: number, w: number, h: number) => {
    if (w > 0 && h > 0) out.push({ t: 'rect', role, x: r1(x), y: r1(y), w: r1(w), h: r1(h) })
  }
  const line = (role: Extract<Shape, { t: 'line' }>['role'], x1: number, y1: number, x2: number, y2: number) => out.push({ t: 'line', role, x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2) })
  /** Jaladera: una rayita en la puerta (vertical) o en el cajón (horizontal). */
  const pull = (x: number, y: number, vertical: boolean, size: number) => (vertical ? line('handle', x, y - size / 2, x, y + size / 2) : line('handle', x - size / 2, y, x + size / 2, y))
  const pullSize = Math.max(4, Math.min(12, Math.min(L, H) / 8))

  /** `n` puertas lado a lado; las jaladeras van hacia el centro del par. */
  const doors = (x: number, y: number, w: number, h: number, n: number) => {
    const dw = w / n
    for (let i = 0; i < n; i++) {
      rect('door', x + i * dw + GAP / 2, y + GAP / 2, dw - GAP, h - GAP)
      const right = n === 1 ? true : i % 2 === 0
      pull(x + i * dw + (right ? dw - 4 : 4), y + Math.min(h / 2, h - 8), true, pullSize)
    }
  }
  /** `n` cajones apilados de arriba hacia abajo. */
  const drawers = (x: number, y: number, w: number, each: number, n: number) => {
    for (let i = 0; i < n; i++) {
      rect('drawer', x + GAP / 2, y + i * each + GAP / 2, w - GAP, each - GAP)
      pull(x + w / 2, y + i * each + each / 2, false, Math.min(pullSize * 1.4, w / 3))
    }
  }

  if (s.kind === 'escritorio') {
    const t = 3
    const n = int(s.cajones)
    rect('top', 0, 0, L, t)
    rect('body', 0, t, t, H - t)
    rect('body', L - t, t, t, H - t)
    rect('ghost', t, t, L - 2 * t, Math.min(35, H - t))
    if (n) {
      const cw = Math.min(40, L / 2)
      const x = L - t - cw
      const each = Math.min(FRENTE, (H - t - 5) / n)
      rect('body', x, t, cw, H - t)
      drawers(x, t, cw, each, n)
    }
  } else if (isKitchen(s.kind)) {
    const bajo = s.kind === 'bajo'
    const cuerpo = bajo ? Math.max(1, H - ZOCLO) : H
    const widths = modules(s)
    const conCajones = drawerModules(s)
    const cajones = int(s.cajones)
    let x = 0
    widths.forEach((w, i) => {
      rect('body', x, 0, w, cuerpo)
      const puertas = Math.min(int(s.puertas), widths.length > 1 && w <= 60 ? 1 : Infinity)
      if (i < conCajones) {
        drawers(x, 0, w, cuerpo / cajones, cajones)
      } else if (puertas) doors(x, 0, w, cuerpo, puertas)
      if (widths.length > 1) out.push({ t: 'text', role: 'note', x: r1(x + w / 2), y: -3, text: `${r1(w)}`, anchor: 'middle' })
      x += w
    })
    if (bajo) rect('zoclo', 3, cuerpo, L - 6, H - cuerpo)
    if (widths.length > 1) notes.push(`${widths.length} módulos`)
  } else {
    // Closet y mueble de TV: un cuerpo con secciones verticales.
    const closet = s.kind === 'closet'
    const secciones = towers(s)
    const sw = L / secciones
    const cajones = int(s.cajones)
    const entrepanos = int(s.entrepanos)
    const puertas = int(s.puertas)
    rect('body', 0, 0, L, H)
    for (let i = 1; i < secciones; i++) line('split', i * sw, 0, i * sw, H)
    // Interior: en el closet cada torre lleva sus cajones abajo y sus entrepaños; en el de TV se reparten.
    for (let i = 0; i < secciones; i++) {
      const x = i * sw
      const nCaj = closet ? cajones : i === secciones - 1 ? cajones : 0
      const nEnt = closet ? entrepanos : Math.floor(entrepanos / secciones) + (i < entrepanos % secciones ? 1 : 0)
      const cajAlto = Math.min(FRENTE, (H * 0.6) / Math.max(1, nCaj))
      const libre = H - nCaj * cajAlto
      if (nCaj) drawers(x, libre, sw, cajAlto, nCaj)
      for (let k = 1; k <= nEnt; k++) line('shelf', x + 1, (libre * k) / (nEnt + 1), x + sw - 1, (libre * k) / (nEnt + 1))
    }
    const tubos = closet ? int(s.tubos) : 0
    for (let k = 0; k < tubos; k++) {
      const torre = k % secciones
      const nivel = Math.floor(k / secciones)
      const y = H * (0.08 + nivel * 0.42)
      line('tube', torre * sw + 3, y, (torre + 1) * sw - 3, y)
    }
    if (tubos) notes.push(tubos === 1 ? '1 tubo' : `${tubos} tubos`)
    // Las puertas se marcan punteadas para que se vea el interior.
    if (puertas) {
      const corrediza = closet && s.puertaTipo === 'corrediza'
      const n = corrediza ? Math.max(2, puertas) : puertas
      const dw = L / n
      for (let i = 0; i < n; i++) rect('ghost', i * dw + (corrediza && i > 0 ? -1.5 : 0), 0, dw + (corrediza && i > 0 ? 1.5 : 0), H)
      notes.push(`${n} ${n === 1 ? 'puerta' : 'puertas'}${closet ? (corrediza ? ' corredizas' : ' abatibles') : ''} (punteadas)`)
    }
  }
  out.push({ t: 'text', role: 'dim', x: r1(L / 2), y: r1(H) + 1, text: `${r1(s.largo)} cm`, anchor: 'middle' })
  out.push({ t: 'text', role: 'dim', x: -2, y: r1(H / 2), text: `${r1(s.alto)} cm`, anchor: 'end' })
  notes.push(`fondo ${r1(s.fondo)} cm`)
  return { w: r1(L), h: r1(H), shapes: out, notes }
}
