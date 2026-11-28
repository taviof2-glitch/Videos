import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { chooseOption, defaultOptions, saveOptions } from './quoteOptions'
import { createQuote, getQuoteItems } from './quotes'

let biz: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = (await createBusiness({ name: 'Taller' })).id
})

describe('opciones de la cotización', () => {
  it('al elegir una opción, el total queda en el precio de esa opción', async () => {
    const c = await createContact(biz, 'customer', { name: 'Luis' })
    const q = await createQuote(biz, { contactId: c.id, validUntil: '2027-01-01', title: 'Cocina', advanceCents: 500000, items: [{ name: 'Cocina integral', quantity: 1, unitPriceCents: 1000000 }] })
    expect(defaultOptions(1000000).map((o) => o.priceCents)).toEqual([1000000, 1150000, 1350000])
    await saveOptions(q.id, defaultOptions(1000000))
    let next = await chooseOption(q.id, 2)
    expect(next.totalCents).toBe(1350000)
    expect(next.advanceCents).toBe(675000)
    next = await chooseOption(q.id, 1)
    expect(next.totalCents).toBe(1150000)
    expect((await getQuoteItems(q.id)).map((i) => i.name)).toEqual(['Cocina integral', 'Opción Media: Bisagras y correderas de cierre suave'])
    next = await chooseOption(q.id, 0)
    expect(next.totalCents).toBe(1000000)
    expect((await db.quote.get(q.id))?.chosenOption).toBe(0)
  })
})
