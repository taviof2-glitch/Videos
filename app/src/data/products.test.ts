import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { ensureCategory, listCategories } from './categories'
import {
  adjustStock,
  createProduct,
  deleteProduct,
  findByBarcode,
  getProduct,
  listProducts,
  stockFromMovements,
  stockHistory,
  stockStatus,
  summarize,
  updateProduct,
} from './products'
import { parseQuantity } from './quantity'

const B = 'negocio-1'

beforeEach(async () => {
  await Promise.all([db.product.clear(), db.stockMovement.clear(), db.category.clear()])
})

describe('cantidades', () => {
  it('acepta enteros y hasta 3 decimales', () => {
    expect(parseQuantity('3')).toBe(3)
    expect(parseQuantity('2,5')).toBe(2.5)
    expect(parseQuantity('0.125')).toBe(0.125)
    expect(parseQuantity('-1')).toBeNull()
    expect(parseQuantity('1.2345')).toBeNull()
    expect(parseQuantity('')).toBeNull()
  })
})

describe('productos', () => {
  it('crea un producto con su movimiento de stock inicial', async () => {
    const p = await createProduct(B, { name: ' Silla de pino ', priceCents: 85000, costCents: 40000, stock: 4, minStock: 2 })
    expect(p.name).toBe('Silla de pino')
    expect(await stockFromMovements(p.id)).toBe(4)
    const history = await stockHistory(p.id)
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ delta: 4, reason: 'adjust' })
  })

  it('sin stock inicial no crea movimientos', async () => {
    const p = await createProduct(B, { name: 'Mesa' })
    expect(await stockHistory(p.id)).toHaveLength(0)
  })

  it('valida los campos obligatorios', async () => {
    await expect(createProduct(B, { name: '  ' })).rejects.toThrow(/nombre/)
    await expect(createProduct(B, { name: 'X', stock: -1 })).rejects.toThrow(/negativa/)
    await expect(createProduct(B, { name: 'X', priceCents: 1.5 })).rejects.toThrow(/precio/)
    const blob = new Blob(['x'])
    await expect(createProduct(B, { name: 'X', photos: [blob, blob, blob, blob] })).rejects.toThrow(/3 imágenes/)
  })

  it('no repite código de barras en el mismo negocio', async () => {
    await createProduct(B, { name: 'Clavo', barcode: '750100' })
    await expect(createProduct(B, { name: 'Tornillo', barcode: '750100' })).rejects.toThrow(/Clavo/)
    await expect(createProduct('otro', { name: 'Tornillo', barcode: '750100' })).resolves.toBeTruthy()
    const t = await createProduct(B, { name: 'Tornillo', barcode: '750200' })
    await expect(updateProduct(t.id, { barcode: '750100' })).rejects.toThrow(/Clavo/)
    // Editar otro campo sin cambiar su propio código sí se puede.
    await expect(updateProduct(t.id, { priceCents: 100 })).resolves.toMatchObject({ priceCents: 100 })
  })

  it('el código de un producto borrado queda libre', async () => {
    const p = await createProduct(B, { name: 'Clavo', barcode: '750100' })
    await deleteProduct(p.id)
    await expect(createProduct(B, { name: 'Clavo nuevo', barcode: '750100' })).resolves.toBeTruthy()
    expect((await findByBarcode(B, '750100'))?.name).toBe('Clavo nuevo')
  })

  it('editar la cantidad genera un ajuste por la diferencia', async () => {
    const p = await createProduct(B, { name: 'Tabla', stock: 10 })
    await updateProduct(p.id, { stock: 7.5 })
    await updateProduct(p.id, { name: 'Tabla de pino' })
    const history = await stockHistory(p.id)
    expect(history.map((m) => m.delta).sort()).toEqual([-2.5, 10])
    expect(await stockFromMovements(p.id)).toBe(7.5)
    expect((await getProduct(p.id))?.name).toBe('Tabla de pino')
  })

  it('adjustStock mueve la caché y el historial juntos, sin errores de coma flotante', async () => {
    const p = await createProduct(B, { name: 'Barniz (L)', stock: 0.1 })
    await adjustStock(p.id, 0.2, 'purchase')
    const after = await adjustStock(p.id, -1, 'sale', 'venta-1')
    expect(after.stock).toBe(-0.7)
    expect(await stockFromMovements(p.id)).toBe(-0.7)
    expect((await db.stockMovement.where({ transactionId: 'venta-1' }).first())?.reason).toBe('sale')
  })

  it('un producto en negativo se puede editar sin tocar la cantidad', async () => {
    const p = await createProduct(B, { name: 'Puerta', stock: 1 })
    await adjustStock(p.id, -3, 'sale')
    await expect(updateProduct(p.id, { name: 'Puerta de cedro' })).resolves.toMatchObject({ stock: -2 })
    await expect(updateProduct(p.id, { stock: -1 })).rejects.toThrow(/negativa/)
    await expect(updateProduct(p.id, { stock: 0 })).resolves.toMatchObject({ stock: 0 })
  })

  it('borrar archiva el producto y conserva su historial', async () => {
    const p = await createProduct(B, { name: 'Cajón', stock: 3 })
    await deleteProduct(p.id)
    expect(await getProduct(p.id)).toBeUndefined()
    expect(await listProducts(B)).toHaveLength(0)
    expect((await db.product.get(p.id))?.deletedAt).toBeTruthy()
    expect(await stockHistory(p.id)).toHaveLength(1)
    await expect(updateProduct(p.id, { stock: 1 })).rejects.toThrow(/no existe/)
  })
})

