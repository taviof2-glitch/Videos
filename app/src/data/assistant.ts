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
import { moreContext } from './assistantMore'
import { listProducts } from './products'
import { listQuotes, quoteState } from './quotes'
import { addPayment } from './debts'
import { listCategories } from './categories'
import { createContact } from './contacts'
import { createProduct } from './products'
import { createSale } from './transactions'
import { startJob } from './jobs'
import type { Business, Contact, PaymentMethod, Product, Transaction } from './types'

const MAX_ROWS = 15
const STATE_TEXT: Record<string, string> = { pending: 'vigente', expiring: 'por vencer', expired: 'vencida' }

/** Lista corta: si hay más renglones de los que caben, lo dice. */
function rows(title: string, items: string[]): string[] {
  if (!items.length) return [`${title}: ninguno.`]
  const more = items.length > MAX_ROWS ? [`  (y ${items.length - MAX_ROWS} más que no caben aquí)`] : []
  return [`${title} (${items.length}):`, ...items.slice(0, MAX_ROWS).map((i) => `  - ${i}`), ...more]
}

/**
 * Para gastar menos: de clientes, proveedores y productos solo van los que se mencionan en la conversación
 * (por alguna palabra de su nombre) y los más recientes; el resto se cuenta pero no se manda.
 */
export function relevant<T extends { name: string; updatedAt?: string }>(list: T[], query: string, recent = RECENT): { shown: T[]; more: number } {
  const q = ` ${norm(query)} `
  const hit = (n: string) => norm(n).split(/[^a-z0-9]+/).some((w) => w.length >= 3 && q.includes(w))
  const mentioned = query ? list.filter((x) => hit(x.name)) : []
  const latest = [...list].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).filter((x) => !mentioned.includes(x)).slice(0, Math.max(0, recent - mentioned.length))
  const shown = [...mentioned.slice(0, LIST_MAX), ...latest]
  return { shown, more: list.length - shown.length }
}
const RECENT = 15

/** `query`: lo que se ha dicho en la conversación, para mandar solo los clientes y productos que vienen al caso. */
export async function businessContext(business: Business, today: string, query = ''): Promise<string> {
  const money = (c: number) => formatMoney(c, business.currency)
  const tz = business.timezone
  const lastMonth = addDays(monthStart(today), -1)
  const [day, month, prev, receivable, payable, jobs, quotes, fixed, orders, restock, customers, products, suppliers, categories] = await Promise.all([
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
    listProducts(business.id),
    listContacts(business.id, 'supplier'),
    listCategories(business.id, 'expense'),
  ])
  const name = new Map(customers.map((c) => [c.id, c.name]))
  const who = (id: string) => name.get(id) ?? 'cliente sin nombre'
  const bal = (label: string, b: typeof day) => `${label}: cobrado ${money(b.incomeCents)} (${b.salesCount} ventas registradas, contando las de crédito), gastos pagados ${money(b.expenseCents)} (${b.expenseCount} gastos), balance ${money(b.profitCents)}.`
  const debt = (d: (typeof receivable)['debtors'][number]) => `${d.contact.name}: ${money(d.balanceCents)}${d.overdueCents ? ` (vencido ${money(d.overdueCents)})` : ''}${d.nextDue ? `, fecha límite ${d.nextDue}` : ''}`
  const active = jobs.filter((x) => x.job.stage !== 'liquidado')
  const open = quotes.filter((q) => q.status === 'pending' && !q.job)
  const low = listMaterials(business).filter(isLow)
  const more = await moreContext(business, today, { jobs, quotes, orders, customers })
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
    `Productos del inventario por reabastecer: ${restock.length}.`,
    ...more,
    '',
    'Para preparar ventas (id corto entre corchetes):',
    ...(() => {
      const more = (n: number) => (n > 0 ? ` (y ${n} más que no se mencionan; si piden otro, búscalo por su nombre exacto o trátalo como nuevo)` : '')
      const c = relevant(customers, query)
      const s = relevant(suppliers, query, 8)
      const p = relevant(products, query)
      return [
        `Clientes: ${c.shown.map((x) => `${x.name} [${shortId(x.id)}]`).join('; ') || 'ninguno'}${more(c.more)}`,
        `Proveedores: ${s.shown.map((x) => `${x.name} [${shortId(x.id)}]`).join('; ') || 'ninguno'}${more(s.more)}`,
        `Categorías de gasto: ${categories.map((x) => x.name).join(', ') || 'ninguna'}`,
        `Productos: ${p.shown.map((x) => `${x.name} ${money(x.priceCents)}${x.madeToOrder ? ' sobre pedido' : ''} [${shortId(x.id)}]`).join('; ') || 'ninguno'}${more(p.more)}`,
      ]
    })(),
  ].join('\n')
}

