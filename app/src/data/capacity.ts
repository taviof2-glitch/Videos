// Fecha de entrega realista: cuántas horas de trabajo quedan en las obras del taller y, con las horas que se
// trabajan al día, para cuándo podría entregarse una obra nueva. Es aproximado.
import { addDays } from './dates'
import type { JobItem } from './jobs'
import { calcQuote, quoterSettings, type QuoterForm } from './quoter'
import type { Business, JobStage } from './types'

/** Qué parte del trabajo falta en cada etapa. */
export const LEFT: Record<JobStage, number> = { anticipo: 1, material: 1, corte: 0.8, armado: 0.45, listo: 0.1, instalado: 0, liquidado: 0 }
/** Si la obra no salió del cotizador, se supone esto (dos días). */
export const DEFAULT_JOB_HOURS = 16

export function jobHours(business: Business, item: JobItem): number {
  const snap = item.quote?.quoter
  if (snap) {
    try {
      const { cfg, types, mats, over } = quoterSettings(business)
      const h = calcQuote(cfg, types, snap as unknown as QuoterForm, mats, over).hours
      if (h > 0 && Number.isFinite(h)) return h
    } catch { /* cotización vieja o incompleta: se usa el estimado */ }
  }
  return DEFAULT_JOB_HOURS
}

/** Horas que le faltan a una obra (según su etapa y las horas reales ya anotadas). */
export function jobLeftHours(business: Business, j: JobItem): number {
  const total = jobHours(business, j)
  const left = total * LEFT[j.job.stage]
  return Math.max(0, j.job.realHours ? Math.min(left, total - j.job.realHours) : left)
}

/** Horas que faltan de las obras en el taller (descontando las horas reales ya anotadas). */
export function backlogHours(business: Business, jobs: JobItem[]): number {
  return jobs.reduce((s, j) => s + jobLeftHours(business, j), 0)
}

/** Suma días de trabajo (sin domingos) a partir de mañana. */
export function addWorkDays(from: string, days: number): string {
  let d = from
  let n = Math.max(1, Math.ceil(days))
  while (n > 0) {
    d = addDays(d, 1)
    if (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0) n--
  }
  return d
}

export type Capacity = { backlogHours: number; backlogDays: number; hoursPerDay: number; /** Entrega de una obra nueva de `newHours`. */ nextDelivery: string; newHours: number }

export function capacity(business: Business, jobs: JobItem[], today: string, newHours = DEFAULT_JOB_HOURS): Capacity {
  const perDay = Math.max(1, quoterSettings(business).cfg.hDia || 8)
  const back = backlogHours(business, jobs)
  return { backlogHours: Math.round(back), backlogDays: Math.round((back / perDay) * 10) / 10, hoursPerDay: perDay, newHours, nextDelivery: addWorkDays(today, (back + newHours) / perDay) }
}
