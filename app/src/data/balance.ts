import type { Range } from './dates'
import { listTransactions } from './transactions'
import type { Transaction } from './types'

export type Balance = { incomeCents: number; expenseCents: number; profitCents: number; salesCount: number; expenseCount: number }

/**
 * Ingresos, egresos y utilidad (ingresos − egresos) de una lista de movimientos.
 * Es el único lugar donde se define qué cuenta como ingreso: T6 lo ajustará para que
 * las ventas fiadas cuenten cuando se cobran (abonos) y no al venderse.
 */
export function summarizeTransactions(rows: Transaction[]): Balance {
  let incomeCents = 0
  let expenseCents = 0
  let salesCount = 0
  let expenseCount = 0
  for (const t of rows) {
    if (t.deletedAt) continue
    if (t.type === 'sale') {
      incomeCents += t.amountCents
      salesCount++
    } else {
      expenseCents += t.amountCents
      expenseCount++
    }
  }
  return { incomeCents, expenseCents, profitCents: incomeCents - expenseCents, salesCount, expenseCount }
}

export async function balanceForRange(businessId: string, range: Range = {}): Promise<Balance> {
  return summarizeTransactions(await listTransactions(businessId, range))
}
