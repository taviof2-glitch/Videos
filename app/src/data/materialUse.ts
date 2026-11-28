// Material de una obra: con el despiece de la obra se sabe cuántas hojas, cubrecanto y herrajes lleva.
// Al cortarla se descuenta del «Material del taller» y los sobrantes grandes de cada hoja quedan como retazos.
import { db } from './db'
import { shoppingList, updateJob } from './jobs'
import { bestPrice, listMaterials } from './materials'
import { pack } from './cutlist'
import { quoteItems } from './materialNeeds'
import { quoterSettings } from './quoter'
import { usableRests, type OffcutDraft } from './offcuts'
import type { Business, MaterialUse, Offcut, Quote, QuoteJob, WorkMaterial } from './types'

export type { OffcutDraft }


export type UseLine = { name: string; qty: number; unit: string; materialId: string }
export type UsePlan = { lines: UseLine[]; offcuts: OffcutDraft[] }

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Palabras clave de cada artículo de la lista de compras para encontrarlo en el material del taller. */
function keys(name: string): string[][] {
  const n = norm(name)
  const mm = n.match(/(\d+)\s*mm/)?.[1]
  if (n.includes('fondo')) return [['fondo'], ['3 mm', '3mm', 'triplay']]
  if (n.includes('mdf')) return [['mdf'], ...(mm ? [[`${mm} mm`, `${mm}mm`, ` ${mm}`]] : [])]
  if (n.includes('madera')) return [['madera', 'pino', 'tablero de'], ...(mm ? [[`${mm} mm`, `${mm}mm`, ` ${mm}`]] : [])]
  if (n.includes('push')) return [['push']]
  if (n.includes('piston')) return [['piston']]
  if (n.includes('pata')) return [['pata', 'nivelador']]
  if (n.includes('melamina')) return [['melamina', 'mdf', 'aglomerado', 'hoja'], ...(mm ? [[`${mm} mm`, `${mm}mm`, ` ${mm}`]] : [])]
  if (n.includes('cubrecanto') || n.includes('canto')) return [['canto', 'cubrecanto', 'tapacanto']]
  if (n.includes('bisagra')) return [['bisagra']]
  if (n.includes('corredera')) return [['corredera', 'riel telescop']]
  if (n.includes('jaladera')) return [['jaladera', 'manija', 'tirador']]
  if (n.includes('riel')) return [['riel']]
  if (n.includes('soporte')) return [['soporte']]
  if (n.includes('tubo')) return [['tubo']]
  return [[n.split(' ')[0]]]
}

/** El material del taller que corresponde (todas las palabras clave deben aparecer; gana el que más coincide). */
export function matchMaterial(name: string, list: WorkMaterial[]): string {
  const groups = keys(name)
  let best: { id: string; score: number } | undefined
  for (const m of list) {
    const n = ` ${norm(m.name)} `
    if (!groups.every((g) => g.some((k) => n.includes(k)))) continue
    const score = groups.reduce((a, g) => a + g.filter((k) => n.includes(k)).length, 0)
    if (!best || score > best.score) best = { id: m.id, score }
  }
  return best?.id ?? ''
}

/** Lo que se gasta en la obra y los retazos que deja, según su despiece. */
export function planMaterialUse(business: Business, quote: Quote): UsePlan | undefined {
  const cut = quote.quoter?.cut
  if (!cut) return undefined
  const list = listMaterials(business)
  const lines = shoppingList(quote, quoterSettings(business).cfg).map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, materialId: matchMaterial(i.name, list) }))
  // Todos los sobrantes aprovechables de cada hoja (el acomodo está en cm; la retacera guarda mm).
  const offcuts: OffcutDraft[] = []
  for (const [material, kind, esp] of [['melamina', 'tablero', cut.spec.grosor], ['fondo', 'fondo', 3]] as const) {
    pack(cut.pieces, material, cut.girar).sheets.forEach((s, i) => {
      for (const r of usableRests(s.free.map((f) => ({ w: f.w * 10, h: f.h * 10 })))) offcuts.push({ l: r.l, a: r.a, esp, color: '', kind, from: quote.title || 'Obra', sheet: i + 1 })
    })
  }
  return { lines, offcuts }
}

async function holder(jobId: string): Promise<{ job: QuoteJob; title: string } | undefined> {
  const q = await db.quote.get(jobId)
  if (q?.job && !q.deletedAt) return { job: q.job, title: q.title }
  const t = await db.txn.get(jobId)
  if (t?.job && !t.deletedAt) return { job: t.job, title: t.concept || 'Venta' }
  return undefined
}

