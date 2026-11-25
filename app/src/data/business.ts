import { seedDefaultExpenseCategories } from './categories'
import { checkPhone } from './contacts'
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

/** Los negocios de este aparato (T14), por nombre. */
export async function listBusinesses(): Promise<Business[]> {
  return (await db.business.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/** Abre otro negocio de este aparato. Cada uno conserva sus datos, su equipo y su conexión a la cuenta. */
export async function switchBusiness(id: string): Promise<void> {
  const b = await db.business.get(id)
  if (!b) throw new Error('Ese negocio ya no existe')
  await db.meta.put({ key: CURRENT, value: id })
}

export type BusinessProfile = Pick<Business, 'name' | 'category' | 'phone' | 'address' | 'openingHours'>

/** Cambia los datos de contacto del negocio (nombre, giro, teléfono de WhatsApp, dirección y horario). */
export async function updateBusinessProfile(id: string, input: BusinessProfile): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre del negocio es obligatorio')
  const phone = input.phone.trim()
  checkPhone(phone)
  const b = await db.business.get(id)
  if (!b) throw new Error('El negocio no existe')
  await updateBusiness(id, { name, category: input.category.trim(), phone, address: input.address.trim(), openingHours: input.openingHours.trim() })
}
