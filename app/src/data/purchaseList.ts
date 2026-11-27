// Pedido de material: junta lo que piden las obras por arrancar (según su despiece), le resta lo que hay en el taller,
// suma lo que está por debajo del mínimo y lo reparte por el proveedor que lo da más barato.
import { listContacts } from './contacts'
import { db } from './db'
import { listJobs, shoppingList } from './jobs'
import { bestPrice, isLow, listMaterials } from './materials'
import { matchMaterial } from './materialUse'
import { quoterSettings, type Mat } from './quoter'
import type { Business } from './types'

export type BuyLine = {
  name: string
  unit: string
  /** Lo que piden las obras (0 si solo es por existencia mínima). */
  need: number
  have: number
  buy: number
  materialId: string
  supplier: string
  priceCents: number
  /** Para qué obras es. */
  jobs: string[]
}

const PENDING_STAGES = ['anticipo', 'material']
const WHOLE = ['hojas', 'piezas', 'pares', 'cajas']

export async function purchaseList(business: Business): Promise<BuyLine[]> {
  const { cfg } = quoterSettings(business)
  const materials = listMaterials(business)
  const names = new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c.name]))
  const lines = new Map<string, BuyLine>()
  for (const j of await listJobs(business.id)) {
    if (!PENDING_STAGES.includes(j.job.stage) || j.job.materialUse || !j.quote?.quoter?.cut) continue
    const label = [names.get(j.contactId ?? ''), j.title].filter(Boolean).join(' · ')
    for (const it of shoppingList(j.quote, cfg)) {
      const materialId = matchMaterial(it.name, materials)
      const key = materialId || it.name
      const cur = lines.get(key)
      if (cur) {
        cur.need = Math.round((cur.need + it.qty) * 10) / 10
        if (!cur.jobs.includes(label)) cur.jobs.push(label)
      } else lines.set(key, { name: materialId ? materials.find((m) => m.id === materialId)!.name : it.name, unit: it.unit, need: it.qty, have: 0, buy: 0, materialId, supplier: '', priceCents: 0, jobs: [label] })
    }
  }
  // Lo que está por debajo del mínimo, aunque ninguna obra lo pida.
  for (const m of materials.filter(isLow)) if (!lines.has(m.id)) lines.set(m.id, { name: m.name, unit: m.unit, need: 0, have: 0, buy: 0, materialId: m.id, supplier: '', priceCents: 0, jobs: [] })
  const out: BuyLine[] = []
  for (const l of lines.values()) {
    const m = materials.find((x) => x.id === l.materialId)
    const have = m?.stock ?? 0
    const reserve = m?.min ?? 0
    // Lo que falta para las obras y para volver a tener el mínimo.
    const raw = Math.max(0, Math.round((l.need + reserve - have) * 10) / 10)
    const buy = WHOLE.includes(l.unit) ? Math.ceil(raw) : raw
    if (buy <= 0) continue
    const best = m ? bestPrice(m) : undefined
    out.push({ ...l, have, buy, supplier: best?.supplier ?? '', priceCents: best?.priceCents ?? 0 })
  }
  return out.sort((a, b) => a.supplier.localeCompare(b.supplier, 'es') || a.name.localeCompare(b.name, 'es'))
}

export function bySupplier(lines: BuyLine[]): { supplier: string; lines: BuyLine[]; totalCents: number }[] {
  const map = new Map<string, BuyLine[]>()
  for (const l of lines) map.set(l.supplier, [...(map.get(l.supplier) ?? []), l])
  return [...map]
    .map(([supplier, ls]) => ({ supplier, lines: ls, totalCents: ls.reduce((s, l) => s + Math.round(l.buy * l.priceCents), 0) }))
    .sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1) || a.supplier.localeCompare(b.supplier, 'es'))
}

export function orderMessage(businessName: string, lines: BuyLine[]): string {
  return [`Hola, buen día. Les escribo de ${businessName}. Quiero encargar:`, ...lines.map((l) => `• ${l.buy} ${l.unit} de ${l.name}`), '¿Me confirman precio y si lo tienen disponible? Gracias.'].join('\n')
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const STOP = new Set(['hoja', 'con', 'mdf', 'melamina', 'enchapado', 'enchapada', 'para', 'del', '15mm', '16mm', '18mm'])
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t))

/**
 * Precios del cotizador al día: el precio por hoja de un ticket actualiza el material del cotizador que se llama
 * parecido (mismo color), el fondo de 3 mm o, si no hay ninguno, lo agrega. Regresa qué cambió.
 */
export async function syncQuoterPrices(businessId: string, lines: { name: string; unit: string; unitCents: number }[]): Promise<string[]> {
  const sheets = lines.filter((l) => l.unit === 'hojas' && l.unitCents > 0)
  if (!sheets.length) return []
  const b = await db.business.get(businessId)
  if (!b) return []
  const saved = b.quoter ?? {}
  const mats: Mat[] = [...(saved.mats ?? [])]
  const cfg = { ...saved.cfg }
  const changes: string[] = []
  for (const l of sheets) {
    const pesos = Math.round(l.unitCents) / 100
    const n = norm(l.name)
    if ((n.includes('fondo') || /\b3 ?mm\b/.test(n) || n.includes('triplay')) && !/1[5-8] ?mm/.test(n)) {
      if (cfg.fondo !== pesos) { cfg.fondo = pesos; changes.push(`Fondo de 3 mm: $${pesos}`) }
      continue
    }
    const t = tokens(l.name)
    const hit = mats.findIndex((m) => { const mt = tokens(m.n); return mt.length > 0 && mt.every((x) => t.includes(x)) })
    if (hit >= 0) {
      if (mats[hit].hoja !== pesos) { mats[hit] = { ...mats[hit], hoja: pesos }; changes.push(`${mats[hit].n}: $${pesos} la hoja`) }
    } else {
      const short = l.name.replace(/^hoja de /i, '').slice(0, 60)
      mats.push({ n: short, hoja: pesos })
      changes.push(`${short}: $${pesos} la hoja (nuevo en el cotizador)`)
    }
  }
  if (changes.length) await db.business.update(businessId, { quoter: { ...saved, cfg, mats }, updatedAt: new Date().toISOString() })
  return changes
}
