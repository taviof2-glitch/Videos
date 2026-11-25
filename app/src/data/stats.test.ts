import { beforeEach, describe, expect, it } from 'vitest'
import { ensureCategory } from './categories'
import { createContact } from './contacts'
import { addPayment } from './debts'
import { db } from './db'
import { createProduct } from './products'
import { reportFileName, reportLines, reportSheets } from './reports'
import { computeStats, shiftStatsAnchor, statsBuckets, statsLabel, statsRange } from './stats'
import { createExpense, createSale, voidTransaction } from './transactions'
import type { Business } from './types'
import { buildXlsx, columnName, crc32, sheetName } from './xlsx'

const B = 'negocio-1'
const MX = 'America/Mexico_City'
const business: Business = { id: B, name: 'Carpintería López', category: '', country: 'MX', currency: 'MXN', timezone: MX, phone: '', address: '', openingHours: '', createdAt: '', updatedAt: '' }

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('periodos', () => {
  it('semana de lunes a domingo, mes con sus días y año con 12 meses', () => {
    const w = statsBuckets('week', '2026-11-25')
    expect(w.map((b) => b.key)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
    expect(statsBuckets('month', '2026-02-10')).toHaveLength(28)
    expect(statsBuckets('month', '2028-02-10')).toHaveLength(29)
    expect(statsBuckets('month', '2026-12-31').at(-1)!.key).toBe('2026-12-31')
    const y = statsBuckets('year', '2026-06-15')
    expect(y.map((b) => b.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'])
    expect(y[1]).toMatchObject({ start: '2026-02-01', end: '2026-02-28' })
    expect(y[0].label).toMatch(/^ene/)
  })

  it('el rango cubre del primer al último día en la zona del negocio', () => {
    expect(statsRange('month', '2026-03-10', MX)).toEqual({ from: '2026-03-01T06:00:00.000Z', to: '2026-04-01T05:59:59.999Z' })
    expect(statsRange('year', '2026-03-10', MX)).toEqual({ from: '2026-01-01T06:00:00.000Z', to: '2027-01-01T05:59:59.999Z' })
  })

  it('navega y nombra los periodos', () => {
    expect(shiftStatsAnchor('week', '2026-11-25', -1)).toBe('2026-11-18')
    expect(shiftStatsAnchor('month', '2026-01-31', -1)).toBe('2025-12-01')
    expect(shiftStatsAnchor('year', '2026-11-25', 1)).toBe('2027-01-01')
    expect(statsLabel('year', '2026-11-25')).toBe('2026')
    expect(statsLabel('month', '2026-11-25')).toMatch(/noviembre.* 2026/)
    expect(statsLabel('week', '2026-11-25')).toMatch(/23 nov.* 29 nov.* 2026/)
  })
})

async function negocio() {
  const silla = await createProduct(B, { name: 'Silla', priceCents: 85000, costCents: 40000, stock: 100 })
  const mesa = await createProduct(B, { name: 'Mesa', priceCents: 300000, costCents: 200000, stock: 100 })
  const olga = await createContact(B, 'customer', { name: 'Olga' })
  const madera = await ensureCategory(B, 'expense', 'Materiales')
  // 1 de marzo (domingo): una venta a las 23:30 hora de México (en UTC ya es día 2)
  await createSale(B, { items: [{ productId: silla.id, quantity: 2, unitPriceCents: 85000 }], paymentMethod: 'cash', date: '2026-03-02T05:30:00.000Z' })
  // 2 de marzo: venta con mesa y descuento, por transferencia
  await createSale(B, { items: [{ productId: mesa.id, quantity: 1, unitPriceCents: 300000, discountCents: 20000 }, { productId: silla.id, quantity: 4, unitPriceCents: 80000 }], paymentMethod: 'transfer', date: '2026-03-02T18:00:00.000Z' })
  // 10 de marzo: venta rápida fiada y abono en efectivo
  await createSale(B, { amountCents: 50000, concept: 'Reparación', contactId: olga.id, credit: true, date: '2026-03-10T18:00:00.000Z' })
  await addPayment(olga.id, 20000, { method: 'cash', date: '2026-03-11T18:00:00.000Z' })
  // venta borrada: no cuenta
  const borrada = await createSale(B, { amountCents: 999999, date: '2026-03-05T18:00:00.000Z' })
  await voidTransaction(borrada.id)
  // gastos
  await createExpense(B, { amountCents: 100000, categoryId: madera.id, date: '2026-03-03T18:00:00.000Z' })
  await createExpense(B, { amountCents: 30000, date: '2026-03-04T18:00:00.000Z' })
  // abril: fuera del mes
  await createSale(B, { amountCents: 7000, date: '2026-04-02T18:00:00.000Z' })
  return { silla, mesa }
}

describe('estadísticas del periodo', () => {
  it('ventas registradas, ticket promedio, caja y ganancia de productos', async () => {
    await negocio()
    const s = await computeStats(B, 'month', '2026-03-15', MX)
    expect(s.salesCount).toBe(3)
    expect(s.salesCents).toBe(170000 + (280000 + 320000) + 50000) // 820000
    expect(s.avgTicketCents).toBe(Math.round(820000 / 3))
    // caja: contado 170000 + 600000 + abono 20000; egresos 130000
    expect(s.cash).toMatchObject({ incomeCents: 790000, expenseCents: 130000, profitCents: 660000 })
    // ganancia: sillas 2×(850−400)=90000; mesa 280000−200000=80000; 4 sillas 4×(800−400)=160000
    expect(s.productProfitCents).toBe(90000 + 80000 + 160000)
  })

  it('las barras usan el día del negocio (una venta a las 23:30 cae en su día)', async () => {
    await negocio()
    const s = await computeStats(B, 'month', '2026-03-15', MX)
    const day = (k: string) => s.buckets.find((b) => b.key === k)!.salesCents
    expect(day('2026-03-01')).toBe(170000)
    expect(day('2026-03-02')).toBe(600000)
    expect(day('2026-03-10')).toBe(50000)
    expect(s.buckets.reduce((sum, b) => sum + b.salesCents, 0)).toBe(s.salesCents)
    const y = await computeStats(B, 'year', '2026-03-15', MX)
    expect(y.buckets.find((b) => b.key === '2026-03')!.salesCents).toBe(820000)
    expect(y.buckets.find((b) => b.key === '2026-04')!.salesCents).toBe(7000)
  })

  it('más vendidos por importe (con descuento), con cantidad y ganancia', async () => {
    await negocio()
    const s = await computeStats(B, 'month', '2026-03-15', MX)
    expect(s.topProducts.map((p) => [p.name, p.quantity, p.revenueCents, p.profitCents])).toEqual([
      ['Silla', 6, 170000 + 320000, 90000 + 160000],
      ['Mesa', 1, 280000, 80000],
    ])
    expect((await computeStats(B, 'month', '2026-03-15', MX, 1)).topProducts).toHaveLength(1)
  })

  it('gastos por categoría con su parte del total, y cobros por método', async () => {
    await negocio()
    const s = await computeStats(B, 'month', '2026-03-15', MX)
    expect(s.expensesByCategory.map((c) => [c.name, c.totalCents, Math.round(c.share * 1000) / 1000])).toEqual([['Materiales', 100000, 0.769], ['Sin categoría', 30000, 0.231]])
    expect(s.incomeByMethod.map((m) => [m.label, m.totalCents])).toEqual([['Transferencia', 600000], ['Efectivo', 170000 + 20000]])
  })

  it('un periodo vacío da ceros y listas vacías', async () => {
    const s = await computeStats(B, 'week', '2026-03-15', MX)
    expect(s).toMatchObject({ salesCents: 0, salesCount: 0, avgTicketCents: 0, productProfitCents: 0, topProducts: [], expensesByCategory: [], incomeByMethod: [] })
    expect(s.buckets).toHaveLength(7)
  })
})

describe('reporte', () => {
  it('las hojas de Excel traen resumen, ventas, productos, gastos, cobros e inventario', async () => {
    await negocio()
    const stats = await computeStats(B, 'month', '2026-03-15', MX)
    const sheets = await reportSheets(business, 'month', '2026-03-15', stats)
    expect(sheets.map((s) => s.name)).toEqual(['Resumen', 'Ventas', 'Productos vendidos', 'Gastos', 'Cobros y pagos', 'Inventario'])
    const ventas = sheets[1].rows
    expect(ventas).toHaveLength(3)
    expect(ventas[0]).toEqual(['2026-03-01 23:30', expect.stringMatching(/^[0-9A-F]{8}$/), 'Silla ×2', '', 'Efectivo', 1700, 1700, 0])
    expect(ventas[2]).toEqual(['2026-03-10 12:00', expect.any(String), 'Reparación', 'Olga', 'Fiado', 500, 200, 300])
    expect(sheets[2].rows).toEqual([['Silla', 6, 4900, 2400, 2500], ['Mesa', 1, 2800, 2000, 800]])
    expect(sheets[3].rows.map((r) => [r[2], r[5]])).toEqual([['Materiales', 1000], ['', 300]])
    expect(sheets[4].rows).toEqual([['2026-03-11 12:00', 'Abono de cliente', 'Olga', 'Efectivo', 200]])
    expect(sheets[5].rows.map((r) => [r[0], r[3]])).toEqual([['Mesa', 99], ['Silla', 94]])
  })

  it('el PDF resume el periodo y cabe en 80 columnas', async () => {
    await negocio()
    const stats = await computeStats(B, 'month', '2026-03-15', MX)
    const lines = reportLines(business, 'month', '2026-03-15', stats, new Date('2026-04-01T18:00:00Z'))
    const text = lines.map((l) => l.text).join('\n')
    for (const l of lines) expect(l.text.length).toBeLessThanOrEqual(80)
    expect(text).toMatch(/REPORTE · marzo.* 2026/)
    expect(text).toMatch(/Ventas registradas \(3, ticket promedio \$2,733\.33\)\s+\$8,200\.00/)
    expect(text).toMatch(/Utilidad \(cobrado - pagado\)\s+\$6,600\.00/) // el signo − se escribe como - en el PDF
    expect(text).toMatch(/^1 mar.* 2026\s+\$1,700\.00$/m)
    expect(text).toMatch(/Silla\s+6\s+\$4,900\.00\s+\$2,500\.00/)
    expect(text).toMatch(/Materiales \(77 %\)\s+\$1,000\.00/)
    expect(reportFileName(business, 'month', '2026-03-15', 'xlsx')).toBe('reporte-carpinteria-lopez-2026-03.xlsx')
    expect(reportFileName(business, 'year', '2026-03-15', 'pdf')).toBe('reporte-carpinteria-lopez-2026.pdf')
  })
})

describe('archivo de Excel', () => {
  it('nombres de columna y de hoja válidos', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
    expect(sheetName('Ventas: marzo/abril [2026]?')).toBe('Ventas  marzo abril  2026')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
  })

  it('CRC-32 correcto', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926) // valor de referencia del estándar
  })

  it('es un ZIP con las partes de un .xlsx y escapa el texto', () => {
    const bytes = buildXlsx([{ name: 'Hoja <1>', columns: [{ header: 'A & B' }, { header: 'Monto', type: 'money' }], rows: [['<b>"x"</b>', 12.5], [null, undefined]] }])
    const raw = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
    expect(raw.startsWith('PK\x03\x04')).toBe(true)
    for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) expect(raw).toContain(part)
    expect(raw).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;')
    expect(raw).toContain('A &amp; B')
    expect(raw).toContain('<c r="B2" s="2"><v>12.5</v></c>')
    expect(raw).toContain('name="Hoja &lt;1&gt;"')
    expect(raw.slice(-22, -18)).toBe('PK\x05\x06')
    const own = Array.from(buildXlsx([{ name: 'R', columns: [{ header: 'V', type: 'money' }], rows: [[{ value: 2, type: 'number' }], [3]] }]), (b) => String.fromCharCode(b)).join('')
    expect(own).toContain('<c r="A2" s="3"><v>2</v></c>') // formato propio de la celda
    expect(own).toContain('<c r="A3" s="2"><v>3</v></c>') // formato de la columna
  })
})