describe('stock bajo', () => {
  it('clasifica el estado del stock', () => {
    expect(stockStatus({ stock: 0, minStock: 0 })).toBe('out')
    expect(stockStatus({ stock: -2, minStock: 5 })).toBe('out')
    expect(stockStatus({ stock: 2, minStock: 2 })).toBe('low')
    expect(stockStatus({ stock: 3, minStock: 2 })).toBe('ok')
    expect(stockStatus({ stock: 1, minStock: 0 })).toBe('ok')
  })

  it('resume el inventario', async () => {
    await createProduct(B, { name: 'A', stock: 2, minStock: 5, costCents: 1000 })
    await createProduct(B, { name: 'B', stock: 10, minStock: 5, costCents: 250 })
    await createProduct(B, { name: 'C', stock: 0, costCents: 999 })
    expect(summarize(await listProducts(B))).toEqual({ count: 3, restock: 2, costValueCents: 4500 })
  })
})

describe('lista y búsqueda', () => {
  it('filtra por texto sin acentos, código, categoría y reabastecer', async () => {
    const muebles = await ensureCategory(B, 'product', 'Muebles')
    await createProduct(B, { name: 'Silla de pino', categoryId: muebles.id, stock: 1, minStock: 3 })
    await createProduct(B, { name: 'Escritorio', categoryId: muebles.id, stock: 9 })
    await createProduct(B, { name: 'Lija', barcode: '7501', stock: 50 })
    await createProduct('otro', { name: 'Silla ajena' })

    expect((await listProducts(B)).map((p) => p.name)).toEqual(['Escritorio', 'Lija', 'Silla de pino'])
    expect((await listProducts(B, { search: 'SILLA' })).map((p) => p.name)).toEqual(['Silla de pino'])
    expect((await listProducts(B, { search: 'escritório' })).map((p) => p.name)).toEqual(['Escritorio'])
    expect((await listProducts(B, { search: '7501' })).map((p) => p.name)).toEqual(['Lija'])
    expect(await listProducts(B, { categoryId: muebles.id })).toHaveLength(2)
    expect((await listProducts(B, { onlyRestock: true })).map((p) => p.name)).toEqual(['Silla de pino'])
  })
})

describe('categorías', () => {
  it('no duplica categorías con el mismo nombre', async () => {
    const a = await ensureCategory(B, 'product', 'Herrajes')
    const b = await ensureCategory(B, 'product', ' herrajes ')
    expect(b.id).toBe(a.id)
    await ensureCategory(B, 'expense', 'Herrajes')
    await ensureCategory(B, 'product', 'Barnices')
    expect((await listCategories(B, 'product')).map((c) => c.name)).toEqual(['Barnices', 'Herrajes'])
    await expect(ensureCategory(B, 'product', ' ')).rejects.toThrow()
  })
})

describe('productos sobre pedido', () => {
  it('no llevan stock: vender no lo mueve, nunca salen agotados ni piden reabastecer', async () => {
    const { createSale } = await import('./transactions')
    const p = await createProduct(B, { name: 'Cocina integral', priceCents: 3000000, madeToOrder: true })
    expect(stockStatus(p)).toBe('ok')
    await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 3000000 }] })
    expect((await db.product.get(p.id))!.stock).toBe(0)
    expect(await listProducts(B, { onlyRestock: true })).toEqual([])
    const back = await updateProduct(p.id, { madeToOrder: false })
    expect(back.madeToOrder).toBeUndefined()
    expect(stockStatus(back)).toBe('out')
  })
})
