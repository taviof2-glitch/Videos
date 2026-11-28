// Pagos habituales del taller (renta, luz, agua, sueldos…): qué toca pagar cada mes y qué ya se pagó.
// La lista vive en el negocio (viaja con él entre aparatos). Cada pago hecho es un gasto normal enlazado por `fixedId`,
// así sale en el balance y las estadísticas sin contarse dos veces.
import { dayKey, periodRange } from './dates'
import { db } from './db'
import { createExpense, listTransactions } from './transactions'
import type { Business, FixedFreq, FixedPayment, PaymentMethod, Transaction } from './types'

export const FREQ_LABEL: Record<FixedFreq, string> = { semanal: 'Cada semana', quincenal: 'Cada quincena', mensual: 'Cada mes', bimestral: 'Cada dos meses', anual: 'Una vez al año' }
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** Para empezar rápido. */
export const SUGGESTED = ['Renta', 'Luz', 'Agua', 'Internet', 'Teléfono', 'Gas', 'Sueldos', 'Contador', 'Mantenimiento']

export const listFixed = (business: Pick<Business, 'fixedPayments'>): FixedPayment[] => business.fixedPayments ?? []

export type FixedInput = { id?: string; name: string; amountCents: number; freq: FixedFreq; day?: number; month?: number }

/** Agrega un pago habitual o cambia el que ya existe (por `id`). */
export async function saveFixed(businessId: string, input: FixedInput): Promise<FixedPayment> {
  const name = input.name.trim()
  if (!name) throw new Error('Escribe el nombre del pago')
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('El monto debe ser mayor que cero')
  const needsDay = input.freq === 'mensual' || input.freq === 'bimestral' || input.freq === 'anual'
  const day = needsDay && input.day ? Math.min(31, Math.max(1, Math.round(input.day))) : undefined
  const month = input.freq === 'bimestral' || input.freq === 'anual' ? Math.min(12, Math.max(1, Math.round(input.month || 1))) : undefined
  const business = await db.business.get(businessId)
  if (!business) throw new Error('Negocio no encontrado')
  const list = listFixed(business)
  if (list.some((p) => p.id !== input.id && p.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)) throw new Error('Ya tienes un pago con ese nombre')
  const payment: FixedPayment = { id: input.id ?? crypto.randomUUID(), name, amountCents: input.amountCents, freq: input.freq, ...(day && { day }), ...(month && { month }) }
  const next = list.some((p) => p.id === payment.id) ? list.map((p) => (p.id === payment.id ? payment : p)) : [...list, payment]
  await db.business.update(businessId, { fixedPayments: next, updatedAt: new Date().toISOString() })
  return payment
}

/** Quita un pago habitual de la lista. Los gastos ya registrados se quedan. */
export async function deleteFixed(businessId: string, id: string): Promise<void> {
  const business = await db.business.get(businessId)
  if (!business) return
  await db.business.update(businessId, { fixedPayments: listFixed(business).filter((p) => p.id !== id), updatedAt: new Date().toISOString() })
}

/** Cuántas veces toca pagarlo en ese mes ('YYYY-MM-DD' de cualquier día del mes). */
export function expectedInMonth(p: FixedPayment, monthKey: string): number {
  const m = Number(monthKey.slice(5, 7))
  switch (p.freq) {
    case 'semanal': return 4
    case 'quincenal': return 2
    case 'mensual': return 1
    case 'bimestral': return (m - (p.month ?? 1) + 12) % 2 === 0 ? 1 : 0
    case 'anual': return m === (p.month ?? 1) ? 1 : 0
  }
}

/** Lo que representa al mes, en promedio (para saber cuánto hay que juntar). */
export function monthlyAverageCents(p: FixedPayment): number {
  const perMonth = { semanal: 52 / 12, quincenal: 2, mensual: 1, bimestral: 0.5, anual: 1 / 12 }[p.freq]
  return Math.round(p.amountCents * perMonth)
}

export type FixedState = 'pagado' | 'pendiente' | 'vencido' | 'no-toca'
export type FixedRow = {
  payment: FixedPayment
  expected: number
  paid: Transaction[]
  paidCents: number
  /** Lo que falta por pagar de este mes (según el monto habitual). */
  remainingCents: number
  state: FixedState
}
export type FixedMonth = { rows: FixedRow[]; expectedCents: number; paidCents: number; remainingCents: number; averageCents: number }

/** El control del mes: qué toca, qué se pagó y qué falta. `anchor` es cualquier día del mes; `today`, el día de hoy. */
export async function fixedMonth(business: Business, anchor: string, today = dayKey(Date.now(), business.timezone)): Promise<FixedMonth> {
  const range = periodRange('month', anchor, business.timezone)
  const expenses = (await listTransactions(business.id, { type: 'expense', ...range })).filter((t) => t.fixedId)
  const month = anchor.slice(0, 7)
  const thisMonth = today.slice(0, 7)
  const rows = listFixed(business).map((payment): FixedRow => {
    const expected = expectedInMonth(payment, anchor)
    const paid = expenses.filter((t) => t.fixedId === payment.id)
    const paidCents = paid.reduce((a, t) => a + t.amountCents, 0)
    const missing = Math.max(0, expected - paid.length)
    let state: FixedState = 'pendiente'
    if (expected === 0 && paid.length === 0) state = 'no-toca'
    else if (missing === 0) state = 'pagado'
    else if (month < thisMonth || (month === thisMonth && !!payment.day && Number(today.slice(8, 10)) > payment.day)) state = 'vencido'
    return { payment, expected, paid, paidCents, remainingCents: missing * payment.amountCents, state }
  })
  const order: Record<FixedState, number> = { vencido: 0, pendiente: 1, pagado: 2, 'no-toca': 3 }
  rows.sort((a, b) => order[a.state] - order[b.state] || (a.payment.day ?? 99) - (b.payment.day ?? 99) || a.payment.name.localeCompare(b.payment.name, 'es'))
  const paidCents = rows.reduce((a, r) => a + r.paidCents, 0)
  const remainingCents = rows.reduce((a, r) => a + r.remainingCents, 0)
  return { rows, paidCents, remainingCents, expectedCents: paidCents + remainingCents, averageCents: listFixed(business).reduce((a, p) => a + monthlyAverageCents(p), 0) }
}

/** Registra un pago: queda como un gasto normal (sale en el balance) enlazado a este pago habitual. */
export async function payFixed(businessId: string, payment: FixedPayment, input: { amountCents: number; paymentMethod?: PaymentMethod; date?: string }): Promise<Transaction> {
  return createExpense(businessId, { amountCents: input.amountCents, concept: payment.name, paymentMethod: input.paymentMethod ?? 'cash', date: input.date, fixedId: payment.id })
}
