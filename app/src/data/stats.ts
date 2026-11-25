import { summarizeTransactions, type Balance } from './balance'
import { listCategories } from './categories'
import { addDays, addMonths, dayKey, dayNumber, dayRange, formatDay, monthStart, weekdayShort, weekStart, type Range } from './dates'
import { listPayments } from './debts'
import { db } from './db'
import { METHOD_LABEL, METHODS } from './methods'
import { lineNet, lineTotal, listTransactions, saleProfit } from './transactions'
import type { PaymentMethod, Transaction, TransactionItem } from './types'

export type StatsPeriod = 'week' | 'month' | 'year'

export type Bucket = { key: string; label: string; start: string; end: string }

/** Barras del periodo: días de la semana, días del mes o meses del año (claves en la zona del negocio). */
export function statsBuckets(period: StatsPeriod, anchor: string): Bucket[] {
  if (period === 'week') {
    const start = weekStart(anchor)
    return Array.from({ length: 7 }, (_, i) => {
      const k = addDays(start, i)
      return { key: k, label: weekdayShort(k), start: k, end: k }
    })
  }
  if (period === 'month') {
    const start = monthStart(anchor)
    const days = (Date.UTC(+start.slice(0, 4), +start.slice(5, 7), 1) - Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, 1)) / 86_400_000
    return Array.from({ length: days }, (_, i) => {
      const k = addDays(start, i)
      return { key: k, label: dayNumber(k), start: k, end: k }
    })
  }
  const jan = `${anchor.slice(0, 4)}-01-01`
  return Array.from({ length: 12 }, (_, i) => {
    const start = addMonths(jan, i)
    return { key: start.slice(0, 7), label: monthShort(start), start, end: addDays(addMonths(start, 1), -1) }
  })
}

const monthShort = (key: string) =>
  new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'short' }).format(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, 15)).replace('.', '')

export function statsRange(period: StatsPeriod, anchor: string, timeZone: string): Required<Range> {
  const b = statsBuckets(period, anchor)
  return { from: dayRange(b[0].start, timeZone).from, to: dayRange(b[b.length - 1].end, timeZone).to }
}

export function shiftStatsAnchor(period: StatsPeriod, anchor: string, dir: -1 | 1): string {
  if (period === 'week') return addDays(anchor, 7 * dir)
  if (period === 'month') return addMonths(anchor, dir)
  return addMonths(`${anchor.slice(0, 4)}-01-01`, 12 * dir)
}

export function statsLabel(period: StatsPeriod, anchor: string): string {
  const b = statsBuckets(period, anchor)
  if (period === 'year') return anchor.slice(0, 4)
  if (period === 'month') return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(Date.UTC(+anchor.slice(0, 4), +anchor.slice(5, 7) - 1, 15))
  return `${formatDay(b[0].start)} – ${formatDay(b[6].start)}`
}

export type TopProduct = { productId: string; name: string; quantity: number; revenueCents: number; profitCents: number }
export type CategoryTotal = { categoryId?: string; name: string; totalCents: number; share: number }
export type MethodTotal = { method: PaymentMethod; label: string; totalCents: number }

export type Stats = {
  range: Required<Range>
  /** Ventas registradas por barra (incluye fiadas: es lo vendido, no lo cobrado). */
  buckets: (Bucket & { salesCents: number })[]
  salesCents: number
  salesCount: number
  avgTicketCents: number
  /** Flujo de caja: cobrado, pagado y utilidad (igual que el Balance). */
  cash: Balance
  /** Precio − costo de las ventas con productos (las ventas rápidas no tienen costo y no cuentan). */
  productProfitCents: number
  topProducts: TopProduct[]
  /** Gastos registrados (incluye los de crédito) por categoría, de mayor a menor. */
  expensesByCategory: CategoryTotal[]
  /** Lo cobrado por método: ventas de contado + abonos de clientes. */
  incomeByMethod: MethodTotal[]
  sales: Transaction[]
  expenses: Transaction[]
  items: TransactionItem[]
}

