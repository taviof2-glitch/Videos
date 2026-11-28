import { beforeEach, describe, expect, it } from 'vitest'
import { createContact, deleteContact, getContact, listContacts, updateContact } from './contacts'
import { db } from './db'

const B = 'negocio-1'

beforeEach(async () => {
  await db.contact.clear()
})

describe('contactos', () => {
  it('crea un cliente con los datos limpios', async () => {
    const c = await createContact(B, 'customer', { name: '  Olga Acevedo ', phone: ' 33 1234 5678 ', notes: 'Cocina integral' })
    expect(c).toMatchObject({ name: 'Olga Acevedo', phone: '33 1234 5678', type: 'customer', documentId: '', notes: 'Cocina integral' })
  })

  it('exige nombre y un teléfono razonable', async () => {
    await expect(createContact(B, 'customer', { name: ' ' })).rejects.toThrow(/nombre/)
    await expect(createContact(B, 'customer', { name: 'X', phone: 'abc' })).rejects.toThrow(/teléfono/)
    await expect(createContact(B, 'customer', { name: 'X', phone: '123' })).rejects.toThrow(/teléfono/)
    await expect(createContact(B, 'customer', { name: 'X', phone: '+52 (33) 1234-5678' })).resolves.toBeTruthy()
    await expect(createContact(B, 'customer', { name: 'Y' })).resolves.toBeTruthy()
  })

  it('separa clientes, proveedores y negocios', async () => {
    await createContact(B, 'customer', { name: 'Ana' })
    await createContact(B, 'supplier', { name: 'Maderería Sur' })
    await createContact('otro', 'customer', { name: 'Ajeno' })
    expect((await listContacts(B, 'customer')).map((c) => c.name)).toEqual(['Ana'])
    expect((await listContacts(B, 'supplier')).map((c) => c.name)).toEqual(['Maderería Sur'])
  })

  it('busca por nombre sin acentos y por teléfono', async () => {
    await createContact(B, 'customer', { name: 'José Pérez', phone: '33 1111 2222' })
    await createContact(B, 'customer', { name: 'Ana', phone: '(55) 9999-0000' })
    expect((await listContacts(B, 'customer', 'JOSE')).map((c) => c.name)).toEqual(['José Pérez'])
    expect((await listContacts(B, 'customer', '9999')).map((c) => c.name)).toEqual(['Ana'])
    expect((await listContacts(B, 'customer', '55 99')).map((c) => c.name)).toEqual(['Ana'])
    expect(await listContacts(B, 'customer', 'zzz')).toHaveLength(0)
    expect((await listContacts(B, 'customer')).map((c) => c.name)).toEqual(['Ana', 'José Pérez'])
  })

  it('edita sin cambiar el tipo y valida igual que al crear', async () => {
    const c = await createContact(B, 'supplier', { name: 'Ferretería' })
    const u = await updateContact(c.id, { name: 'Ferretería Centro', phone: '3312345678' })
    expect(u).toMatchObject({ type: 'supplier', name: 'Ferretería Centro', createdAt: c.createdAt })
    await expect(updateContact(c.id, { name: '' })).rejects.toThrow(/nombre/)
  })

  it('borrar lo oculta pero conserva la fila', async () => {
    const c = await createContact(B, 'customer', { name: 'Ana' })
    await deleteContact(c.id)
    expect(await getContact(c.id)).toBeUndefined()
    expect(await listContacts(B, 'customer')).toHaveLength(0)
    expect((await db.contact.get(c.id))?.deletedAt).toBeTruthy()
    await expect(updateContact(c.id, { name: 'Otra' })).rejects.toThrow(/no existe/)
  })
})
