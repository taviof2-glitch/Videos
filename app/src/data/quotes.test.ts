import { beforeEach, describe, expect, it } from 'vitest'
import { createContact, deleteContact } from './contacts'
import { contactBalance, contactDebts } from './debts'
import { db } from './db'
import { createProduct, deleteProduct, getProduct, stockFromMovements } from './products'
import {
  convertQuote, createQuote, deleteQuote, getQuote, getQuoteItems, listQuotes, needsAttention, quoteState, quoteTotals, setQuoteStatus, updateQuote,
} from './quotes'
import { getItems, saleProfit } from './transactions'

const B = 'negocio-1'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const cliente = (name = 'Olga') => createContact(B, 'customer', { name, phone: '33 1234 5678' })
async function setup() {
  const c = await cliente()
  const silla = await createProduct(B, { name: 'Silla de pino', priceCents: 85000, costCents: 40000, stock: 10 })
  return { c, silla }
}
const free = (name: string, quantity: number, unitPriceCents: number, unit?: string) => ({ name, quantity, unitPriceCents, unit })

describe('totales', () => {
  it('suma las líneas y calcula el IVA una sola vez sobre el subtotal', () => {
    expect(quoteTotals([{ quantity: 2, unitPriceCents: 10000 }], 16)).toEqual({ subtotalCents: 20000, taxCents: 3200, totalCents: 23200 })
    expect(quoteTotals([{ quantity: 3, unitPriceCents: 3333 }, { quantity: 1, unitPriceCents: 1 }], 0)).toEqual({ subtotalCents: 10000, taxCents: 0, totalCents: 10000 })
    // 3 × $0.33 + 3 × $0.33 al 16 %: un solo redondeo del IVA sobre 198 centavos = 31.68 → 32
    expect(quoteTotals([{ quantity: 3, unitPriceCents: 33 }, { quantity: 3, unitPriceCents: 33 }], 16).taxCents).toBe(32)
    expect(quoteTotals([{ quantity: 1, unitPriceCents: 10000 }], 8.5).taxCents).toBe(850)
    expect(quoteTotals([{ quantity: 2.5, unitPriceCents: 3333 }], 0).subtotalCents).toBe(8333)
  })
})

