// Obras del taller: una cotización aceptada se sigue por etapas hasta entregarla y cobrarla.
// El seguimiento vive en la misma cotización (`job`), así viaja con ella entre aparatos.
import { edgeMeters, pack, type CutSpec } from './cutlist'
import { addDays, dayKey, weekStart } from './dates'
import { db } from './db'
import { deskJob, measuredJob, quoterSettings, type QuoterConfig } from './quoter'
import { listQuotes } from './quotes'
import type { Business, JobStage, Quote, QuoteJob } from './types'

export const STAGES: JobStage[] = ['anticipo', 'material', 'corte', 'armado', 'listo', 'instalado', 'liquidado']
export const STAGE_LABEL: Record<JobStage, string> = {
  anticipo: 'Anticipo recibido', material: 'Material comprado', corte: 'En corte', armado: 'En armado', listo: 'Listo para entregar', instalado: 'Instalado', liquidado: 'Liquidado',
}
/** Etapas en que la obra ya se entregó. */
const DELIVERED: JobStage[] = ['instalado', 'liquidado']
export const isDelivered = (job: QuoteJob) => DELIVERED.includes(job.stage)

async function patchJob(quoteId: string, fn: (q: Quote) => QuoteJob): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q || q.deletedAt) throw new Error('Cotización no encontrada')
  await db.quote.update(quoteId, { job: fn(q), updatedAt: new Date().toISOString() })
}

/** Pasa una cotización a obra (empieza en «anticipo recibido»). */
export async function startJob(quoteId: string, input: { deliveryDate?: string } = {}): Promise<void> {
  await patchJob(quoteId, (q) => {
    if (q.job) throw new Error('Esa cotización ya es una obra')
    return { stage: 'anticipo', startedAt: new Date().toISOString(), ...(input.deliveryDate && { deliveryDate: input.deliveryDate }) }
  })
}

const need = (q: Quote): QuoteJob => {
  if (!q.job) throw new Error('Esa cotización no es una obra')
  return q.job
}

/** Cambia de etapa. Al llegar a «instalado» se anota el día de entrega (de ahí corre la garantía). */
export async function setJobStage(quoteId: string, stage: JobStage, today?: string): Promise<void> {
  await patchJob(quoteId, (q) => {
    const job = need(q)
    const { deliveredAt: _d, ...rest } = job
    const delivered = DELIVERED.includes(stage)
    return { ...rest, stage, ...(delivered && { deliveredAt: job.deliveredAt ?? today ?? new Date().toISOString().slice(0, 10) }) }
  })
}

export type JobPatch = Partial<Pick<QuoteJob, 'deliveryDate' | 'note' | 'realMaterialCents' | 'realHours' | 'warrantyMonths'>>

/** Cambia fecha de entrega, nota, costos reales o garantía. `undefined` borra el dato. */
export async function updateJob(quoteId: string, patch: JobPatch): Promise<void> {
  await patchJob(quoteId, (q) => {
    const next: QuoteJob = { ...need(q) }
    for (const k of Object.keys(patch) as (keyof JobPatch)[]) {
      const v = patch[k]
      if (v === undefined || v === '' || (typeof v === 'number' && !(v >= 0))) delete next[k]
      else (next as unknown as Record<string, unknown>)[k] = v
    }
    return next
  })
}

/** Quita la obra (la cotización se queda). */
export async function removeJob(quoteId: string): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q?.job) return
  const { job: _j, ...rest } = q
  await db.quote.put({ ...rest, updatedAt: new Date().toISOString() })
}

export const listJobs = async (businessId: string): Promise<Quote[]> => (await listQuotes(businessId)).filter((q) => q.job)

/** Atrasada: tiene fecha, ya pasó y no se ha entregado. */
export const isLate = (job: QuoteJob, today: string) => !!job.deliveryDate && job.deliveryDate < today && !isDelivered(job)
/** Se entrega esta semana (de hoy al domingo) y no se ha entregado. */
export const dueThisWeek = (job: QuoteJob, today: string) => !!job.deliveryDate && !isDelivered(job) && job.deliveryDate >= today && job.deliveryDate <= addDays(weekStart(today), 6)