const LIST_MAX = 100
const shortId = (id: string) => id.slice(0, 8)

/** La venta que preparó el asistente (lo que manda su herramienta proponer_venta). */
export type SaleAction = {
  type: 'venta'
  cliente: string
  cliente_id: string
  telefono: string
  productos: { nombre: string; producto_id: string; cantidad: number; precio: number; medidas: string }[]
  pago: 'contado' | 'fiado'
  metodo: 'efectivo' | 'transferencia' | 'tarjeta' | 'otro'
  anticipo: number
  encargo: boolean
}

const METHOD: Record<SaleAction['metodo'], PaymentMethod> = { efectivo: 'cash', transferencia: 'transfer', tarjeta: 'card', otro: 'other' }
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

/** Lo que se va a hacer, ya resuelto contra los datos: qué cliente y productos existen y cuáles se crean. */
export type SalePlan = {
  contact?: Contact
  newContact?: string
  lines: { product?: Product; newProduct?: { name: string; description: string }; quantity: number; priceCents: number }[]
  totalCents: number
  credit: boolean
  advanceCents: number
  method: PaymentMethod
  asJob: boolean
}

export async function planSale(business: Business, a: SaleAction): Promise<SalePlan> {
  const [customers, products] = await Promise.all([listContacts(business.id, 'customer'), listProducts(business.id)])
  const name = a.cliente.trim()
  const contact = (a.cliente_id && customers.find((c) => c.id.startsWith(a.cliente_id))) || (name ? customers.find((c) => norm(c.name) === norm(name)) : undefined)
  const lines = a.productos.filter((p) => p.cantidad > 0).map((p) => {
    const product = (p.producto_id && products.find((x) => x.id.startsWith(p.producto_id))) || products.find((x) => norm(x.name) === norm(p.nombre))
    const priceCents = Math.round(Math.max(0, p.precio) * 100)
    return product ? { product, quantity: p.cantidad, priceCents } : { newProduct: { name: p.nombre.trim() || 'Producto', description: p.medidas.trim() }, quantity: p.cantidad, priceCents }
  })
  if (!lines.length) throw new Error('La venta no trae productos.')
  const totalCents = lines.reduce((s, l) => s + Math.round(l.quantity * l.priceCents), 0)
  const credit = a.pago === 'fiado'
  if (credit && !contact && !name) throw new Error('Una venta fiada necesita cliente.')
  return {
    ...(contact ? { contact } : name ? { newContact: name } : {}),
    lines, totalCents, credit, advanceCents: credit ? Math.min(totalCents, Math.round(Math.max(0, a.anticipo) * 100)) : 0, method: METHOD[a.metodo] ?? 'cash', asJob: a.encargo,
  }
}

/** Guarda la venta ya confirmada: crea el cliente y los productos nuevos (sobre pedido), la venta, el anticipo y la obra si es encargo. */
export async function executeSale(business: Business, a: SaleAction): Promise<Transaction> {
  const plan = await planSale(business, a)
  const contact = plan.contact ?? (plan.newContact ? await createContact(business.id, 'customer', { name: plan.newContact, phone: a.telefono.replace(/[^\d+]/g, '') }) : undefined)
  const items = []
  for (const l of plan.lines) {
    const product = l.product ?? (await createProduct(business.id, { name: l.newProduct!.name, priceCents: l.priceCents, madeToOrder: true, ...(l.newProduct!.description && { description: l.newProduct!.description }) }))
    items.push({ productId: product.id, quantity: l.quantity, unitPriceCents: l.priceCents })
  }
  const sale = await createSale(business.id, { items, contactId: contact?.id, credit: plan.credit, paymentMethod: plan.method })
  if (plan.credit && plan.advanceCents > 0 && contact) await addPayment(contact.id, plan.advanceCents, { transactionId: sale.id, method: plan.method })
  if (plan.asJob) await startJob(sale.id)
  return sale
}

/** Resumen corto de la venta propuesta (queda en la conversación para que el asistente sepa qué propuso). */
export function saleSummary(a: SaleAction): string {
  return `${a.cliente || 'sin cliente'}; ${a.productos.map((p) => `${p.cantidad} × ${p.nombre}${p.medidas ? ` (${p.medidas})` : ''} a $${p.precio}`).join(', ')}; ${a.pago}${a.anticipo ? `, anticipo $${a.anticipo}` : ''}${a.encargo ? ', encargo' : ''}`
}