describe('crear y editar', () => {
  it('numera consecutivamente por negocio y no reutiliza números', async () => {
    const { c } = await setup()
    const otro = await createContact('otro', 'customer', { name: 'Ajeno' })
    const base = { contactId: c.id, validUntil: '2026-12-31', items: [free('Mesa', 1, 1000)] }
    const a = await createQuote(B, base)
    const b = await createQuote(B, base)
    await deleteQuote(b.id)
    const c3 = await createQuote(B, base)
    const ajena = await createQuote('otro', { ...base, contactId: otro.id })
    expect([a.number, b.number, c3.number, ajena.number]).toEqual([1, 2, 3, 1])
  })

  it('guarda artículos por pieza con unidad, precio congelado y totales', async () => {
    const { c, silla } = await setup()
    const q = await createQuote(B, {
      title: ' Cocina integral ', contactId: c.id, validUntil: '2026-12-31', taxRate: 16, notes: ' Anticipo del 50 % ',
      items: [{ productId: silla.id, quantity: 4, unitPriceCents: 80000 }, free('Instalación', 1, 30000, 'servicio')],
    })
    expect(q).toMatchObject({ title: 'Cocina integral', status: 'pending', taxRate: 16, subtotalCents: 350000, taxCents: 56000, totalCents: 406000, notes: 'Anticipo del 50 %' })
    expect((await getQuoteItems(q.id)).map((i) => [i.name, i.unit, i.quantity, i.unitPriceCents])).toEqual([
      ['Silla de pino', 'pieza', 4, 80000], ['Instalación', 'servicio', 1, 30000],
    ])
    expect((await getProduct(silla.id))!.stock).toBe(10) // cotizar no mueve stock
  })

  it('valida cliente, artículos, cantidades, precios, vigencia e IVA sin guardar nada a medias', async () => {
    const { c } = await setup()
    const ok = { contactId: c.id, validUntil: '2026-12-31', items: [free('Mesa', 1, 1000)] }
    await expect(createQuote(B, { ...ok, contactId: 'nope' })).rejects.toThrow(/cliente/)
    const prov = await createContact(B, 'supplier', { name: 'Proveedor' })
    await expect(createQuote(B, { ...ok, contactId: prov.id })).rejects.toThrow(/cliente/)
    await expect(createQuote(B, { ...ok, items: [] })).rejects.toThrow(/al menos un artículo/)
    await expect(createQuote(B, { ...ok, items: [free('', 1, 1)] })).rejects.toThrow(/nombre/)
    await expect(createQuote(B, { ...ok, items: [free('X', 0, 1)] })).rejects.toThrow(/cantidad/)
    await expect(createQuote(B, { ...ok, items: [free('X', 1, -1)] })).rejects.toThrow(/precio/)
    await expect(createQuote(B, { ...ok, items: [{ productId: 'nope', quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/ya no existe/)
    for (const validUntil of ['2026-02-31', '2026-13-01', 'mañana', '']) await expect(createQuote(B, { ...ok, validUntil })).rejects.toThrow(/vigencia/)
    for (const taxRate of [-1, 101, NaN]) await expect(createQuote(B, { ...ok, taxRate })).rejects.toThrow(/IVA/)
    expect(await db.quote.count()).toBe(0)
    expect(await db.quoteItem.count()).toBe(0)
  })

  it('editar reemplaza los artículos y recalcula; conserva número y estado', async () => {
    const { c } = await setup()
    const q = await createQuote(B, { contactId: c.id, validUntil: '2026-12-31', items: [free('Mesa', 1, 100000), free('Silla', 4, 20000)] })
    await setQuoteStatus(q.id, 'accepted')
    const u = await updateQuote(q.id, { title: 'Comedor', contactId: c.id, validUntil: '2027-01-15', taxRate: 16, items: [free('Silla', 6, 20000)] })
    expect(u).toMatchObject({ number: 1, status: 'accepted', title: 'Comedor', validUntil: '2027-01-15', subtotalCents: 120000, taxCents: 19200, totalCents: 139200 })
    expect((await getQuoteItems(q.id)).map((i) => i.name)).toEqual(['Silla'])
    await expect(updateQuote(q.id, { contactId: c.id, validUntil: '2027-01-15', items: [free('X', 1, 1), { productId: 'nope', quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow()
    expect((await getQuoteItems(q.id)).map((i) => i.name)).toEqual(['Silla']) // el error no deja nada a medias
  })

  it('el orden de los artículos se conserva', async () => {
    const { c } = await setup()
    const names = ['Zeta', 'Alfa', 'Mu', 'Beta', 'Omega', 'Pi']
    const q = await createQuote(B, { contactId: c.id, validUntil: '2026-12-31', items: names.map((n) => free(n, 1, 100)) })
    expect((await getQuoteItems(q.id)).map((i) => i.name)).toEqual(names)
  })

  it('un producto archivado después de cotizar se puede conservar al editar', async () => {
    const { c, silla } = await setup()
    const q = await createQuote(B, { contactId: c.id, validUntil: '2026-12-31', items: [{ productId: silla.id, quantity: 1, unitPriceCents: 100 }] })
    await deleteProduct(silla.id)
    await expect(updateQuote(q.id, { contactId: c.id, validUntil: '2026-12-31', items: [{ productId: silla.id, quantity: 2, unitPriceCents: 100 }] })).resolves.toBeTruthy()
    await expect(createQuote(B, { contactId: c.id, validUntil: '2026-12-31', items: [{ productId: silla.id, quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/ya no existe/)
  })
})

describe('estados y vigencia', () => {
  it('pendiente → por vencer → vencida según la fecha; los demás estados no vencen', () => {
    const q = (status: 'pending' | 'accepted' | 'rejected' | 'converted', validUntil: string) => ({ status, validUntil })
    expect(quoteState(q('pending', '2026-06-20'), '2026-06-10')).toBe('pending')
    expect(quoteState(q('pending', '2026-06-13'), '2026-06-10')).toBe('expiring') // 3 días
    expect(quoteState(q('pending', '2026-06-10'), '2026-06-10')).toBe('expiring') // vence hoy: aún vale
    expect(quoteState(q('pending', '2026-06-09'), '2026-06-10')).toBe('expired')
    expect(quoteState(q('accepted', '2026-01-01'), '2026-06-10')).toBe('accepted')
    expect(quoteState(q('rejected', '2026-01-01'), '2026-06-10')).toBe('rejected')
    expect(quoteState(q('converted', '2026-01-01'), '2026-06-10')).toBe('converted')
    expect(needsAttention(q('pending', '2026-06-12'), '2026-06-10')).toBe(true)
    expect(needsAttention(q('accepted', '2026-06-12'), '2026-06-10')).toBe(false)
  })

  it('cambia de estado, lista las más recientes primero y borra con borrado lógico', async () => {
    const { c } = await setup()
    const base = { contactId: c.id, validUntil: '2026-12-31', items: [free('Mesa', 1, 1000)] }
    const a = await createQuote(B, base)
    const b = await createQuote(B, base)
    await setQuoteStatus(a.id, 'rejected')
    expect((await getQuote(a.id))!.status).toBe('rejected')
    await setQuoteStatus(a.id, 'pending')
    expect((await listQuotes(B)).map((q) => q.number)).toEqual([2, 1])
    await deleteQuote(b.id)
    expect((await listQuotes(B)).map((q) => q.number)).toEqual([1])
    expect(await getQuote(b.id)).toBeUndefined()
    expect((await db.quote.get(b.id))!.deletedAt).toBeTruthy()
    await expect(setQuoteStatus(b.id, 'accepted')).rejects.toThrow(/no existe/)
  })
})

describe('convertir en venta', () => {
  async function cotizacion(taxRate = 16) {
    const { c, silla } = await setup()
    const q = await createQuote(B, {
      title: 'Comedor', contactId: c.id, validUntil: '2026-12-31', taxRate,
      items: [{ productId: silla.id, quantity: 4, unitPriceCents: 80000 }, free('Instalación', 1, 30000, 'servicio')],
    })
    return { c, silla, q }
  }

  it('de contado: misma suma que la cotización, descuenta stock y deja la cotización convertida', async () => {
    const { silla, q } = await cotizacion()
    const { sale, quote } = await convertQuote(q.id, { method: 'transfer' })
    expect(sale).toMatchObject({ type: 'sale', amountCents: q.totalCents, status: 'paid', paymentMethod: 'transfer', contactId: q.contactId })
    expect(sale.amountCents).toBe(406000)
    expect(sale.concept).toBe('Cotización #1 · Comedor')
    expect(quote).toMatchObject({ status: 'converted', transactionId: sale.id })
    expect((await getProduct(silla.id))!.stock).toBe(6)
    expect(await stockFromMovements(silla.id)).toBe(6)
    const items = await getItems(sale.id)
    expect(items.map((i) => [i.name, i.quantity, i.unitPriceCents])).toEqual([['Silla de pino', 4, 80000], ['Instalación', 1, 30000], ['IVA 16%', 1, 56000]])
    // el IVA no cuenta como ganancia: solo ganan las sillas y la instalación (costo 0)
    expect(saleProfit(items)).toBe(4 * (80000 - 40000) + 30000)
  })

  it('sin IVA no agrega la línea de IVA', async () => {
    const { q } = await cotizacion(0)
    const { sale } = await convertQuote(q.id)
    expect((await getItems(sale.id)).map((i) => i.name)).toEqual(['Silla de pino', 'Instalación'])
    expect(sale.amountCents).toBe(350000)
  })

  it('fiado con anticipo: el anticipo es abono de ESTA venta, aunque haya deudas más viejas', async () => {
    const { c, q } = await cotizacion()
    const { createSale } = await import('./transactions')
    const vieja = await createSale(B, { amountCents: 10000, contactId: c.id, credit: true, date: '2026-01-01T12:00:00.000Z' })
    const { sale } = await convertQuote(q.id, { credit: true, dueDate: '2026-12-01', advanceCents: 200000, method: 'cash' })
    expect(sale).toMatchObject({ status: 'credit', dueDate: '2026-12-01' })
    const debts = await contactDebts(c.id)
    expect(debts.find((d) => d.txn.id === vieja.id)!.remainingCents).toBe(10000) // intacta
    expect(debts.find((d) => d.txn.id === sale.id)!.remainingCents).toBe(406000 - 200000)
    expect(await contactBalance(c.id)).toBe(10000 + 206000)
  })

  it('fiado sin anticipo deja todo el total como deuda', async () => {
    const { c, q } = await cotizacion()
    await convertQuote(q.id, { credit: true })
    expect(await contactBalance(c.id)).toBe(406000)
  })

  it('valida el anticipo', async () => {
    const { q } = await cotizacion()
    await expect(convertQuote(q.id, { advanceCents: 1000 })).rejects.toThrow(/solo aplica a una venta fiada/)
    await expect(convertQuote(q.id, { credit: true, advanceCents: 406001 })).rejects.toThrow(/superar el total/)
    await expect(convertQuote(q.id, { credit: true, advanceCents: -5 })).rejects.toThrow(/anticipo/)
    await expect(convertQuote(q.id, { credit: true, advanceCents: 10.5 })).rejects.toThrow(/anticipo/)
    expect(await db.txn.count()).toBe(0)
    expect((await getQuote(q.id))!.status).toBe('pending')
  })

  it('no se convierte dos veces, ni rechazada; sí aceptada', async () => {
    const { q } = await cotizacion()
    await setQuoteStatus(q.id, 'rejected')
    await expect(convertQuote(q.id)).rejects.toThrow(/rechazada/)
    await setQuoteStatus(q.id, 'accepted')
    await convertQuote(q.id)
    await expect(convertQuote(q.id)).rejects.toThrow(/Ya se convirtió/)
    expect(await db.txn.count()).toBe(1)
    await expect(setQuoteStatus(q.id, 'pending')).rejects.toThrow(/convirtió/)
    await expect(deleteQuote(q.id)).rejects.toThrow(/no se puede borrar/)
    await expect(updateQuote(q.id, { contactId: q.contactId, validUntil: '2026-12-31', items: [free('X', 1, 1)] })).rejects.toThrow(/no se puede editar/)
  })

  it('si un producto ya no existe, no queda venta, ni stock movido, ni cambio de estado', async () => {
    const { silla, q } = await cotizacion()
    await db.product.delete(silla.id)
    await expect(convertQuote(q.id)).rejects.toThrow(/ya no existe/)
    expect(await db.txn.count()).toBe(0)
    expect(await db.txnItem.count()).toBe(0)
    expect(await db.payment.count()).toBe(0)
    expect((await getQuote(q.id))!.status).toBe('pending')
  })

  it('un error en el anticipo deshace también la venta', async () => {
    const { q } = await cotizacion()
    await expect(convertQuote(q.id, { credit: true, advanceCents: 406001 })).rejects.toThrow()
    expect(await db.txn.count()).toBe(0)
  })

  it('un cliente con cotizaciones no pierde nada al convertir: sigue borrable solo sin saldo', async () => {
    const { c, q } = await cotizacion()
    await convertQuote(q.id, { credit: true })
    await expect(deleteContact(c.id)).rejects.toThrow(/saldo pendiente/)
  })
})
