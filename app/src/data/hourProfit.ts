// Ganancia por hora por tipo de mueble: lo que deja cada hora de trabajo (cobrado sin IVA menos material y gastos de la obra).
import { jobHours } from './capacity'
import { categoryLabel, categoryOf } from './galleryCats'
import type { JobItem } from './jobs'
import type { Business } from './types'

export type HourProfitRow = { key: string; label: string; jobs: number; hours: number; profitCents: number; perHourCents: number; estimated: boolean }

export function hourProfitByType(business: Business, jobs: JobItem[]): HourProfitRow[] {
  const acc = new Map<string, { jobs: number; hours: number; profit: number; estimated: boolean }>()
  for (const j of jobs) {
    const material = (j.spentCents ?? 0) + (j.job.realMaterialCents ?? 0)
    if (!material && j.job.realHours === undefined) continue // sin costos anotados no se sabe
    const hours = j.job.realHours && j.job.realHours > 0 ? j.job.realHours : jobHours(business, j)
    if (!(hours > 0)) continue
    const k = categoryOf(j.title)
    const cur = acc.get(k) ?? { jobs: 0, hours: 0, profit: 0, estimated: false }
    acc.set(k, { jobs: cur.jobs + 1, hours: cur.hours + hours, profit: cur.profit + (j.incomeCents - material), estimated: cur.estimated || !j.job.realHours })
  }
  return [...acc].map(([key, v]) => ({ key, label: categoryLabel(key), jobs: v.jobs, hours: Math.round(v.hours * 10) / 10, profitCents: v.profit, perHourCents: Math.round(v.profit / v.hours), estimated: v.estimated }))
    .sort((a, b) => b.perHourCents - a.perHourCents)
}
