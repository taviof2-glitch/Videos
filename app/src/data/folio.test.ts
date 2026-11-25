import { beforeEach, describe, expect, it } from 'vitest'
import { createContact } from './contacts'
import { db } from './db'
import { docNumber, provisionalCode } from './folio'
import { buildQuoteDoc, quoteFileName, quoteText } from './quote-document'
import { createOrder, getOrder, payOrder } from './orders'
import { createProduct } from './products'
import { convertQuote, createQuote, getQuote, getQuoteItems } from './quotes'
import { linkKey } from '../sync/tables'
import type { Business } from './types'

const B = 'negocio-1'
const business: Business = { id: B, name: 'Taller', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', phone: '', address: '', openingHours: '', catalogNote: '', createdAt: '', updatedAt: '' }
const link = (businessId = B) => db.syncState.put({ key: linkKey(businessId), value: { businessId, userId: 'u', email: 'a@b.c' } })

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function quote() {
  const c = await createContact(B, 'customer', { name: 'Ana' })
  return createQuote(B, { contactId: c.id, title: 'Cocina', validUntil: '2099-12-31', items: [{ name: 'Puerta', quantity: 1, unitPriceCents: 1000 }] })
}

describe('folios provisionales', () => {
  it('sin cuenta conectada el número es definitivo, como siempre', async () => {
    const q = await quote()
    expect(q.number).toBe(1)
    expect(q.numberPending).toBeUndefined()
    expect(docNumber(q)).toBe('#1')
  })

  it('con la cuenta conectada, cotizaciones y pedidos nacen con número provisional', async () => {
    await link()
    const q = await quote()
    expect(q.numberPending).toBe(true)
    expect(docNumber(q)).toBe(provisionalCode(q.id))
    expect(docNumber(q)).toMatch(/^P-[0-9A-F]{6}$/)
    expect((await getQuote(q.id))?.numberPending).toBe(true)
    const p = await createProduct(B, { name: 'Repisa', priceCents: 500, stock: 5 })
    const o = await createOrder(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 500 }] })
    expect(o.numberPending).toBe(true)
    // El número local sigue sirviendo para ordenar la lista hasta que llegue el definitivo.
    expect((await createOrder(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 500 }] })).number).toBe(o.number + 1)
  })

  it('una cuenta conectada a otro negocio no marca provisional', async () => {
    await link('otro')
    expect((await quote()).numberPending).toBeUndefined()
  })

  it('el PDF y el nombre del archivo llevan el código provisional', async () => {
    await link()
    const q = await quote()
    const d = buildQuoteDoc({ business, quote: q, items: await getQuoteItems(q.id) })
    expect(quoteText(d)).toContain(`Cotización ${provisionalCode(q.id)}`)
    expect(quoteFileName(d)).toBe(`cotizacion-${provisionalCode(q.id)}.pdf`)
    const def = buildQuoteDoc({ business, quote: { ...q, numberPending: undefined, number: 8 }, items: [] })
    expect(quoteFileName(def)).toBe('cotizacion-0008.pdf')
  })

  it('el concepto de la venta usa el folio visible', async () => {
    await link()
    const q = await quote()
    const { sale: t } = await convertQuote(q.id)
    expect(t.concept).toContain(provisionalCode(q.id))
    const p = await createProduct(B, { name: 'Repisa', priceCents: 500, stock: 5 })
    const o = await createOrder(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 500 }] })
    const { sale: paid } = await payOrder(o.id)
    expect((await getOrder(o.id))?.status).toBe('paid')
    expect(paid.concept).toContain(provisionalCode(o.id))
  })
})
