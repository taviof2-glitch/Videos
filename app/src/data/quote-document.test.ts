import { beforeEach, describe, expect, it } from 'vitest'
import { createContact } from './contacts'
import { db } from './db'
import { layoutLine } from './pdf'
import { createProduct } from './products'
import { buildQuoteDoc, quoteFileName, quoteLines, quotePdf, quoteText, QUOTE_COLS } from './quote-document'
import { createQuote, getQuote, getQuoteItems } from './quotes'
import type { Business } from './types'

const B = 'negocio-1'
const business: Business = {
  id: B, name: 'Carpintería López', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City',
  phone: '33 1234 5678', address: 'Calle Reforma 123, Guadalajara', openingHours: '', createdAt: '', updatedAt: '',
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function documento(taxRate = 16, notes = 'Anticipo del 50 %. Entrega en 4 semanas.') {
  const olga = await createContact(B, 'customer', { name: 'Olga Acevedo' })
  const silla = await createProduct(B, { name: 'Silla de pino', priceCents: 85000, stock: 10 })
  const q = await createQuote(B, {
    title: 'Comedor', contactId: olga.id, validUntil: '2026-12-31', taxRate, notes,
    items: [
      { productId: silla.id, quantity: 4, unitPriceCents: 80000 },
      { name: 'Mesa de comedor a la medida en madera de parota con acabado mate y detalles tallados', quantity: 1, unitPriceCents: 450000 },
      { name: 'Instalación', unit: 'servicio', quantity: 1, unitPriceCents: 30000 },
    ],
  })
  return buildQuoteDoc({ business, quote: (await getQuote(q.id))!, items: await getQuoteItems(q.id), contact: olga })
}

describe('documento de cotización', () => {
  it('trae los datos de la cotización y del negocio', async () => {
    const d = await documento()
    expect(d).toMatchObject({ businessName: 'Carpintería López', number: 1, title: 'Comedor', customer: 'Olga Acevedo', subtotalCents: 800000, taxCents: 128000, totalCents: 928000 })
    expect(d.validLabel).toMatch(/31 dic.* 2026/)
    expect(d.lines.map((l) => l.totalCents)).toEqual([320000, 450000, 30000])
  })

  it('el texto de WhatsApp tiene artículos, IVA, total, notas y vigencia', async () => {
    const t = quoteText(await documento())
    expect(t).toContain('*Carpintería López*')
    expect(t).toContain('*Cotización #1 · Comedor*')
    expect(t).toContain('Para: Olga Acevedo')
    expect(t).toContain('4 × Silla de pino ($800.00 c/pieza) — $3,200.00')
    expect(t).toContain('1 × Instalación ($300.00 c/servicio) — $300.00')
    expect(t).toContain('Subtotal: $8,000.00')
    expect(t).toContain('IVA 16%: $1,280.00')
    expect(t).toContain('*Total: $9,280.00*')
    expect(t).toContain('Anticipo del 50 %')
    expect(t).toMatch(/válida hasta el 31 dic.* 2026/)
  })

  it('sin IVA no muestra subtotal ni IVA', async () => {
    const d = await documento(0, '')
    expect(quoteText(d)).not.toMatch(/IVA|Subtotal/)
    expect(quoteLines(d).map((l) => l.text).join('\n')).not.toMatch(/IVA|Subtotal|Notas/)
  })

  it('ninguna línea del PDF excede el ancho y los nombres largos se parten en varias líneas', async () => {
    const d = await documento()
    const lines = quoteLines(d)
    for (const l of lines) expect(layoutLine(l, QUOTE_COLS).length).toBeLessThanOrEqual(QUOTE_COLS)
    const text = lines.map((l) => l.text)
    expect(text.some((t) => t.startsWith('Mesa de comedor a la medida en madera'))).toBe(true)
    expect(text.some((t) => t.startsWith('detalles tallados') || t.includes('tallados'))).toBe(true)
    // las columnas numéricas quedan alineadas a la derecha en el mismo ancho
    const itemRows = text.filter((t) => /\$/.test(t) && t.length === 79)
    expect(itemRows.length).toBeGreaterThanOrEqual(3)
  })

  it('el PDF contiene lo importante y el nombre de archivo lleva el número', async () => {
    const d = await documento()
    const raw = Array.from(quotePdf(d), (b) => String.fromCharCode(b)).join('')
    expect(raw.startsWith('%PDF-1.4')).toBe(true)
    for (const s of ['Carpintería López', 'COTIZACIÓN #1', 'Silla de pino', '$9,280.00', 'Olga Acevedo']) expect(raw).toContain(s)
    expect(quoteFileName(d)).toBe('cotizacion-0001.pdf')
  })
})
