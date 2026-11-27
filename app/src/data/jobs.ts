// Obras del taller: una cotización aceptada o una venta fiada (un encargo) se sigue por etapas hasta entregarla y cobrarla.
// El seguimiento vive en la misma cotización o venta (`job`), así viaja con ella entre aparatos.
import { edgeMeters, pack, type CutSpec } from './cutlist'
import { addDays, dayKey, weekStart } from './dates'
import { db } from './db'
import { deskJob, measuredJob, quoterSettings, type QuoterConfig } from './quoter'
import { listQuotes } from './quotes'
import { docNumber } from './folio'
import type { Business, JobStage, Quote, QuoteJob, Transaction } from './types'

export const STAGES: JobStage[] = ['anticipo', 'material', 'corte', 'armado', 'listo', 'instalado', 'liquidado']
export const STAGE_LABEL: Record<JobStage, string> = {
  anticipo: 'Pedido recibido', material: 'Material comprado', corte: 'En corte', armado: 'En armado', listo: 'Listo para entregar', instalado: 'Instalado', liquidado: 'Liquidado',
}
/** Etapas en que la obra ya se entregó. */
const DELIVERED: JobStage[] = ['instalado', 'liquidado']
export const isDelivered = (job: QuoteJob) => DELIVERED.includes(job.stage)

type Holder = { job?: QuoteJob }

/** La obra puede vivir en una cotización o en una venta: se busca por id en las dos. */
async function patchJob(id: string, fn: (h: Holder) => QuoteJob): Promise<void> {
  const updatedAt = new Date().toISOString()
  const q = await db.quote.get(id)
  if (q && !q.deletedAt) return void (await db.quote.update(id, { job: fn(q), updatedAt }))
  const t = await db.txn.get(id)
  if (t && !t.deletedAt && t.type === 'sale') return void (await db.txn.update(id, { job: fn(t), updatedAt }))
  throw new Error('No se encontró la cotización ni la venta')
}

/** Pasa una cotización o venta a obra (empieza en «pedido recibido»). */
export async function startJob(id: string, input: { deliveryDate?: string } = {}): Promise<void> {
  const q = await db.quote.get(id)
  // Una cotización ya convertida en venta y la venta son el mismo trabajo: solo puede ser obra una de las dos.
  if (q?.transactionId && (await db.txn.get(q.transactionId))?.job) throw new Error('La venta de esa cotización ya es una obra')
  const sale = q ? undefined : await db.txn.get(id)
  const linked = sale && (await listQuotes(sale.businessId)).find((x) => x.transactionId === id && !!x.job)
  if (linked) throw new Error('La cotización de esa venta ya es una obra')
  await patchJob(id, (q) => {
    if (q.job) throw new Error('Eso ya es una obra')
    return { stage: 'anticipo', startedAt: new Date().toISOString(), ...(input.deliveryDate && { deliveryDate: input.deliveryDate }) }
  })
}

