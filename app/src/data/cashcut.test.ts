import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { addPayment } from './debts'
import { cashCut, lastMonthAnchor, monthGoal } from './cashcut'
import { createExpense, createSale } from './transactions'

let biz: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = (await createBusiness({ name: 'Taller' })).id
})

describe('corte de caja y meta', () => {
  it('suma por forma de pago lo que entró y salió', async () => {
    const when = '2026-11-27T18:00:00.000Z'
    await createSale(biz, { amountCents: 100000, paymentMethod: 'cash', date: when })
    await createSale(biz, { amountCents: 50000, paymentMethod: 'transfer', date: when })
    const c = await createContact(biz, 'customer', { name: 'Ana' })
    await createSale(biz, { amountCents: 400000, credit: true, contactId: c.id, date: when })
    await addPayment(c.id, 150000, { method: 'cash', date: when })
    await createExpense(biz, { amountCents: 30000, paymentMethod: 'cash', date: when })
    const cut = await cashCut(biz, 'day', '2026-11-27', 'America/Mexico_City')
    expect(cut.cashCents).toBe(220000)
    expect(cut.rows.find((r) => r.method === 'transfer')).toMatchObject({ inCents: 50000, outCents: 0 })
    expect(cut).toMatchObject({ inCents: 300000, outCents: 30000, netCents: 270000, salesCount: 2 })
    const g = await monthGoal(biz, 10000000, '2026-11-27', 'America/Mexico_City')
    expect(g).toMatchObject({ soldCents: 550000, pct: 6, daysLeft: 3 })
    expect(lastMonthAnchor('2026-12-01')).toBe('2026-11-01')
  })
})
