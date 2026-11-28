// Plan de la semana en el taller: qué obra se trabaja cada día (lunes a sábado), con las horas que le faltan a cada
// una repartidas entre sus días, y aviso cuando un día pasa de las horas de trabajo.
import { addDays, weekStart } from './dates'
import { jobLeftHours } from './capacity'
import { updateJob, type JobItem } from './jobs'
import { quoterSettings } from './quoter'
import type { Business } from './types'

const DONE = ['instalado', 'liquidado']
export const planWeekDays = (anyDay: string) => Array.from({ length: 6 }, (_, i) => addDays(weekStart(anyDay), i))
export const isPlannable = (j: JobItem) => !DONE.includes(j.job.stage)
export const hoursPerDay = (b: Business) => Math.max(1, quoterSettings(b).cfg.hDia || 8)

export type PlanEntry = { job: JobItem; hours: number }
export type PlanDay = { day: string; entries: PlanEntry[]; hours: number; over: boolean }

/**
 * Horas de cada obra en los días que tiene planeados (de hoy en adelante). Se llenan los días en orden hasta las horas
 * de trabajo (las obras con entrega más cercana primero); lo que no cabe se reparte igual y el día sale sobrecargado.
 */
export function planByDay(business: Business, jobs: JobItem[], days: string[], today: string): PlanDay[] {
  const cap = hoursPerDay(business)
  const map = new Map<string, PlanEntry[]>(days.map((d) => [d, []]))
  const used = new Map<string, number>(days.map((d) => [d, 0]))
  const order = jobs.filter(isPlannable).sort((a, b) => (a.job.deliveryDate ?? '9999').localeCompare(b.job.deliveryDate ?? '9999'))
  for (const j of order) {
    const planned = (j.job.planDays ?? []).filter((d) => d >= today && map.has(d)).sort()
    if (!planned.length) continue
    let left = jobLeftHours(business, j)
    const got = new Map(planned.map((d) => [d, 0]))
    for (const d of planned) {
      const take = Math.max(0, Math.min(cap - used.get(d)!, left))
      got.set(d, take); used.set(d, used.get(d)! + take); left -= take
    }
    if (left > 0.05) for (const d of planned) { const extra = left / planned.length; got.set(d, got.get(d)! + extra); used.set(d, used.get(d)! + extra) }
    for (const d of planned) map.get(d)!.push({ job: j, hours: Math.round(got.get(d)! * 10) / 10 })
  }
  return days.map((day) => {
    const entries = map.get(day) ?? []
    const hours = Math.round((used.get(day) ?? 0) * 10) / 10
    return { day, entries, hours, over: hours > cap + 0.05 }
  })
}

/**
 * Acomodo automático: las obras por fecha de entrega (las atrasadas y más cercanas primero), llenando cada día hasta
 * las horas de trabajo, desde hoy (o el lunes si la semana es futura) hasta el sábado. Regresa obra → días.
 */
export function autoPlan(business: Business, jobs: JobItem[], days: string[], today: string): Map<string, string[]> {
  const cap = hoursPerDay(business)
  const open = days.filter((d) => d >= today)
  const free = new Map(open.map((d) => [d, cap]))
  const out = new Map<string, string[]>()
  const order = jobs.filter(isPlannable).sort((a, b) => (a.job.deliveryDate ?? '9999').localeCompare(b.job.deliveryDate ?? '9999'))
  for (const j of order) {
    let left = jobLeftHours(business, j)
    const mine: string[] = []
    for (const d of open) {
      if (left <= 0.05) break
      const f = free.get(d)!
      if (f <= 0.05) continue
      const take = Math.min(f, left)
      free.set(d, f - take)
      left -= take
      mine.push(d)
    }
    if (mine.length) out.set(j.id, mine)
  }
  return out
}

/** Guarda el plan de la semana: reemplaza los días de esta semana de cada obra y conserva los de otras semanas. */
export async function savePlan(jobs: JobItem[], days: string[], plan: Map<string, string[]>): Promise<void> {
  const inWeek = new Set(days)
  for (const j of jobs.filter(isPlannable)) {
    const keep = (j.job.planDays ?? []).filter((d) => !inWeek.has(d))
    const next = [...keep, ...(plan.get(j.id) ?? [])].sort()
    const cur = [...(j.job.planDays ?? [])].sort()
    if (next.join() !== cur.join()) await updateJob(j.id, { planDays: next.length ? next : undefined })
  }
}

export async function togglePlanDay(job: JobItem, day: string): Promise<void> {
  const cur = job.job.planDays ?? []
  const next = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day].sort()
  await updateJob(job.id, { planDays: next.length ? next : undefined })
}