const need = (q: Holder): QuoteJob => {
  if (!q.job) throw new Error('No es una obra')
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

export type JobPatch = Partial<Pick<QuoteJob, 'deliveryDate' | 'note' | 'realMaterialCents' | 'realHours' | 'warrantyMonths' | 'trackToken' | 'materialUse'>>

/** Código nuevo para el enlace de seguimiento (difícil de adivinar). */
export function newTrackToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const trackUrl = (token: string, origin = location.origin) => `${origin}/s/${token}`

export const MAX_JOB_PHOTOS = 4
const MAX_PHOTO_CHARS = 160_000

/** Agrega una foto (data URI de JPEG ya reducido) a la obra. */
export async function addJobPhoto(quoteId: string, dataUri: string): Promise<void> {
  if (!/^data:image\/jpeg;base64,/.test(dataUri)) throw new Error('La foto no es válida')
  if (dataUri.length > MAX_PHOTO_CHARS) throw new Error('La foto pesa demasiado')
  await patchJob(quoteId, (q) => {
    const job = need(q)
    if ((job.photos?.length ?? 0) >= MAX_JOB_PHOTOS) throw new Error(`Máximo ${MAX_JOB_PHOTOS} fotos por obra`)
    return { ...job, photos: [...(job.photos ?? []), dataUri] }
  })
}

export async function removeJobPhoto(quoteId: string, index: number): Promise<void> {
  await patchJob(quoteId, (q) => {
    const { photos = [], ...rest } = need(q)
    const next = photos.filter((_, i) => i !== index)
    return { ...rest, ...(next.length && { photos: next }) }
  })
}

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

/** Quita la obra (la cotización o la venta se quedan). */
export async function removeJob(id: string): Promise<void> {
  const updatedAt = new Date().toISOString()
  const q = await db.quote.get(id)
  if (q?.job) {
    const { job: _j, ...rest } = q
    return void (await db.quote.put({ ...rest, updatedAt }))
  }
  const t = await db.txn.get(id)
  if (t?.job) {
    const { job: _j, ...rest } = t
    await db.txn.put({ ...rest, updatedAt })
  }
}

/** Una obra en el tablero, venga de una cotización o de una venta fiada. */
export type JobItem = {
  id: string
  kind: 'quote' | 'sale'
  job: QuoteJob
  title: string
  contactId?: string
  /** «#12» de la cotización o «Venta» con su fecha. */
  folio: string
  totalCents: number
  /** Lo que se cobra sin IVA (para la ganancia). */
  incomeCents: number
  /** Lo que falta cobrar. Si hay venta fiada, sale de los abonos reales; si no, total menos anticipo. */
  balanceCents: number
  quote?: Quote
  sale?: Transaction
  /** Gastos y compras registrados para esta obra (suman a su costo real). */
  spentCents?: number
}

async function paidBySale(businessId: string): Promise<Map<string, number>> {
  const paid = new Map<string, number>()
  for (const p of await db.payment.where('[businessId+date]').between([businessId, ''], [businessId, '\uffff']).toArray()) if (!p.deletedAt) paid.set(p.transactionId, (paid.get(p.transactionId) ?? 0) + p.amountCents)
  return paid
}

const saleBalance = (t: Transaction, paid: Map<string, number>) => (t.status === 'credit' ? Math.max(0, t.amountCents - (paid.get(t.id) ?? 0)) : 0)

/** Ventas que se pueden volver obra: vivas, sin obra y que no vienen de una cotización que ya es obra. */
async function liveSales(businessId: string): Promise<Transaction[]> {
  return db.txn.where('[businessId+type]').equals([businessId, 'sale']).filter((t) => !t.deletedAt).toArray()
}

/** Lo gastado en cada obra: gastos y compras vivos que dicen para qué obra fueron. */
export async function spentByJob(businessId: string): Promise<Map<string, number>> {
  const spent = new Map<string, number>()
  const rows = await db.txn.where('[businessId+type]').equals([businessId, 'expense']).filter((t) => !t.deletedAt && !!t.jobId).toArray()
  for (const t of rows) spent.set(t.jobId!, (spent.get(t.jobId!) ?? 0) + t.amountCents)
  return spent
}

export async function listJobs(businessId: string): Promise<JobItem[]> {
  const [quotes, sales, paid, spent] = await Promise.all([listQuotes(businessId), liveSales(businessId), paidBySale(businessId), spentByJob(businessId)])
  const byId = new Map(sales.map((t) => [t.id, t]))
  const out: JobItem[] = []
  for (const q of quotes) {
    if (!q.job) continue
    const sale = q.transactionId ? byId.get(q.transactionId) : undefined
    out.push({ id: q.id, kind: 'quote', job: q.job, title: q.title, contactId: q.contactId, folio: docNumber(q), totalCents: q.totalCents, incomeCents: q.subtotalCents, balanceCents: q.job.paid ? 0 : sale ? saleBalance(sale, paid) : balanceDue(q), quote: q, ...(sale && { sale }), ...(spent.get(q.id) && { spentCents: spent.get(q.id) }) })
  }
  for (const t of sales) {
    if (!t.job) continue
    out.push({ id: t.id, kind: 'sale', job: t.job, title: t.concept || 'Venta', contactId: t.contactId, folio: `Venta del ${t.date.slice(8, 10)}/${t.date.slice(5, 7)}`, totalCents: t.amountCents, incomeCents: t.amountCents, balanceCents: t.job.paid ? 0 : saleBalance(t, paid), sale: t, ...(spent.get(t.id) && { spentCents: spent.get(t.id) }) })
  }
  return out
}

/** Ventas fiadas que aún deben algo y no son obra: lo que normalmente es un encargo sin entregar. */
/**
 * Ventas que se pueden pasar a obra: las fiadas que aún deben. Con `includePaid`, también las ya liquidadas o de contado
 * de los últimos 6 meses (pagadas pero quizá sin entregar).
 */
export async function salesForJobs(businessId: string, includePaid = false, today = new Date().toISOString().slice(0, 10)): Promise<{ sale: Transaction; balanceCents: number }[]> {
  const [quotes, sales, paid] = await Promise.all([listQuotes(businessId), liveSales(businessId), paidBySale(businessId)])
  const taken = new Set(quotes.filter((q) => q.job && q.transactionId).map((q) => q.transactionId!))
  return sales
    .filter((t) => !t.job && !taken.has(t.id) && (t.status === 'credit' || includePaid))
    .map((sale) => ({ sale, balanceCents: saleBalance(sale, paid) }))
    .filter((x) => x.balanceCents > 0 || (includePaid && x.sale.date.slice(0, 10) >= addDays(today, -183)))
    .sort((a, b) => b.sale.date.localeCompare(a.sale.date))
}

/** Marca que ya pagó todo (o lo desmarca), para obras sin abonos registrados en la app. */
export async function setJobPaid(id: string, paid: boolean): Promise<void> {
  await patchJob(id, (h) => {
    const { paid: _p, ...rest } = need(h)
    return { ...rest, ...(paid && { paid: true }) }
  })
}

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

/** Ya se instaló pero falta liquidarla. */
export const awaitingPayment = (job: QuoteJob) => job.stage === 'instalado'
/** Lo que falta cobrar de una obra, según la cotización (total menos anticipo). */
export const balanceDue = (quote: Quote) => Math.max(0, quote.totalCents - (quote.advanceCents ?? 0))

/** El mensaje para recordarle al cliente el saldo de su obra. */
export function balanceReminder(o: { customer: string; businessName: string; title: string; balanceCents: number; currency: string }): string {
  const first = o.customer.trim().split(/\s+/)[0]
  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: o.currency }).format(o.balanceCents / 100)
  return `Hola${first ? ` ${first}` : ''}, gracias por tu confianza. Te escribo de ${o.businessName}: ya quedó instalado tu ${o.title.toLowerCase()} y queda pendiente el saldo de ${money}. ¿Cuándo te queda bien liquidarlo? Cualquier detalle, aquí estoy.`
}

