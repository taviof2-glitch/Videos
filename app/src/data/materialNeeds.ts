// Material necesario: cuánto piden las obras por cortar (y, si se quiere, las cotizaciones aceptadas), cuánto hay en
// «Material del taller», qué falta comprar y qué obras ya pueden cortarse. Toma el despiece del Cotizador y también
// los muebles de Bases. El material se reparte a las obras en orden de fecha de entrega (la más cercana primero).
import { calcBase, type BaseState } from './bases'
import { listContacts } from './contacts'
import { listJobs, shoppingList, type JobItem, type ShoppingItem } from './jobs'
import { bestPrice, listMaterials } from './materials'
import { matchMaterial } from './materialUse'
import { listQuotes } from './quotes'
import { jobOf, quoterSettings, type QuoterConfig, type QuoterForm } from './quoter'
import type { Business, Quote, WorkMaterial } from './types'

const WHOLE = ['hojas', 'piezas', 'pares', 'cajas']
const r1 = (x: number) => Math.round(x * 10) / 10
export const PRE_CUT = ['anticipo', 'material', 'corte']

/** Lo que lleva un mueble de Bases, como lista de compras. */
export function baseItems(s: BaseState, cfg: QuoterConfig): ShoppingItem[] {
  const r = calcBase(s, cfg)
  const t = s.opts.tablero ?? 'melamina'
  const sheet = t === 'mdf' ? `Hoja de MDF de ${s.opts.esp} mm` : t === 'madera' ? `Tablero de madera de ${s.opts.esp} mm` : `Hoja de melamina de ${s.opts.esp} mm`
  const pares = Object.values(r.built.hw.corr).reduce((a, n) => a + n, 0)
  const out: ShoppingItem[] = []
  const add = (name: string, qty: number, unit: string) => { if (qty > 0) out.push({ name, qty: r1(qty), unit }) }
  add(sheet, r.board.sheets.length + r.board.tooBig.length, 'hojas')
  add('Hoja de fondo de 3 mm', r.mdf.sheets.length, 'hojas')
  add('Cubrecanto', Math.ceil(r.edge.d + r.edge.g), 'metros')
  add('Bisagras', r.built.hw.bis, 'piezas')
  add('Correderas', pares, 'pares')
  add(s.opts.pushOpen ? 'Push-open' : 'Jaladeras', r.built.hw.jal, 'piezas')
  add('Tubo para colgar', r.tramos * 3, 'metros')
  add('Soportes de tubo', r.built.hw.sop, 'piezas')
  add('Riel para puertas corredizas', r.built.hw.riel, 'metros')
  add('Pistones', r.built.hw.piston, 'piezas')
  add('Patas niveladoras', s.opts.apoyo && s.opts.apoyo !== 'normal' ? 0 : r.built.hw.pata, 'piezas')
  return out
}

export type NeedItem = ShoppingItem & { /** Calculado por metro (sin medidas), aproximado. */ est?: boolean; /** Material del taller elegido a mano. */ materialId?: string }

/**
 * Todo lo que lleva una cotización: su despiece del Cotizador, los muebles de Bases (sueltos o en partidas) y, si se
 * cotizó por metro sin medidas, un estimado con lo que lleva ese trabajo por unidad (hojas, fondo, herrajes).
 */
export function quoteItems(q: Quote, business: Business): NeedItem[] {
  const s = q.quoter
  if (!s) return []
  const { cfg, types } = quoterSettings(business)
  const items: NeedItem[] = [...shoppingList(q, cfg)]
  if (s.base) items.push(...baseItems(s.base, cfg))
  for (const p of s.parts ?? []) if (p.base) items.push(...baseItems(p.base, cfg))
  if (!items.length) {
    const t = jobOf(types, s as unknown as QuoterForm, cfg)
    const n = Math.max(0, s.q || 0)
    const add = (name: string, per: number, unit: string, whole = true) => { const v = per * n; if (v > 0) items.push({ name, qty: whole ? Math.ceil(v - 1e-9) : r1(v), unit, est: true }) }
    if (t) {
      add(s.mat ? `${s.mat} (${cfg.esp} mm)` : `Hoja de melamina de ${cfg.esp} mm`, t.h * (1 + cfg.desp / 100), 'hojas')
      add('Hoja de fondo de 3 mm', t.f, 'hojas')
      add('Bisagras', t.b, 'piezas')
      add('Correderas', t.c, 'pares')
      add('Jaladeras', t.j, 'piezas')
    }
  }
  return items
}

