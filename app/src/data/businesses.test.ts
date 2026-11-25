import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness, getCurrentBusiness, listBusinesses, switchBusiness } from './business'
import { listCategories } from './categories'
import { createContact, listContacts } from './contacts'
import { db } from './db'
import { createProduct, listProducts } from './products'
import { createSale } from './transactions'
import { balanceForRange } from './balance'
import { createEmployee, currentActor, login, setOwnerPin } from './team'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('varios negocios en un aparato', () => {
  it('crear otro lo deja abierto; se puede volver al primero; la lista va por nombre', async () => {
    const a = await createBusiness({ name: 'Muebles' })
    expect((await getCurrentBusiness())?.id).toBe(a.id)
    const b = await createBusiness({ name: 'Abarrotes' })
    expect((await getCurrentBusiness())?.id).toBe(b.id)
    expect((await listBusinesses()).map((x) => x.name)).toEqual(['Abarrotes', 'Muebles'])
    await switchBusiness(a.id)
    expect((await getCurrentBusiness())?.name).toBe('Muebles')
    await expect(switchBusiness('no-existe')).rejects.toThrow('ya no existe')
  })

  it('cada negocio tiene sus datos, su balance, sus categorías y su equipo', async () => {
    const a = await createBusiness({ name: 'Muebles' })
    const b = await createBusiness({ name: 'Abarrotes' })
    await createProduct(a.id, { name: 'Silla', priceCents: 1000, stock: 5 })
    await createContact(b.id, 'customer', { name: 'Ana' })
    await createSale(a.id, { amountCents: 5000 })
    await createSale(b.id, { amountCents: 700 })
    expect((await listProducts(a.id)).map((p) => p.name)).toEqual(['Silla'])
    expect(await listProducts(b.id)).toEqual([])
    expect((await listContacts(a.id, 'customer')).length).toBe(0)
    expect((await balanceForRange(a.id)).incomeCents).toBe(5000)
    expect((await balanceForRange(b.id)).incomeCents).toBe(700)
    // Las categorías de gasto de fábrica se crean para cada uno (con ids distintos).
    const ca = (await listCategories(a.id, 'expense')).map((c) => c.id)
    const cb = (await listCategories(b.id, 'expense')).map((c) => c.id)
    expect(ca.length).toBe(cb.length)
    expect(ca.filter((id) => cb.includes(id))).toEqual([])
    // El equipo y quién está dentro son de cada negocio.
    const owner = await setOwnerPin(a.id, '9999')
    await createEmployee(a.id, { name: 'Rosa', pin: '1234', permissions: [] })
    expect(await currentActor(a.id)).toMatchObject({ id: owner.id })
    const sinPin = await currentActor(b.id) // b no usa PIN
    expect(sinPin).toMatchObject({ name: 'Dueño', role: 'owner' })
    expect(sinPin?.id).toBeUndefined()
    await expect(login(b.id, owner.id, '9999')).rejects.toThrow('ya no puede entrar')
  })
})