export type JobSummary = { active: number; late: number; thisWeek: number; unpaid: number }
export async function jobSummary(business: Business, today = dayKey(Date.now(), business.timezone)): Promise<JobSummary> {
  const jobs = (await listJobs(business.id)).map((x) => x.job)
  const items = await listJobs(business.id)
  return { active: jobs.filter((j) => j.stage !== 'liquidado').length, late: jobs.filter((j) => isLate(j, today)).length, thisWeek: jobs.filter((j) => dueThisWeek(j, today)).length, unpaid: items.filter((x) => awaitingPayment(x.job) && x.balanceCents > 0).length }
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
export function jobProfit(business: Pick<Business, 'quoter'>, item: Pick<JobItem, 'job' | 'incomeCents' | 'quote' | 'spentCents'>): JobProfit | undefined {
  const { job, incomeCents } = item
  const spent = item.spentCents ?? 0
  if (job.realMaterialCents === undefined && job.realHours === undefined && !spent) return undefined
  const { cfg } = quoterSettings(business)
  const hourly = (cfg.sueldo + cfg.gastos) / (cfg.dias * cfg.hDia || 1)
  const realCostCents = spent + (job.realMaterialCents ?? 0) + Math.round((job.realHours ?? 0) * hourly * 100)
  const estimatedCostCents = item.quote?.quoter?.costCents
  return {
    incomeCents, realCostCents, profitCents: incomeCents - realCostCents,
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
