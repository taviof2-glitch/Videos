import { beforeEach, expect, test } from 'vitest'
import { businessContext } from './assistant'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { createSale } from './transactions'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('el resumen trae el balance del día y quién debe', async () => {
  const b = await createBusiness({ name: 'House Lite' })
  const today = '2026-11-26'
  const ana = await createContact(b.id, 'customer', { name: 'Ana Ruiz' })
  await createSale(b.id, { amountCents: 150_000, date: `${today}T18:00:00.000Z` })
  await createSale(b.id, { amountCents: 80_000, date: `${today}T18:00:00.000Z`, credit: true, contactId: ana.id })
  const text = await businessContext((await db.business.get(b.id))!, today)
  expect(text).toContain('Negocio: House Lite. Hoy es 2026-11-26.')
  expect(text).toMatch(/Hoy: cobrado \$1,500\.00 \(2 ventas registradas/)
  expect(text).toMatch(/Ana Ruiz: \$800\.00/)
  expect(text).toContain('Obras en curso: ninguno.')
})
