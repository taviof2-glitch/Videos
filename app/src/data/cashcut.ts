// Corte de caja y meta del mes: cuánto entró y salió por cada forma de pago (lo que de verdad se movió: ventas de
// contado, abonos, gastos pagados y pagos a proveedores) y cómo va la venta del mes contra la meta.
import { addDays, daysBetween, monthStart, periodRange, weekStart } from './dates'
import { db } from './db'
import { listPayments } from './debts'
import { METHOD_LABEL, METHODS } from './methods'
import { listTransactions } from './transactions'
import type { PaymentMethod } from './types'

export type CutRow = { method: PaymentMethod; label: string; inCents: number; outCents: number; netCents: number }
export type CashCut = { from: string; to: string; rows: CutRow[]; inCents: number; outCents: number; netCents: number; cashCents: number; salesCount: number }

export async function cashCut(businessId: string, period: 'day' | 'week', anchor: string, timeZone: string): Promise<CashCut> {
  const start = period === 'day' ? anchor : weekStart(anchor)
  const end = period === 'day' ? anchor : addDays(start, 6)
  const range = periodRange(period === 'day' ? 'day' : 'week', anchor, timeZone)
  const [rows, payments] = await Promise.all([listTransactions(businessId, range), listPayments(businessId, range)])
  const inn = new Map<PaymentMethod, number>()
  const out = new Map<PaymentMethod, number>()
  const add = (m: Map<PaymentMethod, number>, k: PaymentMethod, c: number) => m.set(k, (m.get(k) ?? 0) + c)
  let salesCount = 0
  for (const t of rows) {
    if (t.status !== 'paid') continue
    if (t.type === 'sale') { add(inn, t.paymentMethod, t.amountCents); salesCount++ } else add(out, t.paymentMethod, t.amountCents)
  }
  for (const p of payments) add(p.direction === 'in' ? inn : out, p.method, p.amountCents)
  const list = METHODS.map((m) => ({ method: m.value, label: METHOD_LABEL[m.value], inCents: inn.get(m.value) ?? 0, outCents: out.get(m.value) ?? 0 }))
    .filter((r) => r.inCents || r.outCents)
    .map((r) => ({ ...r, netCents: r.inCents - r.outCents }))
  const sum = (k: 'inCents' | 'outCents') => list.reduce((s, r) => s + r[k], 0)
  return { from: start, to: end, rows: list, inCents: sum('inCents'), outCents: sum('outCents'), netCents: sum('inCents') - sum('outCents'), cashCents: list.find((r) => r.method === 'cash')?.netCents ?? 0, salesCount }
}

export type GoalProgress = { goalCents: number; soldCents: number; pct: number; /** Lo que se esperaría a esta altura del mes. */ expectedCents: number; daysLeft: number; perDayCents: number }

/** Venta del mes (lo vendido, de contado o fiado) contra la meta. */
export async function monthGoal(businessId: string, goalCents: number, today: string, timeZone: string): Promise<GoalProgress> {
  const rows = await listTransactions(businessId, periodRange('month', today, timeZone))
  const soldCents = rows.filter((t) => t.type === 'sale').reduce((s, t) => s + t.amountCents, 0)
  const first = monthStart(today)
  const next = monthStart(addDays(first, 32))
  const total = daysBetween(first, next)
  const passed = daysBetween(first, today) + 1
  const daysLeft = Math.max(0, total - passed)
  return {
    goalCents, soldCents, pct: goalCents ? Math.min(100, Math.round((soldCents / goalCents) * 100)) : 0,
    expectedCents: Math.round((goalCents * passed) / total), daysLeft,
    perDayCents: daysLeft ? Math.max(0, Math.round((goalCents - soldCents) / daysLeft)) : Math.max(0, goalCents - soldCents),
  }
}

export async function saveMonthGoal(businessId: string, goalCents: number | undefined): Promise<void> {
  await db.business.update(businessId, { monthGoalCents: goalCents && goalCents > 0 ? goalCents : undefined, updatedAt: new Date().toISOString() })
}

/** El mes anterior (AAAA-MM-01) para el reporte del contador. */
export const lastMonthAnchor = (today: string) => monthStart(addDays(monthStart(today), -1))