export async function computeStats(businessId: string, period: StatsPeriod, anchor: string, timeZone: string, topN = 10): Promise<Stats> {
  const range = statsRange(period, anchor, timeZone)
  const [rows, payments, categories] = await Promise.all([listTransactions(businessId, range), listPayments(businessId, range), listCategories(businessId, 'expense')])
  const sales = rows.filter((t) => t.type === 'sale')
  const expenses = rows.filter((t) => t.type === 'expense')
  const items = sales.length ? await db.txnItem.where('transactionId').anyOf(sales.map((s) => s.id)).toArray() : []

  const buckets = statsBuckets(period, anchor).map((b) => ({ ...b, salesCents: 0 }))
  const index = new Map(buckets.map((b, i) => [b.key, i]))
  for (const s of sales) {
    const k = dayKey(s.date, timeZone)
    const i = index.get(period === 'year' ? k.slice(0, 7) : k)
    if (i !== undefined) buckets[i].salesCents += s.amountCents
  }
  const salesCents = sales.reduce((sum, s) => sum + s.amountCents, 0)

  const itemsBySale = new Map<string, TransactionItem[]>()
  for (const i of items) itemsBySale.set(i.transactionId, [...(itemsBySale.get(i.transactionId) ?? []), i])
  const productProfitCents = [...itemsBySale.values()].reduce((sum, list) => sum + saleProfit(list), 0)

  const byProduct = new Map<string, TopProduct>()
  for (const i of items) {
    if (!i.productId) continue
    const p = byProduct.get(i.productId) ?? { productId: i.productId, name: i.name, quantity: 0, revenueCents: 0, profitCents: 0 }
    p.quantity = Math.round((p.quantity + i.quantity) * 1000) / 1000
    p.revenueCents += lineNet(i)
    p.profitCents += lineNet(i) - lineTotal(i.quantity, i.unitCostCents)
    byProduct.set(i.productId, p)
  }
  // Las variantes se suman en su producto: se muestra el nombre del producto, no el de la primera variante vendida.
  const names = await db.product.bulkGet([...byProduct.keys()])
  for (const p of names) if (p && byProduct.has(p.id)) byProduct.get(p.id)!.name = p.name
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenueCents - a.revenueCents || a.name.localeCompare(b.name, 'es')).slice(0, topN)

  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const byCat = new Map<string, CategoryTotal>()
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amountCents, 0)
  for (const e of expenses) {
    const key = e.categoryId && catName.has(e.categoryId) ? e.categoryId : ''
    const c = byCat.get(key) ?? { categoryId: key || undefined, name: key ? catName.get(key)! : 'Sin categoría', totalCents: 0, share: 0 }
    c.totalCents += e.amountCents
    byCat.set(key, c)
  }
  const expensesByCategory = [...byCat.values()]
    .map((c) => ({ ...c, share: expenseTotal ? c.totalCents / expenseTotal : 0 }))
    .sort((a, b) => b.totalCents - a.totalCents)

  const byMethod = new Map<PaymentMethod, number>()
  for (const s of sales) if (s.status === 'paid') byMethod.set(s.paymentMethod, (byMethod.get(s.paymentMethod) ?? 0) + s.amountCents)
  for (const p of payments) if (p.direction === 'in') byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountCents)
  const incomeByMethod = METHODS.filter((m) => byMethod.get(m.value)).map((m) => ({ method: m.value, label: METHOD_LABEL[m.value], totalCents: byMethod.get(m.value)! }))
    .sort((a, b) => b.totalCents - a.totalCents)

  return {
    range, buckets, salesCents, salesCount: sales.length, avgTicketCents: sales.length ? Math.round(salesCents / sales.length) : 0,
    cash: summarizeTransactions(rows, payments), productProfitCents, topProducts, expensesByCategory, incomeByMethod, sales, expenses, items,
  }
}
