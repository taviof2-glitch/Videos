import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { db } from './db'
import { adjustMaterial, bestPrice, deleteMaterial, isLow, listMaterials, saveMaterial, stockValueCents } from './materials'
import type { Business } from './types'

let biz: Business
const list = async () => listMaterials((await db.business.get(biz.id))!)
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'Taller' })
})

describe('material del taller', () => {
  it('se agrega con precios por proveedor, se ajusta la existencia y avisa cuando falta', async () => {
    const hoja = await saveMaterial(biz.id, { name: ' Hoja de melamina 16 mm ', unit: 'hojas', stock: 6, min: 2, prices: [{ supplier: 'Maderas Tepa', priceCents: 62000 }, { supplier: 'El Roble', priceCents: 58000 }, { supplier: '', priceCents: 100 }] })
    expect(hoja.prices.length).toBe(2)
    expect(bestPrice(hoja)).toEqual({ supplier: 'El Roble', priceCents: 58000 })
    await expect(saveMaterial(biz.id, { name: 'hoja de melamina 16 mm', unit: 'hojas', stock: 1 })).rejects.toThrow('Ya tienes')
    await adjustMaterial(biz.id, hoja.id, -4)
    expect((await list())[0].stock).toBe(2)
    expect(isLow((await list())[0])).toBe(true)
    await adjustMaterial(biz.id, hoja.id, -10)
    expect((await list())[0].stock).toBe(0)
    await adjustMaterial(biz.id, hoja.id, 5)
    expect(stockValueCents(await list())).toBe(5 * 58000)
    await saveMaterial(biz.id, { id: hoja.id, name: 'Hoja blanca', unit: 'hojas', stock: 5 })
    expect((await list())[0]).toMatchObject({ name: 'Hoja blanca', prices: [] })
    await deleteMaterial(biz.id, hoja.id)
    expect(await list()).toEqual([])
  })
})
