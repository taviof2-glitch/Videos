import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { db } from './db'
import { listMaterials, saveMaterial } from './materials'
import { applyTicket } from './ticket'

let biz: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = (await createBusiness({ name: 'House Lite' })).id
})

describe('ticket de compra', () => {
  it('suma al material que existe, da de alta el nuevo y anota el gasto', async () => {
    const mel = await saveMaterial(biz, { name: 'Hoja de melamina 16 mm', unit: 'hojas', stock: 2, prices: [{ supplier: 'Maderas Tepa', priceCents: 95000 }] })
    const r = await applyTicket(biz, {
      supplier: 'Maderería López', date: '2026-11-27',
      lines: [
        { materialId: mel.id, name: 'Melamina blanca 16', unit: 'hojas', quantity: 5, unitCents: 89000 },
        { materialId: '', name: 'Bisagra cierre suave', unit: 'piezas', quantity: 10, unitCents: 3500 },
      ],
      expense: { amountCents: 480000, method: 'transfer' },
    })
    expect(r).toMatchObject({ updated: 1, created: 1 })
    const list = listMaterials((await db.business.get(biz))!)
    expect(list.find((m) => m.id === mel.id)).toMatchObject({ stock: 7, prices: [{ supplier: 'Maderas Tepa', priceCents: 95000 }, { supplier: 'Maderería López', priceCents: 89000 }] })
    expect(list.find((m) => m.name === 'Bisagra cierre suave')).toMatchObject({ stock: 10, unit: 'piezas' })
    expect(r.expense).toMatchObject({ type: 'expense', amountCents: 480000, paymentMethod: 'transfer' })
    expect(r.expense?.concept).toContain('Maderería López')
    const sup = await db.contact.get(r.expense!.contactId!)
    expect(sup).toMatchObject({ type: 'supplier', name: 'Maderería López' })
  })
  it('un mismo artículo nuevo dos veces se junta y no duplica', async () => {
    await applyTicket(biz, { supplier: '', lines: [{ materialId: '', name: 'Tornillos', unit: 'cajas', quantity: 1, unitCents: 0 }, { materialId: '', name: 'tornillos', unit: 'cajas', quantity: 2, unitCents: 0 }] })
    const list = listMaterials((await db.business.get(biz))!)
    expect(list).toHaveLength(1)
    expect(list[0].stock).toBe(3)
  })
})

describe('proveedor del ticket', () => {
  it('reconoce al mismo proveedor escrito distinto y no lo duplica', async () => {
    const { createContact } = await import('./contacts')
    const { matchSupplier } = await import('./ticket')
    const maxi = await createContact(biz, 'supplier', { name: 'Maximaderas' })
    const erlo = await createContact(biz, 'supplier', { name: 'Erlo' })
    const list = [maxi, erlo]
    expect(matchSupplier('MAXIMADERAS, S.A. DE C.V.', list)?.id).toBe(maxi.id)
    expect(matchSupplier('Maximaderas Tepatitlán', list)?.id).toBe(maxi.id)
    expect(matchSupplier('ERLO', list)?.id).toBe(erlo.id)
    expect(matchSupplier('Ferretería Juárez', list)).toBeUndefined()
    const r = await applyTicket(biz, { supplier: 'MAXIMADERAS SA DE CV', lines: [{ materialId: '', name: 'Hoja de melamina 16 mm', unit: 'hojas', quantity: 2, unitCents: 90000 }], expense: { amountCents: 180000, method: 'cash' } })
    expect(r.expense?.contactId).toBe(maxi.id)
    expect(r.expense?.concept).toContain('Maximaderas')
    expect(listMaterials((await db.business.get(biz))!)[0].prices).toEqual([{ supplier: 'Maximaderas', priceCents: 90000 }])
    expect((await db.contact.toArray()).filter((c) => c.type === 'supplier').length).toBe(2)
  })
})

describe('historial de precios', () => {
  it('guarda cada compra y avisa cuando sube', async () => {
    const { priceRises } = await import('./materials')
    const line = (unitCents: number) => [{ materialId: '', name: 'Hoja de melamina 16 mm', unit: 'hojas', quantity: 1, unitCents }]
    await applyTicket(biz, { supplier: 'Maximaderas', date: '2026-10-01', lines: line(85000) })
    await applyTicket(biz, { supplier: 'Maximaderas', date: '2026-11-20', lines: line(92000) })
    const list = listMaterials((await db.business.get(biz))!)
    expect(list[0].history).toHaveLength(2)
    expect(priceRises(list)).toMatchObject([{ supplier: 'Maximaderas', fromCents: 85000, toCents: 92000, pct: 8 }])
  })
})
