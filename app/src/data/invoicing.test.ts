import { describe, expect, it } from 'vitest'
import { invoiceItems, invoicingOf, RFC_RE } from './invoicing'
import type { Transaction, TransactionItem } from './types'

describe('factura electrónica', () => {
  it('conceptos desde la venta, con el descuento repartido en el precio', () => {
    const sale = { amountCents: 450000, concept: 'Closet' } as Transaction
    expect(invoiceItems(sale, [])).toEqual([{ description: 'Closet', quantity: 1, unitPrice: 4500 }])
    const items = [{ name: 'Repisa', quantity: 2, unitPriceCents: 40000, discountCents: 10000 }] as TransactionItem[]
    expect(invoiceItems(sale, items)).toEqual([{ description: 'Repisa', quantity: 2, unitPrice: 350 }])
  })
  it('RFC y valores por defecto', () => {
    expect(RFC_RE.test('GODE561231GR8')).toBe(true)
    expect(RFC_RE.test('ABC010101AB1')).toBe(true)
    expect(RFC_RE.test('12345')).toBe(false)
    expect(invoicingOf({})).toMatchObject({ enabled: false, productKey: '01010101', taxIncluded: true })
  })
})
