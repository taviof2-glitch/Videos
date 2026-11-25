import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from './backup'
import { createContact } from './contacts'
import { db } from './db'
import { createProduct, findByCode, getProduct, listProducts, stockFromMovements, stockStatus, summarize, updateProduct } from './products'
import { createPurchase, voidPurchase } from './purchases'
import { convertQuote, createQuote } from './quotes'
import { createSale, getItems, saleProfit, updateSale, voidTransaction } from './transactions'
import { cleanAttributes, getVariant, listVariants, removeVariants, setVariantAttributes, updateVariant, variantCombos } from './variants'

const B = 'negocio-1'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

/** El total del producto y el de cada variante deben coincidir con sus movimientos, y el total con la suma de variantes. */
async function expectConsistent(productId: string) {
  const p = (await getProduct(productId)) ?? (await db.product.get(productId))!
  expect(p.stock).toBe(await stockFromMovements(productId))
  const vs = await listVariants(productId)
  for (const v of vs) expect(v.stock).toBe(await stockFromMovements(productId, v.id))
  if (p.hasVariants) expect(Math.round(vs.reduce((s, v) => s + v.stock, 0) * 1000) / 1000).toBe(p.stock)
}

async function librero(stock = 0) {
  const p = await createProduct(B, { name: 'Librero', priceCents: 300000, costCents: 150000, stock })
  await setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Natural', 'Nogal'] }, { name: 'Tamaño', values: ['Chico', 'Grande'] }])
  const vs = await listVariants(p.id)
  return { p, vs, v: Object.fromEntries(vs.map((x) => [x.name, x])) }
}

describe('atributos y combinaciones', () => {
  it('combina valores en orden', () => {
    expect(variantCombos([{ name: 'A', values: ['1', '2'] }, { name: 'B', values: ['x', 'y'] }])).toEqual([['1', 'x'], ['1', 'y'], ['2', 'x'], ['2', 'y']])
    expect(variantCombos([{ name: 'Color', values: ['Rojo'] }])).toEqual([['Rojo']])
  })

  it('limpia espacios y repetidos y valida', () => {
    expect(cleanAttributes([{ name: ' Color ', values: [' Rojo', 'rojo', '', 'Azul '] }])).toEqual([{ name: 'Color', values: ['Rojo', 'Azul'] }])
    expect(() => cleanAttributes([])).toThrow(/al menos un atributo/)
    expect(() => cleanAttributes([{ name: '', values: ['x'] }])).toThrow(/nombre/)
    expect(() => cleanAttributes([{ name: 'Color', values: [' '] }])).toThrow(/al menos un valor/)
    expect(() => cleanAttributes([{ name: 'Color', values: ['a'] }, { name: 'color', values: ['b'] }])).toThrow(/distintos/)
    expect(() => cleanAttributes([{ name: 'A', values: ['1'] }, { name: 'B', values: ['1'] }, { name: 'C', values: ['1'] }])).toThrow(/Máximo 2/)
    const many = Array.from({ length: 8 }, (_, i) => String(i))
    expect(() => cleanAttributes([{ name: 'A', values: many }, { name: 'B', values: many }])).toThrow(/64 variantes/)
  })
})

