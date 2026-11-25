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
    expect(d.lines.map((l) => l.grossCents)).toEqual([320000, 450000, 30000])
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
    const itemRows = text.filter((t) => /\$/.test(t) && t.length === QUOTE_COLS)
    expect(itemRows.length).toBeGreaterThanOrEqual(3)
  })

  it('el PDF contiene lo importante y el nombre de archivo lleva el número', async () => {
    const d = await documento()
    const raw = Array.from(quotePdf(d), (b) => String.fromCharCode(b)).join('')
    expect(raw.startsWith('%PDF-1.4')).toBe(true)
    for (const s of ['Carpintería López', 'COTIZACIÓN #1', 'Silla de pino', '$9,280.00', 'Olga Acevedo']) expect(raw).toContain(s)
    expect(quoteFileName(d)).toBe('cotizacion-0001.pdf')
  })

  it('muestra descuentos, medidas, anticipo, saldo y fecha estimada de pago', async () => {
    const olga = await createContact(B, 'customer', { name: 'Olga' })
    const q = await createQuote(B, {
      title: 'Puertas', contactId: olga.id, validUntil: '2026-12-31', taxRate: 16, advanceCents: 200000, payBy: '2027-01-15',
      items: [
        { name: 'Puerta de parota', quantity: 3, unitPriceCents: 80000, width: 0.9, height: 2, discount: { type: 'percent', value: 10 } },
        { name: 'Instalación', quantity: 1, unitPriceCents: 30000, discount: { type: 'amount', value: 5000 } },
      ],
    })
    const d = buildQuoteDoc({ business, quote: (await getQuote(q.id))!, items: await getQuoteItems(q.id), contact: olga })
    // puertas 432000 − 43200; instalación 30000 − 5000 → subtotal 413800; IVA 66208; total 480008
    expect(d).toMatchObject({ grossCents: 462000, discountCents: 48200, subtotalCents: 413800, taxCents: 66208, totalCents: 480008, advanceCents: 200000 })
    expect(d.payByLabel).toMatch(/15 ene.* 2027/)
    const pdf = quoteLines(d).map((l) => l.text).join('\n')
    expect(pdf).toMatch(/^  3 pza de 0\.9 × 2 m$/m) // con sangría
    expect(pdf).toMatch(/Descuento 10%\s+-\$432\.00/)
    expect(pdf).toMatch(/Descuento\s+-\$50\.00/)
    expect(pdf).toMatch(/^Importe\s+\$4,620\.00$/m)
    expect(pdf).toMatch(/Descuentos\s+-\$482\.00/)
    expect(pdf).toMatch(/Subtotal\s+\$4,138\.00/)
    expect(pdf).toMatch(/TOTAL\s+\$4,800\.08/)
    expect(pdf).toMatch(/Anticipo\s+\$2,000\.00/)
    expect(pdf).toMatch(/Saldo\s+\$2,800\.08/)
    expect(pdf).toMatch(/Fecha estimada de pago: 15 ene.* 2027/)
    const t = quoteText(d)
    expect(t).toContain('Descuento 10%: -$432.00')
    expect(t).toContain('Anticipo: $2,000.00')
    expect(t).toContain('Saldo: $2,800.08')
    expect(t).toMatch(/Fecha estimada de pago: 15 ene.* 2027/)
    expect(t).toContain('[3 pza de 0.9 × 2 m]')
  })

  it('sin descuentos ni anticipo no aparecen esas líneas', async () => {
    const d = await documento(16, '')
    const pdf = quoteLines(d).map((l) => l.text).join('\n')
    expect(pdf).not.toMatch(/Descuento|Anticipo|Saldo|Fecha estimada|^Importe\s+\$/m)
  })

  it('el PDF es de hoja carta y pagina las cotizaciones largas', async () => {
    const olga = await createContact(B, 'customer', { name: 'Olga' })
    const items = Array.from({ length: 60 }, (_, i) => ({ name: `Artículo número ${i + 1}`, quantity: 1, unitPriceCents: 1000 }))
    const q = await createQuote(B, { contactId: olga.id, validUntil: '2026-12-31', items })
    const d = buildQuoteDoc({ business, quote: (await getQuote(q.id))!, items: await getQuoteItems(q.id), contact: olga })
    const raw = Array.from(quotePdf(d), (b) => String.fromCharCode(b)).join('')
    expect(raw).toContain('/MediaBox [0 0 612 792]')
    expect(Number(/\/Count (\d+)/.exec(raw)![1])).toBeGreaterThanOrEqual(2)
    expect(raw).toContain('(Página 1 de ')
    const corta = Array.from(quotePdf(await documento()), (b) => String.fromCharCode(b)).join('')
    expect(corta).toContain('/Count 1 ')
    expect(corta).not.toContain('Página 1 de')
  })
})
