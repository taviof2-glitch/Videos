import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { DEFAULT_EXPENSE_CATEGORIES, ensureCategory, listCategories, seedDefaultExpenseCategories } from './categories'
import { db } from './db'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('categorías de gasto de fábrica', () => {
  it('un negocio nuevo ya las trae, y las de producto quedan vacías', async () => {
    const b = await createBusiness({ name: 'Taller' })
    const names = (await listCategories(b.id, 'expense')).map((c) => c.name)
    expect(names).toHaveLength(DEFAULT_EXPENSE_CATEGORIES.length)
    for (const n of ['Transporte', 'Materiales', 'Insumos', 'Nómina', 'Gastos administrativos', 'Luz']) expect(names).toContain(n)
    expect(await listCategories(b.id, 'product')).toEqual([])
  })

  it('se siembran una sola vez: borrar una no la revive ni se duplica al llamar de nuevo', async () => {
    const b = await createBusiness({ name: 'Taller' })
    const luz = (await listCategories(b.id, 'expense')).find((c) => c.name === 'Luz')!
    await db.category.update(luz.id, { deletedAt: new Date().toISOString() })
    expect(await seedDefaultExpenseCategories(b.id)).toBe(0)
    const names = (await listCategories(b.id, 'expense')).map((c) => c.name)
    expect(names).not.toContain('Luz')
    expect(names).toHaveLength(DEFAULT_EXPENSE_CATEGORIES.length - 1)
  })

  it('un negocio que ya existía las recibe sin duplicar las que ya tenía (aunque cambie la mayúscula)', async () => {
    const id = crypto.randomUUID()
    await db.business.add({ id, name: 'Viejo', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', phone: '', address: '', openingHours: '', createdAt: '', updatedAt: '' })
    await ensureCategory(id, 'expense', 'transporte')
    await ensureCategory(id, 'expense', 'Flete')
    const added = await seedDefaultExpenseCategories(id)
    expect(added).toBe(DEFAULT_EXPENSE_CATEGORIES.length - 1)
    const names = (await listCategories(id, 'expense')).map((c) => c.name)
    expect(names.filter((n) => n.toLowerCase() === 'transporte')).toEqual(['transporte'])
    expect(names).toContain('Flete')
  })

  it('el id es el mismo en cualquier aparato (no se duplican al sincronizar) y distinto entre negocios', async () => {
    const a = crypto.randomUUID()
    const b = crypto.randomUUID()
    for (const id of [a, b]) await db.business.add({ id, name: 'N', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', phone: '', address: '', openingHours: '', createdAt: '', updatedAt: '' })
    await seedDefaultExpenseCategories(a)
    await seedDefaultExpenseCategories(b)
    const ids = (await listCategories(a, 'expense')).map((c) => c.id).sort()
    await db.category.clear()
    await db.meta.clear()
    await seedDefaultExpenseCategories(a)
    expect((await listCategories(a, 'expense')).map((c) => c.id).sort()).toEqual(ids)
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    await seedDefaultExpenseCategories(b)
    expect((await listCategories(b, 'expense')).map((c) => c.id)).not.toContain(ids[0])
  })
})