describe('generar y editar variantes', () => {
  it('crea las variantes y pasa el stock que había a la primera, con sus movimientos', async () => {
    const p = await createProduct(B, { name: 'Librero', stock: 5 })
    const r = await setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Natural', 'Nogal'] }])
    expect(r).toEqual({ created: 2, removed: 0, movedStock: 5 })
    const vs = await listVariants(p.id)
    expect(vs.map((v) => [v.name, v.stock])).toEqual([['Natural', 5], ['Nogal', 0]])
    expect(await getProduct(p.id)).toMatchObject({ hasVariants: true, stock: 5, variantAttributes: [{ name: 'Acabado', values: ['Natural', 'Nogal'] }] })
    await expectConsistent(p.id)
  })

  it('cambiar atributos conserva las existentes, crea nuevas en 0 y solo quita las que están en 0', async () => {
    const { p, v } = await librero()
    await updateVariant(v['Nogal / Grande'].id, { stock: 3 })
    await expect(setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Natural'] }, { name: 'Tamaño', values: ['Chico', 'Grande'] }])).rejects.toThrow(/Nogal \/ Grande.*en 0/)
    expect(await listVariants(p.id)).toHaveLength(4) // el error no dejó nada a medias
    const r = await setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Natural', 'Nogal', 'Blanco'] }, { name: 'Tamaño', values: ['chico', 'Grande'] }])
    expect(r).toMatchObject({ created: 2, removed: 0, movedStock: 0 })
    const vs = await listVariants(p.id)
    expect(vs.map((x) => x.name)).toEqual(['Natural / chico', 'Natural / Grande', 'Nogal / chico', 'Nogal / Grande', 'Blanco / chico', 'Blanco / Grande'])
    expect(vs.find((x) => x.name === 'Nogal / Grande')!.stock).toBe(3)
    expect(vs.find((x) => x.name === 'Nogal / Grande')!.id).toBe(v['Nogal / Grande'].id) // misma variante
    await setVariantAttributes(p.id, [{ name: 'Acabado', values: ['Nogal'] }, { name: 'Tamaño', values: ['Grande'] }])
    expect((await listVariants(p.id)).map((x) => x.name)).toEqual(['Nogal / Grande'])
    await expectConsistent(p.id)
  })

  it('edita stock, mínimo, precio, costo y código de cada variante', async () => {
    const { p, v } = await librero()
    const nogal = v['Nogal / Chico']
    const u = await updateVariant(nogal.id, { stock: 7, minStock: 2, priceCents: 350000, costCents: 170000, barcode: ' 7501 ' })
    expect(u).toMatchObject({ stock: 7, minStock: 2, priceCents: 350000, costCents: 170000, barcode: '7501' })
    expect((await getProduct(p.id))!.stock).toBe(7)
    const back = await updateVariant(nogal.id, { priceCents: null, costCents: null, stock: 4 })
    expect(back.priceCents).toBeUndefined()
    expect(back.costCents).toBeUndefined()
    expect((await getProduct(p.id))!.stock).toBe(4)
    await expect(updateVariant(nogal.id, { stock: -1 })).rejects.toThrow(/negativa/)
    await expect(updateVariant(nogal.id, { priceCents: 1.5 })).rejects.toThrow(/precio/)
    await expectConsistent(p.id)
  })

  it('el código de barras es único entre productos y variantes', async () => {
    const { v } = await librero()
    await createProduct(B, { name: 'Clavo', barcode: '111' })
    await expect(updateVariant(v['Natural / Chico'].id, { barcode: '111' })).rejects.toThrow(/Clavo/)
    await updateVariant(v['Natural / Chico'].id, { barcode: '222' })
    await expect(updateVariant(v['Nogal / Chico'].id, { barcode: '222' })).rejects.toThrow(/Librero \(Natural \/ Chico\)/)
    await expect(createProduct(B, { name: 'Otro', barcode: '222' })).rejects.toThrow(/Librero \(Natural \/ Chico\)/)
    expect((await findByCode(B, '222'))!.variant!.name).toBe('Natural / Chico')
    expect((await findByCode(B, '111'))!.product.name).toBe('Clavo')
  })

  it('el stock de un producto con variantes no se edita en el producto', async () => {
    const { p } = await librero()
    await expect(updateProduct(p.id, { stock: 10 })).rejects.toThrow(/cada variante/)
    await expect(updateProduct(p.id, { name: 'Librero de pino', stock: 0 })).resolves.toMatchObject({ name: 'Librero de pino' })
  })

  it('quitar las variantes exige que estén en 0', async () => {
    const { p, v } = await librero()
    await updateVariant(v['Natural / Chico'].id, { stock: 2 })
    await expect(removeVariants(p.id)).rejects.toThrow(/Natural \/ Chico.*tiene 2/)
    await updateVariant(v['Natural / Chico'].id, { stock: 0 })
    await removeVariants(p.id)
    expect(await getProduct(p.id)).toMatchObject({ hasVariants: false, stock: 0 })
    expect(await listVariants(p.id)).toHaveLength(0)
    expect(await getVariant(v['Natural / Chico'].id)).toBeUndefined()
  })
})

describe('inventario con variantes', () => {
  it('estado de stock, lista, búsqueda y valor a costo', async () => {
    const { p, v } = await librero()
    await updateVariant(v['Natural / Chico'].id, { stock: 5, minStock: 2 })
    await updateVariant(v['Natural / Grande'].id, { stock: 1, minStock: 2 })
    await updateVariant(v['Nogal / Chico'].id, { stock: 3, costCents: 200000, barcode: '9001' })
    await updateVariant(v['Nogal / Grande'].id, { stock: 4 })
    expect(stockStatus({ stock: 0, minStock: 0, variants: [{ stock: 0, minStock: 0 }, { stock: -1, minStock: 0 }] })).toBe('out')
    expect(stockStatus({ stock: 9, minStock: 0, variants: [{ stock: 5, minStock: 0 }, { stock: 0, minStock: 0 }] })).toBe('low')
    expect(stockStatus({ stock: 9, minStock: 0, variants: [{ stock: 5, minStock: 1 }, { stock: 4, minStock: 0 }] })).toBe('ok')
    const [item] = await listProducts(B)
    expect(item.id).toBe(p.id)
    expect(item.variants).toHaveLength(4)
    expect(item.stock).toBe(13)
    expect(stockStatus(item)).toBe('low') // Natural / Grande está en 1 con mínimo 2
    expect(await listProducts(B, { onlyRestock: true })).toHaveLength(1)
    expect(await listProducts(B, { search: 'nogal' })).toHaveLength(1)
    expect(await listProducts(B, { search: '9001' })).toHaveLength(1)
    expect(await listProducts(B, { search: 'zzz' })).toHaveLength(0)
    expect(await listProducts(B, { search: 'nogal ch' })).toHaveLength(1) // por palabras
    expect(await listProducts(B, { search: 'LIBRERO grande' })).toHaveLength(1)
    const { productOptions } = await import('../ui/productOptions')
    expect(productOptions(await listProducts(B, { search: 'nogal ch' }), 'nogal ch').map((o) => o.label)).toEqual(['Librero · Nogal / Chico'])
    expect(productOptions(await listProducts(B, { search: 'librero' }), 'librero')).toHaveLength(4) // por el producto: todas
    expect(productOptions(await listProducts(B, { search: '9001' }), '9001').map((o) => o.name)).toEqual(['Librero (Nogal / Chico)'])
    // valor a costo: 5×1500 + 1×1500 + 3×2000 (costo propio) + 4×1500
    expect(summarize([item]).costValueCents).toBe(5 * 150000 + 1 * 150000 + 3 * 200000 + 4 * 150000)
  })
})

describe('vender variantes', () => {
  it('exige la variante, descuenta de ella y del total, y usa su costo propio', async () => {
    const { p, v } = await librero()
    const nogal = v['Nogal / Grande']
    await updateVariant(nogal.id, { stock: 5, costCents: 180000 })
    await expect(createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 300000 }] })).rejects.toThrow(/Elige la variante de "Librero"/)
    const s = await createSale(B, { items: [{ productId: p.id, variantId: nogal.id, quantity: 2, unitPriceCents: 320000 }] })
    expect((await getVariant(nogal.id))!.stock).toBe(3)
    expect((await getProduct(p.id))!.stock).toBe(3)
    const [line] = await getItems(s.id)
    expect(line).toMatchObject({ name: 'Librero (Nogal / Grande)', variantId: nogal.id, unitCostCents: 180000 })
    expect(saleProfit([line])).toBe(2 * (320000 - 180000))
    await expectConsistent(p.id)
  })

  it('una variante de otro producto o inexistente se rechaza sin dejar nada a medias', async () => {
    const { p, v } = await librero()
    const otro = await librero()
    await updateVariant(v['Natural / Chico'].id, { stock: 2 })
    await expect(createSale(B, { items: [{ productId: p.id, variantId: v['Natural / Chico'].id, quantity: 1, unitPriceCents: 1 }, { productId: p.id, variantId: otro.vs[0].id, quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/variantes ya no existe/)
    expect((await getVariant(v['Natural / Chico'].id))!.stock).toBe(2)
    expect(await db.txn.count()).toBe(0)
  })

  it('editar cambiando de variante devuelve una y descuenta la otra; borrar devuelve todo', async () => {
    const { p, v } = await librero()
    const a = v['Natural / Chico']
    const b = v['Nogal / Chico']
    await updateVariant(a.id, { stock: 5 })
    await updateVariant(b.id, { stock: 5 })
    const s = await createSale(B, { items: [{ productId: p.id, variantId: a.id, quantity: 2, unitPriceCents: 100 }] })
    await updateSale(s.id, { items: [{ productId: p.id, variantId: b.id, quantity: 3, unitPriceCents: 100 }] })
    expect([(await getVariant(a.id))!.stock, (await getVariant(b.id))!.stock]).toEqual([5, 2])
    await voidTransaction(s.id)
    expect([(await getVariant(a.id))!.stock, (await getVariant(b.id))!.stock]).toEqual([5, 5])
    expect((await getProduct(p.id))!.stock).toBe(10)
    await expectConsistent(p.id)
  })
})

describe('comprar y cotizar variantes', () => {
  it('la compra sube la variante y lleva su costo promedio; anular lo revierte', async () => {
    const { p, v } = await librero()
    const nogal = v['Nogal / Grande']
    await updateVariant(nogal.id, { stock: 10 }) // costo heredado del producto: 1500
    await expect(createPurchase(B, { items: [{ productId: p.id, quantity: 1, unitCostCents: 1 }] })).rejects.toThrow(/Elige la variante/)
    const c = await createPurchase(B, { items: [{ productId: p.id, variantId: nogal.id, quantity: 10, unitCostCents: 250000 }] })
    expect((await getVariant(nogal.id))!).toMatchObject({ stock: 20, costCents: 200000 }) // (10×1500 + 10×2500) / 20
    expect((await getProduct(p.id))!).toMatchObject({ stock: 20, costCents: 150000 }) // el costo del producto no cambia
    await voidPurchase(c.id)
    expect((await getVariant(nogal.id))!).toMatchObject({ stock: 10, costCents: 150000 })
    await expectConsistent(p.id)
  })

  it('la cotización exige la variante y al convertir descuenta esa variante', async () => {
    const { p, v } = await librero()
    const olga = await createContact(B, 'customer', { name: 'Olga' })
    const nogal = v['Nogal / Chico']
    await updateVariant(nogal.id, { stock: 4 })
    const base = { contactId: olga.id, validUntil: '2026-12-31' }
    await expect(createQuote(B, { ...base, items: [{ productId: p.id, quantity: 1, unitPriceCents: 300000 }] })).rejects.toThrow(/Elige la variante/)
    const q = await createQuote(B, { ...base, items: [{ productId: p.id, variantId: nogal.id, quantity: 3, unitPriceCents: 300000 }] })
    const { sale } = await convertQuote(q.id)
    expect((await getItems(sale.id))[0]).toMatchObject({ name: 'Librero (Nogal / Chico)', variantId: nogal.id })
    expect((await getVariant(nogal.id))!.stock).toBe(1)
    await expectConsistent(p.id)
  })
})

describe('estadísticas y reporte con variantes', () => {
  it('más vendidos suma las variantes bajo el nombre del producto; el Excel lleva una fila por variante', async () => {
    const { computeStats } = await import('./stats')
    const { reportSheets } = await import('./reports')
    const { p, v } = await librero()
    await updateVariant(v['Natural / Chico'].id, { stock: 5 })
    await updateVariant(v['Nogal / Grande'].id, { stock: 5, costCents: 200000 })
    await createSale(B, { items: [{ productId: p.id, variantId: v['Nogal / Grande'].id, quantity: 1, unitPriceCents: 400000 }], date: '2026-03-02T18:00:00.000Z' })
    await createSale(B, { items: [{ productId: p.id, variantId: v['Natural / Chico'].id, quantity: 2, unitPriceCents: 300000 }], date: '2026-03-03T18:00:00.000Z' })
    const stats = await computeStats(B, 'month', '2026-03-15', 'America/Mexico_City')
    expect(stats.topProducts).toEqual([{ productId: p.id, name: 'Librero', quantity: 3, revenueCents: 1000000, profitCents: (400000 - 200000) + 2 * (300000 - 150000) }])
    const business = { id: B, name: 'X', category: '', country: 'MX', currency: 'MXN', timezone: 'America/Mexico_City', phone: '', address: '', openingHours: '', createdAt: '', updatedAt: '' }
    const sheets = await reportSheets(business, 'month', '2026-03-15', stats)
    expect(sheets[2].rows.map((r) => [r[0], r[1]])).toEqual([['Librero (Natural / Chico)', 2], ['Librero (Nogal / Grande)', 1]])
    const inv = sheets.find((s) => s.name === 'Inventario')!.rows.map((r) => [r[0], r[3], r[5]])
    expect(inv).toContainEqual(['Librero (Nogal / Grande)', 4, 2000])
    expect(inv).toContainEqual(['Librero (Natural / Chico)', 3, 1500])
    expect(inv).toHaveLength(4)
  })
})

describe('copia de seguridad', () => {
  it('incluye las variantes', async () => {
    const { p, v } = await librero()
    await updateVariant(v['Nogal / Grande'].id, { stock: 6, barcode: '77' })
    const text = JSON.stringify(await exportBackup())
    await Promise.all(db.tables.map((t) => t.clear()))
    await importBackup(text)
    expect((await listVariants(p.id)).find((x) => x.name === 'Nogal / Grande')).toMatchObject({ stock: 6, barcode: '77' })
    await expectConsistent(p.id)
  })
})