/** Lo que lleva una obra: lo de su cotización más lo que se le agregó a mano. */
export function jobItems(j: JobItem, business: Business): NeedItem[] {
  if (j.job.materialList) return j.job.materialList.filter((m) => m.qty > 0 && m.name.trim())
  return autoItems(j, business)
}

/** El cálculo automático (cotización + lo agregado a mano), sin la lista editada. */
export function autoItems(j: JobItem, business: Business): NeedItem[] {
  return [...(j.quote ? quoteItems(j.quote, business) : []), ...(j.job.extraMaterial ?? []).filter((m) => m.qty > 0 && m.name.trim())]
}

/** El material del taller de un renglón: el elegido a mano o el que más se parece por nombre. */
export const itemMaterialId = (it: NeedItem, materials: WorkMaterial[]) => (it.materialId && materials.some((m) => m.id === it.materialId) ? it.materialId : matchMaterial(it.name, materials))

export type NeedJob = { id: string; label: string; due?: string; kind: 'obra' | 'aceptada'; items: (NeedItem & { key: string; missing: number })[]; ready: boolean }
export type NeedLine = { key: string; name: string; unit: string; need: number; have: number; short: number; materialId: string; supplier: string; priceCents: number; jobs: string[] }
export type Needs = { lines: NeedLine[]; jobs: NeedJob[]; buyCents: number; unknown: NeedLine[] }

export async function materialNeeds(business: Business, includeAccepted = false): Promise<Needs> {
  const materials = listMaterials(business)
  const names = new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name]))
  const sources: { id: string; label: string; due?: string; kind: NeedJob['kind']; items: NeedItem[] }[] = []
  const jobs: JobItem[] = await listJobs(business.id)
  // Todas las obras por cortar, aunque no tengan material calculado (así se ve cuáles faltan por llenar).
  for (const j of jobs) {
    if (!PRE_CUT.includes(j.job.stage) || j.job.materialUse) continue
    sources.push({ id: j.id, label: [names.get(j.contactId ?? ''), j.title].filter(Boolean).join(' · '), due: j.job.deliveryDate, kind: 'obra', items: jobItems(j, business) })
  }
  if (includeAccepted) {
    for (const q of await listQuotes(business.id)) {
      if (q.job || q.status !== 'accepted') continue
      const items = quoteItems(q, business)
      if (items.length) sources.push({ id: q.id, label: `${[names.get(q.contactId), q.title].filter(Boolean).join(' · ')} (aceptada)`, kind: 'aceptada', items })
    }
  }
  sources.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'obra' ? -1 : 1) || (a.due ?? '9999').localeCompare(b.due ?? '9999'))

  const lines = new Map<string, NeedLine>()
  const left = new Map(materials.map((m) => [m.id, m.stock]))
  const out: NeedJob[] = []
  for (const s of sources) {
    const items = s.items.map((it) => {
      const materialId = itemMaterialId(it, materials)
      const key = materialId || it.name
      const m = materials.find((x) => x.id === materialId)
      const cur = lines.get(key) ?? { key, name: m?.name ?? it.name, unit: m?.unit ?? it.unit, need: 0, have: m?.stock ?? 0, short: 0, materialId, supplier: '', priceCents: 0, jobs: [] }
      cur.need = r1(cur.need + it.qty)
      if (!cur.jobs.includes(s.label)) cur.jobs.push(s.label)
      lines.set(key, cur)
      // Se le asigna a esta obra lo que quede en el taller (las de entrega más cercana toman primero).
      const avail = materialId ? left.get(materialId) ?? 0 : 0
      const take = Math.min(avail, it.qty)
      if (materialId) left.set(materialId, r1(avail - take))
      return { ...it, name: m?.name ?? it.name, unit: m?.unit ?? it.unit, key, missing: r1(it.qty - take) }
    })
    out.push({ id: s.id, label: s.label, due: s.due, kind: s.kind, items, ready: items.length > 0 && items.every((i) => i.missing <= 0) })
  }
  const all = [...lines.values()].map((l) => {
    const m = materials.find((x) => x.id === l.materialId)
    const raw = Math.max(0, r1(l.need - l.have))
    const best = m ? bestPrice(m) : undefined
    return { ...l, short: WHOLE.includes(l.unit) ? Math.ceil(raw) : raw, supplier: best?.supplier ?? '', priceCents: best?.priceCents ?? 0 }
  })
  all.sort((a, b) => (b.short > 0 ? 1 : 0) - (a.short > 0 ? 1 : 0) || a.name.localeCompare(b.name, 'es'))
  return { lines: all, jobs: out, buyCents: all.reduce((s, l) => s + Math.round(l.short * l.priceCents), 0), unknown: all.filter((l) => !l.materialId) }
}
