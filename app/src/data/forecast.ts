// Dinero de las próximas 4 semanas: lo que debería entrar (saldos de obras y fiados con fecha) contra lo que hay que
// pagar (pagos del taller y proveedores a crédito). Es una guía para ver si alguna semana se ve apretada.
import { addDays } from './dates'
import { fixedMonth, listFixed } from './fixed'
import { listJobs } from './jobs'
import { db } from './db'
import type { Business, FixedPayment } from './types'

export type Flow = { label: string; cents: number; date: string }
export type ForecastWeek = { from: string; to: string; inCents: number; outCents: number; netCents: number; runningCents: number; ins: Flow[]; outs: Flow[] }
export type Forecast = { weeks: ForecastWeek[]; undatedInCents: number; undatedOutCents: number; tight?: ForecastWeek }

const lastDay = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()
const dayIn = (ym: string, d: number) => `${ym}-${String(Math.min(Math.max(1, d), lastDay(ym))).padStart(2, '0')}`

/** Fechas en que toca un pago del taller entre `from` y `to` (incluidos). `paidMonths`: meses ya pagados. */
export function fixedDates(p: FixedPayment, from: string, to: string, paidThisMonth = false): string[] {
  const out: string[] = []
  const thisMonth = from.slice(0, 7)
  if (p.freq === 'semanal') for (let d = from; d <= to; d = addDays(d, 7)) out.push(d)
  else {
    for (let ym = thisMonth; ym <= to.slice(0, 7); ym = addDays(`${ym}-28`, 7).slice(0, 7)) {
      const m = Number(ym.slice(5, 7))
      const days = p.freq === 'quincenal' ? [15, lastDay(ym)] : p.freq === 'mensual' || (p.freq === 'bimestral' && (m - (p.month ?? 1) + 12) % 2 === 0) || (p.freq === 'anual' && m === (p.month ?? 1)) ? [p.day ?? 1] : []
      for (const d of days) {
        const date = dayIn(ym, d)
        if (ym === thisMonth && paidThisMonth) continue
        out.push(date < from && ym === thisMonth ? from : date) // si ya pasó el día y no se ha pagado, cuenta para esta semana
      }
    }
  }
  return out.filter((d) => d >= from && d <= to)
}

export function buildForecast(today: string, ins: Flow[], outs: Flow[], weeks = 4): Forecast {
  const end = addDays(today, weeks * 7 - 1)
  const clamp = (f: Flow) => ({ ...f, date: f.date < today ? today : f.date })
  const dated = (l: Flow[]) => l.filter((f) => f.date && f.date <= end).map(clamp)
  const inD = dated(ins), outD = dated(outs)
  let running = 0
  const list: ForecastWeek[] = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(today, i * 7), to = addDays(from, 6)
    const wi = inD.filter((f) => f.date >= from && f.date <= to), wo = outD.filter((f) => f.date >= from && f.date <= to)
    const inCents = wi.reduce((a, f) => a + f.cents, 0), outCents = wo.reduce((a, f) => a + f.cents, 0)
    running += inCents - outCents
    return { from, to, inCents, outCents, netCents: inCents - outCents, runningCents: running, ins: wi, outs: wo }
  })
  return {
    weeks: list,
    undatedInCents: ins.filter((f) => !f.date).reduce((a, f) => a + f.cents, 0),
    undatedOutCents: outs.filter((f) => !f.date).reduce((a, f) => a + f.cents, 0),
    tight: list.find((w) => w.runningCents < 0),
  }
}

export async function loadForecast(business: Business, today: string): Promise<Forecast> {
  const end = addDays(today, 27)
  const [jobs, month, credits] = await Promise.all([
    listJobs(business.id),
    fixedMonth(business, today, today),
    Promise.all((['sale', 'expense'] as const).map((type) => db.txn.where('[businessId+type]').equals([business.id, type]).filter((t) => !t.deletedAt && t.status === 'credit').toArray())).then((l) => l.flat()),
  ])
  const names = new Map((await db.contact.bulkGet([...new Set(credits.map((t) => t.contactId).filter((x): x is string => !!x))])).filter((c) => !!c).map((c) => [c!.id, c!.name]))
  const ins: Flow[] = []
  const jobSales = new Set(jobs.map((j) => j.sale?.id).filter(Boolean))
  for (const j of jobs) if (!j.job.paid && j.balanceCents > 0 && j.job.stage !== 'liquidado') ins.push({ label: `Saldo de ${j.title}`, cents: j.balanceCents, date: j.job.deliveryDate ?? '' })
  const paid = new Map<string, number>()
  if (credits.length) for (const p of await db.payment.where('transactionId').anyOf(credits.map((t) => t.id)).toArray()) if (!p.deletedAt) paid.set(p.transactionId, (paid.get(p.transactionId) ?? 0) + p.amountCents)
  const outs: Flow[] = []
  for (const t of credits) {
    const left = t.amountCents - (paid.get(t.id) ?? 0)
    if (left <= 0) continue
    const who = names.get(t.contactId ?? '') ?? (t.type === 'sale' ? 'cliente' : 'proveedor')
    if (t.type === 'sale' && !jobSales.has(t.id) && !t.job) ins.push({ label: `${who} (fiado)`, cents: left, date: t.dueDate ?? '' })
    if (t.type === 'expense') outs.push({ label: `${who} (a crédito)`, cents: left, date: t.dueDate ?? '' })
  }
  const paidNow = new Set(month.rows.filter((r) => r.state === 'pagado').map((r) => r.payment.id))
  for (const p of listFixed(business)) for (const d of fixedDates(p, today, end, paidNow.has(p.id))) outs.push({ label: p.name, cents: p.amountCents, date: d })
  return buildForecast(today, ins, outs)
}
