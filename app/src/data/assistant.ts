// Resumen del negocio para el asistente: lo mismo que se ve en la app, en texto corto. Sale de los datos del aparato.
import { balanceForRange } from './balance'
import { listContacts } from './contacts'
import { addDays, monthStart, periodRange } from './dates'
import { debtSummary } from './debts'
import { fixedMonth } from './fixed'
import { isDelivered, isLate, listJobs, STAGE_LABEL } from './jobs'
import { isLow, listMaterials } from './materials'
import { formatMoney } from './money'
import { listOrders } from './orders'
import { listProducts } from './products'
import { listQuotes, quoteState } from './quotes'
import type { Business } from './types'

const MAX_ROWS = 15
const STATE_TEXT: Record<string, string> = { pending: 'vigente', expiring: 'por vencer', expired: 'vencida' }

/** Lista corta: si hay más renglones de los que caben, lo dice. */
function rows(title: string, items: string[]): string[] {
  if (!items.length) return [`${title}: ninguno.`]
  const more = items.length > MAX_ROWS ? [`  (y ${items.length - MAX_ROWS} más que no caben aquí)`] : []
  return [`${title} (${items.length}):`, ...items.slice(0, MAX_ROWS).map((i) => `  - ${i}`), ...more]
}

export async function businessContext(business: Business, today: string): Promise<string> {
  const money = (c: number) => formatMoney(c, business.currency)
  const tz = business.timezone
  const lastMonth = addDays(monthStart(today), -1)
  const [day, month, prev, receivable, payable, jobs, quotes, fixed, orders, restock, customers] = await Promise.all([
    balanceForRange(business.id, periodRange('day', today, tz)),
    balanceForRange(business.id, periodRange('month', today, tz)),
    balanceForRange(business.id, periodRange('month', lastMonth, tz)),
    debtSummary(business.id, 'receivable', today),
    debtSummary(business.id, 'payable', today),
    listJobs(business.id),
    listQuotes(business.id),
    fixedMonth(business, today, today),
    listOrders(business.id),
    listProducts(business.id, { onlyRestock: true }),
    listContacts(business.id, 'customer'),
  ])
  const name = new Map(customers.map((c) => [c.id, c.name]))
  const who = (id: string) => name.get(id) ?? 'cliente sin nombre'
  const bal = (label: string, b: typeof day) => `${label}: cobrado ${money(b.incomeCents)} (${b.salesCount} ventas registradas, contando las de crédito), gastos pagados ${money(b.expenseCents)} (${b.expenseCount} gastos), balance ${money(b.profitCents)}.`
  const debt = (d: (typeof receivable)['debtors'][number]) => `${d.contact.name}: ${money(d.balanceCents)}${d.overdueCents ? ` (vencido ${money(d.overdueCents)})` : ''}${d.nextDue ? `, fecha límite ${d.nextDue}` : ''}`
  const active = jobs.filter((x) => x.job.stage !== 'liquidado')
  const open = quotes.filter((q) => q.status === 'pending' && !q.job)
  const low = listMaterials(business).filter(isLow)
  return [
    `Negocio: ${business.name}. Hoy es ${today}. Montos en ${business.currency}.`,
    'El balance cuenta lo cobrado y lo pagado; las ventas a crédito cuentan cuando se cobran.',
    '',
    bal('Hoy', day),
    bal('Este mes', month),
    bal('Mes pasado', prev),
    '',
    `Clientes que deben: total ${money(receivable.totalCents)}, vencido ${money(receivable.overdueCents)}.`,
    ...rows('Clientes con saldo', receivable.debtors.map(debt)),
    `Lo que el negocio debe a proveedores: total ${money(payable.totalCents)}, vencido ${money(payable.overdueCents)}.`,
    ...rows('Proveedores con saldo', payable.debtors.map(debt)),
    '',
    ...rows('Obras en curso', active.map((x) => {
      const j = x.job
      const flags = [isLate(j, today) ? 'ATRASADA' : '', isDelivered(j) ? 'entregada sin liquidar' : ''].filter(Boolean).join(', ')
      return `${x.folio} ${x.title} — ${who(x.contactId ?? '')}: etapa «${STAGE_LABEL[j.stage]}», entrega ${j.deliveryDate ?? 'sin fecha'}, total ${money(x.totalCents)}, falta cobrar ${money(x.balanceCents)}${flags ? ` [${flags}]` : ''}${j.note ? `. Nota: ${j.note.slice(0, 120)}` : ''}`
    })),
    '',
    ...rows('Cotizaciones sin cerrar', open.map((q) => `#${q.number} ${q.title} — ${who(q.contactId)}: ${money(q.totalCents)}, ${STATE_TEXT[quoteState(q, today)] ?? ''} hasta ${q.validUntil}`)),
    '',
    `Pagos del taller este mes: se esperan ${money(fixed.expectedCents)}, pagado ${money(fixed.paidCents)}, falta ${money(fixed.remainingCents)}.`,
    ...rows('Pagos del taller', fixed.rows.filter((r) => r.state !== 'no-toca').map((r) => `${r.payment.name}: ${money(r.payment.amountCents)}, ${r.state}${r.state !== 'pagado' ? `, falta ${money(r.remainingCents)}` : ''}`)),
    '',
    ...rows('Material del taller por comprar', low.map((m) => `${m.name}: quedan ${m.stock} ${m.unit} (mínimo ${m.min})`)),
    `Pedidos pendientes: ${orders.filter((o) => o.status === 'pending').length}. Productos del inventario por reabastecer: ${restock.length}.`,
  ].join('\n')
}
