import type { Range } from './dates'
import { listPayments } from './debts'
import { listTransactions } from './transactions'
import type { Payment, Transaction } from './types'

export type Balance = { incomeCents: number; expenseCents: number; profitCents: number; salesCount: number; expenseCount: number }

/**
 * Ingresos, egresos y utilidad (ingresos − egresos) del flujo de caja:
 * - una venta o gasto al contado cuenta el día en que ocurre;
 * - una venta fiada o un gasto a crédito NO cuenta hasta que se cobra o se paga: cada abono cuenta el día que se registra.
 * Es el único lugar que define qué es ingreso o egreso.
 */
export function summarizeTransactions(rows: Transaction[], payments: Payment[] = []): Balance {
  let incomeCents = 0
  let expenseCents = 0
  let salesCount = 0
  let expenseCount = 0
  for (const t of rows) {
    if (t.deletedAt) continue
    const cash = t.status === 'paid' ? t.amountCents : 0
    if (t.type === 'sale') {
      incomeCents += cash
      salesCount++
    } else {
      expenseCents += cash
      expenseCount++
    }
  }
  for (const p of payments) {
    if (p.deletedAt) continue
    if (p.direction === 'in') incomeCents += p.amountCents
    else expenseCents += p.amountCents
  }
  return { incomeCents, expenseCents, profitCents: incomeCents - expenseCents, salesCount, expenseCount }
}

export async function balanceForRange(businessId: string, range: Range = {}): Promise<Balance> {
  const [rows, payments] = await Promise.all([listTransactions(businessId, range), listPayments(businessId, range)])
  return summarizeTransactions(rows, payments)
}

/** Cambio de las ventas de hoy contra ayer: porcentaje con un decimal, o 'new' si ayer no hubo ventas y hoy sí. */
export function changeVsYesterday(todayCents: number, yesterdayCents: number): { kind: 'pct'; pct: number } | { kind: 'new' } {
  if (yesterdayCents > 0) return { kind: 'pct', pct: Math.round(((todayCents - yesterdayCents) / yesterdayCents) * 1000) / 10 }
  return todayCents > 0 ? { kind: 'new' } : { kind: 'pct', pct: 0 }
}
