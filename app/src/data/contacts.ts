import { db } from './db'
import type { Contact, ContactType } from './types'

export type ContactInput = {
  name: string
  phone?: string
  documentId?: string
  notes?: string
}

/** Un teléfono, si se escribe, debe tener al menos 7 dígitos (acepta espacios, guiones, paréntesis y +). */
function checkPhone(phone: string) {
  if (!phone) return
  if (!/^[\d\s()+-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new Error('El teléfono no es válido')
}

function clean(input: ContactInput) {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')
  const phone = (input.phone ?? '').trim()
  checkPhone(phone)
  return { name, phone, documentId: (input.documentId ?? '').trim(), notes: (input.notes ?? '').trim() }
}

export async function createContact(businessId: string, type: ContactType, input: ContactInput): Promise<Contact> {
  const now = new Date().toISOString()
  const contact: Contact = { id: crypto.randomUUID(), businessId, type, ...clean(input), createdAt: now, updatedAt: now }
  await db.contact.add(contact)
  return contact
}

export async function updateContact(id: string, input: ContactInput): Promise<Contact> {
  return db.transaction('rw', db.contact, async () => {
    const current = await db.contact.get(id)
    if (!current || current.deletedAt) throw new Error('El contacto no existe')
    const next: Contact = { ...current, ...clean(input), updatedAt: new Date().toISOString() }
    await db.contact.put(next)
    return next
  })
}

/** Borrado lógico: ventas, deudas y cotizaciones que lo referencian conservan su historial. */
export async function deleteContact(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.contact.update(id, { deletedAt: now, updatedAt: now })
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const c = await db.contact.get(id)
  return c && !c.deletedAt ? c : undefined
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Contactos vivos por nombre. La búsqueda ignora acentos y mayúsculas, y también busca por teléfono (solo dígitos). */
export async function listContacts(businessId: string, type: ContactType, search = ''): Promise<Contact[]> {
  const q = normalize(search.trim())
  const digits = search.replace(/\D/g, '')
  const rows = await db.contact
    .where({ businessId, type })
    .filter(
      (c) =>
        !c.deletedAt &&
        (!q || normalize(c.name).includes(q) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))),
    )
    .toArray()
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
