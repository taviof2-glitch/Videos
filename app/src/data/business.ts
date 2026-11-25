import { seedDefaultExpenseCategories } from './categories'
import { db } from './db'
import type { Business } from './types'

const CURRENT = 'currentBusinessId'

export type NewBusiness = Pick<Business, 'name'> & Partial<Omit<Business, 'id' | 'name' | 'createdAt' | 'updatedAt'>>

export async function createBusiness(input: NewBusiness): Promise<Business> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre del negocio es obligatorio')
  const now = new Date().toISOString()
  const business: Business = {
    id: crypto.randomUUID(),
    category: '',
    country: 'MX',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    phone: '',
    address: '',
    openingHours: '',
    ...input,
    name,
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', db.business, db.meta, async () => {
    await db.business.add(business)
    await db.meta.put({ key: CURRENT, value: business.id })
  })
  await seedDefaultExpenseCategories(business.id)
  return business
}

export async function getCurrentBusiness(): Promise<Business | undefined> {
  const current = await db.meta.get(CURRENT)
  if (!current) return undefined
  return db.business.get(current.value)
}

export async function updateBusiness(id: string, changes: Partial<Omit<Business, 'id' | 'createdAt'>>) {
  await db.business.update(id, { ...changes, updatedAt: new Date().toISOString() })
}
