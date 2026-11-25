import { listCategories } from './categories'
import { dayKey, formatDay } from './dates'
import { listPayments } from './debts'
import { db } from './db'
import { formatMoney } from './money'
import { METHOD_LABEL } from './methods'
import { buildPdf, LETTER_PAPER, twoColumns, wrapText, type PdfLine } from './pdf'
import { listProducts, unitCost, unitPrice } from './products'
import { formatQuantity } from './quantity'
import { rankPeople, statsLabel, type PersonTotal, type Stats, type StatsPeriod } from './stats'
import { lineNet, lineTotal } from './transactions'
import type { Business } from './types'
import { buildXlsx, type XlsxSheet } from './xlsx'

/** Fecha y hora local del negocio, en el formato que Excel ordena bien: 2026-11-24 22:40. */
function localDateTime(iso: string, timeZone: string): string {
  const time = new Date(iso).toLocaleTimeString('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${dayKey(iso, timeZone)} ${time}`
}

const pesos = (cents: number) => Math.round(cents) / 100
const folio = (id: string) => id.slice(0, 8).toUpperCase()

export const reportFileName = (business: Business, period: StatsPeriod, anchor: string, ext: 'xlsx' | 'pdf') => {
  const slug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  const when = period === 'year' ? anchor.slice(0, 4) : period === 'month' ? anchor.slice(0, 7) : period === 'day' ? `dia-${anchor}` : `semana-${anchor}`
  return `reporte-${slug(business.name) || 'houselite'}-${when}.${ext}`
}

/** Las tablas del reporte (para Excel). El inventario es el de hoy, no el del periodo. */
export async function reportSheets(business: Business, period: StatsPeriod, anchor: string, stats: Stats): Promise<XlsxSheet[]> {
  const tz = business.timezone
  const [contacts, categories, products, payments] = await Promise.all([
    db.contact.where({ businessId: business.id }).toArray(),
    listCategories(business.id, 'expense'),
    listProducts(business.id),
    listPayments(business.id, stats.range),
  ])
  const allPayments = await db.payment.where('transactionId').anyOf([...stats.sales, ...stats.expenses].map((t) => t.id)).filter((p) => !p.deletedAt).toArray()
  const paid = new Map<string, number>()
  for (const p of allPayments) paid.set(p.transactionId, (paid.get(p.transactionId) ?? 0) + p.amountCents)
  const contactName = new Map(contacts.map((c) => [c.id, c.name]))
  const catName = new Map(categories.map((c) => [c.id, c.name]))
  const productCats = new Map((await listCategories(business.id, 'product')).map((c) => [c.id, c.name]))
  // Todos los clientes y proveedores del periodo (no solo los 10 primeros de la pantalla).
  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const peopleRows = (list: PersonTotal[]) =>
    list.map((r) => [r.name, r.registered ? 'Sí' : 'No', (r.contactId && contactById.get(r.contactId)?.phone) || '', r.count, pesos(r.totalCents), Math.round(r.share * 1000) / 10])
  const customers = rankPeople(stats.sales, contactById, 'Venta al público', Infinity)
  const suppliers = rankPeople(stats.expenses, contactById, 'Sin proveedor', Infinity)
  const how = (t: (typeof stats.sales)[number]) => (t.status === 'credit' ? (t.type === 'sale' ? 'Fiado' : 'A crédito') : METHOD_LABEL[t.paymentMethod])
  const settled = (t: (typeof stats.sales)[number]) => (t.status === 'credit' ? (paid.get(t.id) ?? 0) : t.amountCents)
  const byDate = <T extends { date: string }>(rows: T[]) => [...rows].sort((a, b) => a.date.localeCompare(b.date))

  return [
    {
      name: 'Resumen',
      columns: [{ header: 'Concepto', width: 38 }, { header: 'Valor', width: 18, type: 'money' }],
      rows: [
        ['Negocio', business.name],
        ['Periodo', statsLabel(period, anchor)],
        ['Ventas registradas (incluye fiadas)', pesos(stats.salesCents)],
        ['Número de ventas', { value: stats.salesCount, type: 'number' }],
        ['Ticket promedio', pesos(stats.avgTicketCents)],
        ['Cobrado (ingresos de caja)', pesos(stats.cash.incomeCents)],
        ['Pagado (egresos de caja)', pesos(stats.cash.expenseCents)],
        ['Utilidad (cobrado − pagado)', pesos(stats.cash.profitCents)],
        ['Ganancia en ventas con productos', pesos(stats.productProfitCents)],
      ],
    },
    {
      name: 'Ventas',
      columns: [
        { header: 'Fecha', width: 17 }, { header: 'Folio', width: 10 }, { header: 'Concepto', width: 36 }, { header: 'Cliente', width: 22 },
        { header: 'Forma de pago', width: 15 }, { header: 'Total', type: 'money' }, { header: 'Cobrado', type: 'money' }, { header: 'Saldo', type: 'money' },
      ],
      rows: byDate(stats.sales).map((s) => [localDateTime(s.date, tz), folio(s.id), s.concept || 'Venta rápida', s.contactId ? contactName.get(s.contactId) : '', how(s), pesos(s.amountCents), pesos(settled(s)), pesos(s.amountCents - settled(s))]),
    },
    {
      name: 'Productos vendidos',
      columns: [{ header: 'Producto', width: 34 }, { header: 'Cantidad', type: 'number' }, { header: 'Importe', type: 'money' }, { header: 'Costo', type: 'money' }, { header: 'Ganancia', type: 'money' }],
      rows: (() => {
        const map = new Map<string, { name: string; qty: number; revenue: number; cost: number }>()
        for (const i of stats.items) {
          if (!i.productId) continue
          const k = `${i.productId}|${i.variantId ?? ''}` // una fila por variante
          const r = map.get(k) ?? { name: i.name, qty: 0, revenue: 0, cost: 0 }
          r.qty = Math.round((r.qty + i.quantity) * 1000) / 1000
          r.revenue += lineNet(i)
          r.cost += lineTotal(i.quantity, i.unitCostCents)
          map.set(k, r)
        }
        return [...map.values()].sort((a, b) => b.revenue - a.revenue).map((r) => [r.name, r.qty, pesos(r.revenue), pesos(r.cost), pesos(r.revenue - r.cost)])
      })(),
    },
    {
      name: 'Clientes',
      columns: [
        { header: 'Cliente', width: 30 }, { header: 'Registrado', width: 12 }, { header: 'Teléfono', width: 16 }, { header: 'Compras', type: 'number' },
        { header: 'Total vendido', width: 15, type: 'money' }, { header: '% de las ventas', width: 15, type: 'number' },
      ],
      rows: peopleRows(customers),
    },
    {
      name: 'Gastos',
      columns: [
        { header: 'Fecha', width: 17 }, { header: 'Concepto', width: 36 }, { header: 'Categoría', width: 20 }, { header: 'Proveedor', width: 22 },
        { header: 'Forma de pago', width: 15 }, { header: 'Total', type: 'money' }, { header: 'Pagado', type: 'money' }, { header: 'Saldo', type: 'money' },
      ],
      rows: byDate(stats.expenses).map((e) => [localDateTime(e.date, tz), e.concept || 'Gasto', e.categoryId ? (catName.get(e.categoryId) ?? '') : '', e.contactId ? contactName.get(e.contactId) : '', how(e), pesos(e.amountCents), pesos(settled(e)), pesos(e.amountCents - settled(e))]),
    },
    {
      name: 'Proveedores',
      columns: [
        { header: 'Proveedor', width: 30 }, { header: 'Registrado', width: 12 }, { header: 'Teléfono', width: 16 }, { header: 'Gastos', type: 'number' },
        { header: 'Total gastado', width: 15, type: 'money' }, { header: '% de los gastos', width: 15, type: 'number' },
      ],
      rows: peopleRows(suppliers),
    },
    {
      name: 'Cobros y pagos',
      columns: [{ header: 'Fecha', width: 17 }, { header: 'Tipo', width: 18 }, { header: 'Contacto', width: 24 }, { header: 'Método', width: 15 }, { header: 'Monto', type: 'money' }],
      rows: byDate(payments).map((p) => [localDateTime(p.date, tz), p.direction === 'in' ? 'Abono de cliente' : 'Pago a proveedor', contactName.get(p.contactId) ?? '', METHOD_LABEL[p.method], pesos(p.amountCents)]),
    },
    {
      name: 'Inventario',
      columns: [
        { header: 'Producto', width: 34 }, { header: 'Código', width: 16 }, { header: 'Categoría', width: 18 }, { header: 'Existencias', type: 'number' },
        { header: 'Mínimo', type: 'number' }, { header: 'Costo', type: 'money' }, { header: 'Precio', type: 'money' }, { header: 'Valor a costo', width: 15, type: 'money' },
      ],
      rows: products.flatMap((p) => {
        const cat = p.categoryId ? (productCats.get(p.categoryId) ?? '') : ''
        if (!p.variants?.length) return [[p.name, p.barcode, cat, p.stock, p.minStock, pesos(p.costCents), pesos(p.priceCents), pesos(Math.round(Math.max(p.stock, 0) * p.costCents))]]
        return p.variants.map((v) => [`${p.name} (${v.name})`, v.barcode, cat, v.stock, v.minStock, pesos(unitCost(p, v)), pesos(unitPrice(p, v)), pesos(Math.round(Math.max(v.stock, 0) * unitCost(p, v)))])
      }),
    },
  ]
}

export async function reportXlsx(business: Business, period: StatsPeriod, anchor: string, stats: Stats): Promise<Uint8Array> {
  return buildXlsx(await reportSheets(business, period, anchor, stats))
}

const COLS = 80

/** «Ana (registrado) · 2 compras» a la izquierda y el importe a la derecha. */
const personLine = (p: PersonTotal, noun: string, money: (c: number) => string): PdfLine => ({
  text: twoColumns(`${p.name} (${p.registered ? 'registrado' : 'sin registrar'}) · ${p.count} ${noun}${p.count === 1 ? '' : 's'}`, money(p.totalCents), COLS),
})
const SEP: PdfLine = { text: '-'.repeat(COLS) }

/** Reporte en PDF (hoja carta): resumen, ventas por periodo, más vendidos, gastos por categoría y cobros por método. */
export function reportLines(business: Business, period: StatsPeriod, anchor: string, stats: Stats, now = new Date()): PdfLine[] {
  const money = (c: number) => formatMoney(c, business.currency)
  const row = (a: string, b: string, c = '', d = '') => a.slice(0, 38).padEnd(38) + ' ' + b.padStart(12) + ' ' + c.padStart(13) + ' ' + d.padStart(14)
  const lines: PdfLine[] = [
    ...wrapText(business.name, COLS).map((t): PdfLine => ({ text: t, bold: true })),
    { text: `REPORTE · ${statsLabel(period, anchor)}`, bold: true },
    { text: `Generado el ${now.toLocaleString('es-MX', { timeZone: business.timezone, dateStyle: 'medium', timeStyle: 'short' })}` },
    SEP,
    { text: 'RESUMEN', bold: true },
    { text: twoColumns(`Ventas registradas (${stats.salesCount}, ticket promedio ${money(stats.avgTicketCents)})`, money(stats.salesCents), COLS) },
    { text: twoColumns('Cobrado (ingresos)', money(stats.cash.incomeCents), COLS) },
    { text: twoColumns('Pagado (egresos)', money(stats.cash.expenseCents), COLS) },
    { text: twoColumns('Utilidad (cobrado − pagado)', money(stats.cash.profitCents), COLS), bold: true },
    { text: twoColumns('Ganancia en ventas con productos', money(stats.productProfitCents), COLS) },
    SEP,
    { text: period === 'year' ? 'VENTAS POR MES' : period === 'day' ? 'VENTAS POR HORA' : 'VENTAS POR DÍA', bold: true },
  ]
  const withSales = stats.buckets.filter((b) => b.salesCents > 0)
  if (withSales.length === 0) lines.push({ text: 'Sin ventas en este periodo.' })
  for (const b of withSales) lines.push({ text: twoColumns(period === 'year' ? `${b.label} ${b.start.slice(0, 4)}` : period === 'day' ? `${b.label}` : formatDay(b.start), money(b.salesCents), COLS) })
  lines.push(SEP, { text: 'PRODUCTOS MÁS VENDIDOS', bold: true })
  if (stats.topProducts.length === 0) lines.push({ text: 'Sin ventas de productos del inventario.' })
  else {
    lines.push({ text: row('Producto', 'Cantidad', 'Importe', 'Ganancia'), bold: true })
    for (const p of stats.topProducts) lines.push({ text: row(p.name, formatQuantity(p.quantity), money(p.revenueCents), money(p.profitCents)) })
  }
  lines.push(SEP, { text: 'CLIENTES QUE MÁS COMPRARON', bold: true })
  if (stats.topCustomers.length === 0) lines.push({ text: 'Sin ventas en este periodo.' })
  for (const c of stats.topCustomers) lines.push(personLine(c, 'compra', money))
  lines.push(SEP, { text: 'GASTOS POR CATEGORÍA', bold: true })
  if (stats.expensesByCategory.length === 0) lines.push({ text: 'Sin gastos en este periodo.' })
  for (const c of stats.expensesByCategory) lines.push({ text: twoColumns(`${c.name} (${Math.round(c.share * 100)} %)`, money(c.totalCents), COLS) })
  lines.push(SEP, { text: 'PROVEEDORES A QUIENES MÁS SE PAGÓ', bold: true })
  if (stats.topSuppliers.length === 0) lines.push({ text: 'Sin gastos en este periodo.' })
  for (const s of stats.topSuppliers) lines.push(personLine(s, 'gasto', money))
  lines.push(SEP, { text: 'COBRADO POR MÉTODO', bold: true })
  if (stats.incomeByMethod.length === 0) lines.push({ text: 'Sin cobros en este periodo.' })
  for (const m of stats.incomeByMethod) lines.push({ text: twoColumns(m.label, money(m.totalCents), COLS) })
  return lines
}

export const reportPdf = (business: Business, period: StatsPeriod, anchor: string, stats: Stats): Uint8Array =>
  buildPdf(reportLines(business, period, anchor, stats), COLS, LETTER_PAPER)
