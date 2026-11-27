// Retacera (pedacera): los sobrantes de cada hoja que deja un mueble, con su color y grosor, y la revisión de si un
// proyecto nuevo sale con lo que hay guardado. Medidas en mm.
import { db } from './db'
import type { Offcut } from './types'

/** Un sobrante cuenta como retazo si mide al menos esto (mm): sirve para costados chicos, repisas o frentes de cajón. */
export const MIN_SHORT = 150
export const MIN_LONG = 300

export type Rect = { w: number; h: number }
export type OffcutDraft = Omit<Offcut, 'id' | 'at'>
export type NeedPiece = { n: string; l: number; a: number; q: number }

/** Los huecos libres de una hoja que valen la pena como retazo, de mayor a menor (l ≥ a). */
export function usableRests(free: Rect[], minShort = MIN_SHORT, minLong = MIN_LONG): { l: number; a: number }[] {
  return free
    .map((f) => ({ l: Math.floor(Math.max(f.w, f.h)), a: Math.floor(Math.min(f.w, f.h)) }))
    .filter((r) => r.a >= minShort && r.l >= minLong)
    .sort((x, y) => y.l * y.a - x.l * x.a)
}

export const listOffcuts = (b: { offcuts?: Offcut[] }): Offcut[] => (b.offcuts ?? []).filter((o) => Number.isFinite(o.l) && Number.isFinite(o.esp))

const sameText = (a: string, b: string) => a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'base' }) === 0
export const offcutGroup = (o: Pick<Offcut, 'kind' | 'esp' | 'color'>) => `${o.kind === 'fondo' ? 'Fondo' : 'Tablero'} ${o.esp} mm · ${o.color || 'sin color'}`

/** Agrupa por tipo, grosor y color (lo que importa para poder usarlos juntos). */
export function groupOffcuts(list: Offcut[]): { key: string; items: Offcut[]; areaM2: number }[] {
  const map = new Map<string, Offcut[]>()
  for (const o of list) map.set(offcutGroup(o), [...(map.get(offcutGroup(o)) ?? []), o])
  return [...map].map(([key, items]) => ({ key, items: items.sort((a, b) => b.l * b.a - a.l * a.a), areaM2: Math.round(items.reduce((s, o) => s + o.l * o.a, 0) / 10_000) / 100 })).sort((a, b) => a.key.localeCompare(b.key, 'es'))
}

async function write(businessId: string, fn: (list: Offcut[]) => Offcut[]) {
  const b = await db.business.get(businessId)
  if (!b) throw new Error('Negocio no encontrado')
  await db.business.update(businessId, { offcuts: fn(listOffcuts(b)), updatedAt: new Date().toISOString() })
}

export async function saveOffcuts(businessId: string, drafts: OffcutDraft[]): Promise<Offcut[]> {
  const at = new Date().toISOString()
  const add = drafts.filter((d) => d.l > 0 && d.a > 0).map((d) => ({ ...d, l: Math.max(d.l, d.a), a: Math.min(d.l, d.a), color: d.color.trim(), id: crypto.randomUUID(), at }))
  await write(businessId, (list) => [...list, ...add])
  return add
}

export const removeOffcut = (businessId: string, id: string) => write(businessId, (list) => list.filter((o) => o.id !== id))
export const removeOffcuts = (businessId: string, ids: string[]) => write(businessId, (list) => list.filter((o) => !ids.includes(o.id)))

export async function addOffcut(businessId: string, input: { l: number; a: number; esp: number; color: string; kind: Offcut['kind'] }): Promise<void> {
  if (!(input.l >= 10 && input.a >= 10)) throw new Error('Escribe las medidas del retazo')
  if (!(input.esp > 0)) throw new Error('Escribe el grosor en mm')
  await saveOffcuts(businessId, [{ ...input, color: input.color || 'Sin color' }])
}

export type OffcutPlan = {
  /** Todo el proyecto sale de retazos. */
  fits: boolean
  /** Qué piezas van en cada retazo usado. */
  used: { offcut: Offcut; pieces: { n: string; l: number; a: number }[] }[]
  /** Piezas que no caben en ningún retazo. */
  missing: { n: string; l: number; a: number }[]
  /** Lo que sobra de los retazos usados (vuelve a la retacera si se usan). */
  leftovers: { from: Offcut; l: number; a: number }[]
  /** Retazos que coinciden en tipo, grosor y color. */
  candidates: number
}