/** Hasta qué día cubre la garantía, si la obra ya se entregó y tiene garantía. */
export function warrantyUntil(job: QuoteJob): string | undefined {
  if (!job.deliveredAt || !job.warrantyMonths) return undefined
  // Mismo día, tantos meses después (si ese mes es más corto, su último día).
  const [y, m, d] = job.deliveredAt.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + job.warrantyMonths, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

export type JobSummary = { active: number; late: number; thisWeek: number }
export async function jobSummary(business: Business, today = dayKey(Date.now(), business.timezone)): Promise<JobSummary> {
  const jobs = (await listJobs(business.id)).map((q) => q.job!)
  return { active: jobs.filter((j) => j.stage !== 'liquidado').length, late: jobs.filter((j) => isLate(j, today)).length, thisWeek: jobs.filter((j) => dueThisWeek(j, today)).length }
}

export type JobProfit = {
  /** Lo que se cobra sin IVA. */
  incomeCents: number
  /** Lo que el cotizador calculó que costaría (si la cotización salió de él). */
  estimatedCostCents?: number
  realCostCents: number
  profitCents: number
  /** Diferencia contra lo estimado: positivo = costó más de lo previsto. */
  overCents?: number
}

/**
 * La ganancia real de una obra: lo cobrado menos el material real y las horas reales (al costo por hora del taller:
 * sueldo más gastos fijos). Solo se calcula cuando ya se capturó el material o las horas.
 */
export function jobProfit(business: Pick<Business, 'quoter'>, quote: Quote): JobProfit | undefined {
  const job = quote.job
  if (!job || (job.realMaterialCents === undefined && job.realHours === undefined)) return undefined
  const { cfg } = quoterSettings(business)
  const hourly = (cfg.sueldo + cfg.gastos) / (cfg.dias * cfg.hDia || 1)
  const realCostCents = (job.realMaterialCents ?? 0) + Math.round((job.realHours ?? 0) * hourly * 100)
  const estimatedCostCents = quote.quoter?.costCents
  return {
    incomeCents: quote.subtotalCents, realCostCents, profitCents: quote.subtotalCents - realCostCents,
    ...(estimatedCostCents !== undefined && { estimatedCostCents, overCents: realCostCents - estimatedCostCents }),
  }
}

export type ShoppingItem = { name: string; qty: number; unit: string }

/** Lo que hay que comprar para una obra con despiece: hojas (según el acomodo), herrajes, tubos y riel. */
export function shoppingList(quote: Quote, cfg: QuoterConfig): ShoppingItem[] {
  const cut = quote.quoter?.cut
  if (!cut) return []
  const specs: CutSpec[] = [cut.spec, ...(cut.more ?? [])]
  const out: ShoppingItem[] = []
  const add = (name: string, qty: number, unit: string) => {
    if (qty > 0) out.push({ name, qty: Math.round(qty * 10) / 10, unit })
  }
  add(`Hoja de melamina de ${cut.spec.grosor} mm (2.44 × 1.22 m)`, pack(cut.pieces, 'melamina', cut.girar).sheets.length, 'hojas')
  add('Hoja de fondo de 3 mm (2.44 × 1.22 m)', pack(cut.pieces, 'fondo', cut.girar).sheets.length, 'hojas')
  let bisagras = 0, correderas = 0, jaladeras = 0, riel = 0
  for (const s of specs) {
    const t = s.kind === 'escritorio' ? deskJob({ largo: s.largo, fondo: s.fondo, alto: s.alto, cajones: s.cajones }, cfg) : measuredJob(s, cfg)
    bisagras += t.b
    correderas += t.c
    jaladeras += t.j
    if (s.kind === 'closet' && s.puertaTipo === 'corrediza' && s.puertas > 0) riel += s.largo / 100
  }
  add('Cubrecanto', Math.ceil(edgeMeters(cut.pieces)), 'metros')
  add('Bisagras', bisagras, 'piezas')
  add('Correderas', correderas, 'pares')
  add('Jaladeras', jaladeras, 'piezas')
  add('Riel para puertas corredizas', riel, 'metros')
  const tubes = cut.pieces.filter((p) => p.material === 'tubo')
  add('Tubo para colgar', tubes.reduce((a, p) => a + (p.qty * p.largo) / 100, 0), 'metros')
  add('Soportes de tubo', tubes.reduce((a, p) => a + p.qty * 2, 0), 'piezas')
  return out
}

export function shoppingText(quote: Quote, cfg: QuoterConfig, customer: string): string {
  const items = shoppingList(quote, cfg)
  return [`*Lista de compras: ${quote.title}${customer ? ` (${customer})` : ''}*`, ...items.map((i) => `${i.qty} ${i.unit} — ${i.name}`)].join('\n')
}
