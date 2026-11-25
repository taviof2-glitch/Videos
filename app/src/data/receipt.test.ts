import { beforeEach, describe, expect, it } from 'vitest'
import { createContact } from './contacts'
import { addPayment, contactDebts } from './debts'
import { db } from './db'
import { buildPdf, layoutLine, toLatin1, twoColumns, wrapText, TICKET_COLS } from './pdf'
import { createProduct } from './products'
import { buildReceipt, receiptFileName, receiptLines, receiptPdf, receiptText } from './receipt'
import { createSale, getItems, getTransaction } from './transactions'
import type { Business } from './types'

const B = 'negocio-1'
const business: Business = {
  id: B, name: 'Carpintería López', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City',
  phone: '33 1234 5678', address: 'Calle Reforma 123, Col. Centro, Guadalajara', openingHours: '', createdAt: '', updatedAt: '',
}

beforeEach(async () => {
  await Promise.all([db.txn.clear(), db.txnItem.clear(), db.product.clear(), db.stockMovement.clear(), db.payment.clear(), db.contact.clear()])
})

const pdfText = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')

describe('texto para el PDF', () => {
  it('convierte a Latin-1: conserva acentos y × y aproxima lo demás', () => {
    expect(toLatin1('Carpintería ¿Qué tal? ñ × 3')).toBe('Carpintería ¿Qué tal? ñ × 3')
    expect(toLatin1('a b c\td')).toBe('a b c d')
    expect(toLatin1('Hola – “mundo”… €5')).toBe('Hola - "mundo"... EUR5')
    expect(toLatin1('Ā ā 😀 日本')).toBe('A a ? ??')
  })

  it('ajusta líneas sin cortar palabras y parte las que no caben', () => {
    expect(wrapText('uno dos tres cuatro', 9)).toEqual(['uno dos', 'tres', 'cuatro'])
    expect(wrapText('x'.repeat(25), 10)).toEqual(['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)])
    expect(wrapText('', 10)).toEqual([''])
    for (const l of wrapText('Calle Reforma 123, Col. Centro, Guadalajara, Jalisco, México', 20)) expect(l.length).toBeLessThanOrEqual(20)
  })

  it('alinea y arma dos columnas del ancho exacto', () => {
    expect(layoutLine({ text: 'hola', align: 'center' }, 10)).toBe('   hola')
    expect(layoutLine({ text: 'hola', align: 'right' }, 10)).toBe('      hola')
    expect(twoColumns('TOTAL', '$10.00', 20)).toBe('TOTAL' + ' '.repeat(9) + '$10.00')
    expect(twoColumns('TOTAL', '$10.00', 20)).toHaveLength(20)
    expect(twoColumns('un concepto larguísimo', '$10.00', 20).length).toBeLessThanOrEqual(20)
  })
})

describe('archivo PDF', () => {
  it('tiene una estructura válida: cabecera, desfases del xref, longitud del flujo y final', () => {
    const raw = pdfText(buildPdf([{ text: 'Hola' }, { text: 'Total (con \\ y paréntesis)', bold: true }]))
    expect(raw.startsWith('%PDF-1.4\n')).toBe(true)
    expect(raw.endsWith('%%EOF\n')).toBe(true)
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(raw)![1])
    expect(raw.slice(startxref, startxref + 4)).toBe('xref')
    const entries = [...raw.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    expect(entries).toHaveLength(6)
    entries.forEach((off, i) => expect(raw.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
    const stream = /<< \/Length (\d+) >>\nstream\n([\s\S]*)\nendstream/.exec(raw)!
    expect(stream[2]).toHaveLength(Number(stream[1]))
    expect(stream[2]).toContain('(Total \\(con \\\\ y paréntesis\\)) Tj')
    expect(raw).toContain('/BaseFont /Courier-Bold')
  })

  it('la página crece con el número de líneas', () => {
    const height = (n: number) => Number(/MediaBox \[0 0 [\d.]+ ([\d.]+)\]/.exec(pdfText(buildPdf(Array.from({ length: n }, () => ({ text: 'x' })))))![1])
    expect(height(60)).toBeGreaterThan(height(30))
    expect(height(1)).toBe(200)
  })
})

describe('comprobante', () => {
  async function venta() {
    const silla = await createProduct(B, { name: 'Silla de pino', priceCents: 85000, costCents: 40000, stock: 10 })
    const olga = await createContact(B, 'customer', { name: 'Olga Acevedo', phone: '33 9999 0000' })
    const sale = await createSale(B, {
      items: [{ productId: silla.id, quantity: 3, unitPriceCents: 80000 }, { name: 'Instalación a domicilio en zona norte', quantity: 1, unitPriceCents: 30000 }],
      contactId: olga.id, paymentMethod: 'transfer', date: '2026-03-02T05:30:00.000Z',
    })
    return { sale, olga }
  }

  it('arma el comprobante con los datos de la venta y la zona horaria del negocio', async () => {
    const { sale, olga } = await venta()
    const r = buildReceipt({ business, sale: (await getTransaction(sale.id))!, items: await getItems(sale.id), contact: olga })
    expect(r).toMatchObject({ businessName: 'Carpintería López', folio: sale.id.slice(0, 8).toUpperCase(), customer: 'Olga Acevedo', totalCents: 270000, payment: 'Transferencia', currency: 'MXN' })
    expect(r.lines.map((l) => [l.name, l.quantity, l.totalCents])).toEqual([['Silla de pino', 3, 240000], ['Instalación a domicilio en zona norte', 1, 30000]])
    expect(r.dateLabel).toMatch(/1 mar.* 2026/) // 23:30 del 1 de marzo en México, aunque en UTC ya sea día 2
    expect(r.credit).toBeUndefined()
  })

  it('el texto de WhatsApp incluye negocio, líneas, total y forma de pago', async () => {
    const { sale, olga } = await venta()
    const text = receiptText(buildReceipt({ business, sale, items: await getItems(sale.id), contact: olga }))
    expect(text).toContain('*Carpintería López*')
    expect(text).toContain('3 × Silla de pino — $2,400.00')
    expect(text).toContain('*Total: $2,700.00*')
    expect(text).toContain('Pago: Transferencia')
    expect(text).toContain('Cliente: Olga Acevedo')
  })

  it('una venta fiada muestra lo abonado y el saldo', async () => {
    const olga = await createContact(B, 'customer', { name: 'Olga' })
    const sale = await createSale(B, { amountCents: 100000, contactId: olga.id, credit: true, dueDate: '2026-07-01' })
    await addPayment(olga.id, 25000)
    const paid = (await contactDebts(olga.id))[0].paidCents
    const r = buildReceipt({ business, sale: (await getTransaction(sale.id))!, items: [], contact: olga, paidCents: paid })
    expect(r.credit).toMatchObject({ paidCents: 25000, remainingCents: 75000 })
    const text = receiptText(r)
    expect(text).toContain('Abonado: $250.00')
    expect(text).toContain('Saldo pendiente: $750.00')
    expect(text).toMatch(/Fecha límite: 1 jul.* 2026/)
    expect(receiptLines(r).map((l) => l.text).join('\n')).toContain('Saldo pendiente')
  })

  it('una venta rápida muestra el concepto en lugar de líneas', async () => {
    const sale = await createSale(B, { amountCents: 25000, concept: 'Barnizado de mesa' })
    const r = buildReceipt({ business, sale, items: [] })
    expect(r.lines).toHaveLength(0)
    expect(receiptText(r)).toContain('Barnizado de mesa')
    expect(receiptLines(r).map((l) => l.text)).toContain('Barnizado de mesa')
  })

  it('ninguna línea del ticket excede el ancho y el PDF contiene lo importante', async () => {
    const { sale, olga } = await venta()
    const r = buildReceipt({ business, sale, items: await getItems(sale.id), contact: olga })
    for (const l of receiptLines(r)) expect(layoutLine(l).length).toBeLessThanOrEqual(TICKET_COLS)
    const pdf = pdfText(receiptPdf(r))
    for (const s of ['Carpintería López', 'COMPROBANTE DE VENTA', 'Silla de pino', '$2,700.00', 'Transferencia']) expect(pdf).toContain(s)
    expect(receiptFileName(r)).toMatch(/^comprobante-[0-9A-F]{8}\.pdf$/)
  })
})