/**
 * ¿Sale el proyecto con la pedacera? Acomoda las piezas en los retazos que coinciden (tipo, grosor y color si se pide),
 * de la pieza más grande a la más chica, cada una en el hueco donde sobra menos (cortes rectos, con el grueso de la sierra).
 */
export function planWithOffcuts(pieces: NeedPiece[], stock: Offcut[], filter: { kind: Offcut['kind']; esp: number; color?: string }, opts: { kerf?: number; fixed?: boolean } = {}): OffcutPlan {
  const kerf = opts.kerf ?? 4
  const bins = stock.filter((o) => o.kind === filter.kind && o.esp === filter.esp && (!filter.color || sameText(o.color, filter.color)))
  type Free = { x: number; y: number; w: number; h: number }
  // Retazo: largo en x. Se prueban primero los retazos chicos para no desperdiciar los grandes.
  const state = bins.map((o) => ({ o, free: [{ x: 0, y: 0, w: o.l, h: o.a }] as Free[], pieces: [] as { n: string; l: number; a: number }[] }))
  const items = pieces.flatMap((p) => Array.from({ length: p.q }, () => ({ n: p.n, l: Math.max(p.l, p.a), a: Math.min(p.l, p.a) })))
  items.sort((x, y) => y.l * y.a - x.l * x.a || y.l - x.l)
  const missing: OffcutPlan['missing'] = []
  for (const it of items) {
    const opts2: [number, number][] = [[it.l, it.a]]
    if (!opts.fixed && it.l !== it.a) opts2.push([it.a, it.l])
    let best: { b: number; f: number; w: number; h: number; score: number } | undefined
    state.forEach((st, b) => st.free.forEach((fr, f) => {
      for (const [w, h] of opts2) {
        if (w > fr.w || h > fr.h) continue
        // Primero el hueco donde sobra menos; a igualdad, el retazo más chico.
        const score = Math.min(fr.w - w, fr.h - h) * 1e6 + st.o.l * st.o.a / 1e3
        if (!best || score < best.score) best = { b, f, w, h, score }
      }
    }))
    if (!best) { missing.push(it); continue }
    const st = state[best.b]
    const fr = st.free.splice(best.f, 1)[0]
    st.pieces.push(it)
    const rw = fr.w - best.w - kerf
    const bh = fr.h - best.h - kerf
    if (rw * fr.h >= bh * fr.w) {
      if (rw > 0) st.free.push({ x: fr.x + best.w + kerf, y: fr.y, w: rw, h: fr.h })
      if (bh > 0) st.free.push({ x: fr.x, y: fr.y + best.h + kerf, w: best.w, h: bh })
    } else {
      if (bh > 0) st.free.push({ x: fr.x, y: fr.y + best.h + kerf, w: fr.w, h: bh })
      if (rw > 0) st.free.push({ x: fr.x + best.w + kerf, y: fr.y, w: rw, h: best.h })
    }
  }
  const usedStates = state.filter((s) => s.pieces.length)
  return {
    fits: missing.length === 0 && items.length > 0,
    used: usedStates.map((s) => ({ offcut: s.o, pieces: s.pieces })),
    missing,
    leftovers: usedStates.flatMap((s) => usableRests(s.free).map((r) => ({ from: s.o, ...r }))),
    candidates: bins.length,
  }
}

/** Usar la pedacera para un proyecto: salen los retazos usados y entran sus sobrantes aprovechables. */
export async function applyOffcutPlan(businessId: string, plan: OffcutPlan, from: string): Promise<void> {
  const ids = plan.used.map((u) => u.offcut.id)
  const at = new Date().toISOString()
  const back: Offcut[] = plan.leftovers.map((r) => ({ id: crypto.randomUUID(), l: r.l, a: r.a, esp: r.from.esp, color: r.from.color, kind: r.from.kind, from, at }))
  await write(businessId, (list) => [...list.filter((o) => !ids.includes(o.id)), ...back])
}

/** Los colores que hay en la retacera para un tipo y grosor (para elegir con cuál revisar). */
export const offcutColors = (list: Offcut[], kind: Offcut['kind'], esp: number) => [...new Set(list.filter((o) => o.kind === kind && o.esp === esp).map((o) => o.color))].sort((a, b) => a.localeCompare(b, 'es'))