const setUse = (jobId: string, use: MaterialUse | undefined) => updateJob(jobId, { materialUse: use })

/** Descuenta el material de la obra (nunca baja de cero) y guarda sus retazos. Se puede deshacer. */
export async function applyMaterialUse(businessId: string, jobId: string, lines: UseLine[], offcuts: OffcutDraft[]): Promise<MaterialUse> {
  const h = await holder(jobId)
  if (!h) throw new Error('No se encontró la obra')
  if (h.job.materialUse) throw new Error('El material de esta obra ya se descontó')
  const now = new Date().toISOString()
  const used: MaterialUse['lines'] = []
  const newOffcuts: Offcut[] = offcuts.map((o) => ({ ...o, color: o.color.trim() || 'Sin color', from: o.from || h.title, id: crypto.randomUUID(), at: now }))
  await db.transaction('rw', db.business, async () => {
    const b = await db.business.get(businessId)
    if (!b) throw new Error('Negocio no encontrado')
    const list = listMaterials(b).map((m) => ({ ...m }))
    for (const l of lines) {
      const m = list.find((x) => x.id === l.materialId)
      if (!m || !(l.qty > 0)) continue
      const qty = Math.min(m.stock, l.qty)
      m.stock = Math.round((m.stock - qty) * 100) / 100
      used.push({ materialId: m.id, name: m.name, qty, unit: m.unit, costCents: Math.round(qty * (bestPrice(m)?.priceCents ?? 0)) })
    }
    await db.business.update(businessId, { materials: list, offcuts: [...(b.offcuts ?? []), ...newOffcuts], updatedAt: now })
  })
  const use: MaterialUse = { at: now, lines: used, offcutIds: newOffcuts.map((o) => o.id) }
  await setUse(jobId, use)
  return use
}

/** Regresa al taller lo que se descontó y quita los retazos que dejó la obra. */
export async function undoMaterialUse(businessId: string, jobId: string): Promise<void> {
  const h = await holder(jobId)
  const use = h?.job.materialUse
  if (!use) return
  await db.transaction('rw', db.business, async () => {
    const b = await db.business.get(businessId)
    if (!b) return
    const list = listMaterials(b).map((m) => {
      const back = use.lines.filter((l) => l.materialId === m.id).reduce((a, l) => a + l.qty, 0)
      return back ? { ...m, stock: Math.round((m.stock + back) * 100) / 100 } : m
    })
    await db.business.update(businessId, { materials: list, offcuts: (b.offcuts ?? []).filter((o) => !use.offcutIds.includes(o.id)), updatedAt: new Date().toISOString() })
  })
  await setUse(jobId, undefined)
}

export const materialUseCost = (use: MaterialUse) => use.lines.reduce((a, l) => a + l.costCents, 0)

export type Shortage = { name: string; need: number; have: number; unit: string; missing: boolean }

/** Lo que no alcanza en el taller para el despiece de la obra (o que no está dado de alta). */
export function materialShortage(business: Business, quote: Quote): Shortage[] {
  const list = listMaterials(business)
  if (!list.length) return [] // si no lleva control de material, no se avisa
  const need = new Map<string, Shortage>()
  for (const it of quoteItems(quote, quoterSettings(business).cfg)) {
    const id = matchMaterial(it.name, list)
    const m = list.find((x) => x.id === id)
    if (!m && !/^(Hoja|Tablero|Bisagras|Correderas)/.test(it.name)) continue
    const key = id || it.name
    const cur = need.get(key) ?? { name: m?.name ?? it.name, need: 0, have: m?.stock ?? 0, unit: m?.unit ?? it.unit, missing: !m }
    cur.need = Math.round((cur.need + it.qty) * 10) / 10
    need.set(key, cur)
  }
  return [...need.values()].filter((x) => x.missing || x.have < x.need)
}

/**
 * Al pasar una obra a «Corte»: descuenta sola el material de su despiece (sin retazos: esos se guardan al cortar,
 * en la tarjeta de material de la obra). Regresa qué se descontó, o nada si no hay despiece o ya se descontó.
 */
export async function autoUseOnCut(businessId: string, jobId: string): Promise<MaterialUse | undefined> {
  const b = await db.business.get(businessId)
  const q = await db.quote.get(jobId)
  if (!b || !q?.job || q.job.materialUse || !q.quoter?.cut) return undefined
  const plan = planMaterialUse(b, q)
  const lines = plan?.lines.filter((l) => l.materialId && l.qty > 0) ?? []
  if (!lines.length) return undefined
  return applyMaterialUse(businessId, jobId, lines, [])
}
