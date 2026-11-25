import { beforeEach, describe, expect, it } from 'vitest'
import { balanceForRange } from './balance'
import { listCategories } from './categories'
import { createContact, deleteContact } from './contacts'
import { addPayment, contactBalance, contactDebts, voidPayment } from './debts'
import { db } from './db'
import { createProduct, getProduct, stockFromMovements, stockHistory, updateProduct } from './products'
import { createPurchase, getPurchase, getPurchaseItems, listPurchases, voidPurchase, weightedCost, PURCHASE_CATEGORY } from './purchases'
import { createExpense, getTransaction, updateExpense, voidTransaction } from './transactions'

const B = 'negocio-1'

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const proveedor = (name = 'Maderería Sur') => createContact(B, 'supplier', { name })
const silla = (stock = 10, costCents = 40000) => createProduct(B, { name: 'Silla', priceCents: 85000, costCents, stock })
const stockOf = async (id: string) => (await getProduct(id))!.stock
const costOf = async (id: string) => (await getProduct(id))!.costCents

describe('costo promedio ponderado', () => {
  it('mezcla lo que hay con lo que entra; sin existencias, el costo es el de la compra', () => {
    expect(weightedCost(10, 40000, 10, 60000)).toBe(50000)
    expect(weightedCost(10, 40000, 30, 40000)).toBe(40000)
    expect(weightedCost(0, 40000, 5, 70000)).toBe(70000)
    expect(weightedCost(-3, 40000, 5, 70000)).toBe(70000)
    expect(weightedCost(3, 100, 1, 101)).toBe(100) // 100.25 → 100: un solo redondeo
    expect(weightedCost(1, 100, 1, 101)).toBe(101) // 100.5 → 101
  })
})

describe('registrar una compra de contado', () => {
  it('sube el stock, actualiza el costo y crea el gasto por el total', async () => {
    const p = await silla(10, 40000)
    const prov = await proveedor()
    const compra = await createPurchase(B, { supplierId: prov.id, items: [{ productId: p.id, quantity: 10, unitCostCents: 60000 }], paymentMethod: 'transfer', date: '2026-03-02T15:00:00.000Z' })
    expect(compra).toMatchObject({ supplierId: prov.id, totalCents: 600000, date: '2026-03-02T15:00:00.000Z' })
    expect(await stockOf(p.id)).toBe(20)
    expect(await stockFromMovements(p.id)).toBe(20)
    expect(await costOf(p.id)).toBe(50000)
    expect((await getProduct(p.id))!.priceCents).toBe(85000) // el precio de venta no cambia
    const move = (await stockHistory(p.id))[0]
    expect(move).toMatchObject({ delta: 10, reason: 'purchase', transactionId: compra.transactionId })
    const gasto = (await getTransaction(compra.transactionId))!
    expect(gasto).toMatchObject({ type: 'expense', amountCents: 600000, status: 'paid', paymentMethod: 'transfer', contactId: prov.id, purchaseId: compra.id, concept: 'Compra: Silla ×10' })
    expect((await listCategories(B, 'expense')).find((c) => c.id === gasto.categoryId)!.name).toBe(PURCHASE_CATEGORY)
    expect((await balanceForRange(B)).expenseCents).toBe(600000) // cuenta como egreso al contado
    expect(await getPurchaseItems(compra.id)).toMatchObject([{ name: 'Silla', quantity: 10, unitCostCents: 60000, costBeforeCents: 40000, costAfterCents: 50000 }])
  })

  it('funciona sin proveedor y reutiliza la categoría de compras', async () => {
    const p = await silla()
    await createPurchase(B, { items: [{ productId: p.id, quantity: 1, unitCostCents: 100 }] })
    await createPurchase(B, { items: [{ productId: p.id, quantity: 1, unitCostCents: 100 }] })
    expect((await listCategories(B, 'expense')).filter((c) => c.name === PURCHASE_CATEGORY)).toHaveLength(1)
    expect((await listPurchases(B))[0].supplierId).toBeUndefined()
  })

  it('varias líneas, incluso del mismo producto, acumulan stock y costo en orden', async () => {
    const a = await silla(10, 400)
    const b = await createProduct(B, { name: 'Mesa', stock: 0, costCents: 0 })
    const c = await createPurchase(B, {
      items: [
        { productId: a.id, quantity: 10, unitCostCents: 600 }, // 10@400 + 10@600 → 500
        { productId: b.id, quantity: 2, unitCostCents: 2500 },
        { productId: a.id, quantity: 20, unitCostCents: 800 }, // 20@500 + 20@800 → 650
      ],
    })
    expect(c.totalCents).toBe(10 * 600 + 2 * 2500 + 20 * 800)
    expect(await stockOf(a.id)).toBe(40)
    expect(await costOf(a.id)).toBe(650)
    expect(await stockOf(b.id)).toBe(2)
    expect(await costOf(b.id)).toBe(2500)
    expect((await getPurchaseItems(c.id)).map((i) => i.name)).toEqual(['Silla', 'Mesa', 'Silla'])
    await expect(stockFromMovements(a.id)).resolves.toBe(40)
  })

  it('valida y no deja nada a medias', async () => {
    const p = await silla()
    const prov = await proveedor()
    const ok = { productId: p.id, quantity: 1, unitCostCents: 100 }
    await expect(createPurchase(B, { items: [] })).rejects.toThrow(/al menos un producto/)
    await expect(createPurchase(B, { items: [{ ...ok, quantity: 0 }] })).rejects.toThrow(/cantidad/)
    await expect(createPurchase(B, { items: [{ ...ok, unitCostCents: -1 }] })).rejects.toThrow(/costo/)
    await expect(createPurchase(B, { items: [{ ...ok, unitCostCents: 1.5 }] })).rejects.toThrow(/costo/)
    await expect(createPurchase(B, { items: [{ ...ok, unitCostCents: 0 }] })).rejects.toThrow(/mayor que cero/) // total 0
    await expect(createPurchase(B, { items: [ok, { ...ok, productId: 'nope' }] })).rejects.toThrow(/ya no existe/)
    await expect(createPurchase(B, { supplierId: 'nope', items: [ok] })).rejects.toThrow(/proveedor/)
    const cliente = await createContact(B, 'customer', { name: 'Cliente' })
    await expect(createPurchase(B, { supplierId: cliente.id, items: [ok] })).rejects.toThrow(/proveedor/)
    await expect(createPurchase(B, { supplierId: prov.id, items: [ok], date: 'ayer' })).rejects.toThrow(/fecha/)
    const ajeno = await createProduct('otro', { name: 'Ajeno' })
    await expect(createPurchase(B, { items: [{ ...ok, productId: ajeno.id }] })).rejects.toThrow(/ya no existe/)
    expect(await stockOf(p.id)).toBe(10)
    expect(await costOf(p.id)).toBe(40000)
    for (const t of ['purchase', 'purchaseItem', 'txn'] as const) expect(await db.table(t).count()).toBe(0)
  })
})

describe('compra a crédito con el proveedor', () => {
  it('exige proveedor, crea la deuda por pagar y no es egreso hasta pagarla', async () => {
    const p = await silla()
    const prov = await proveedor()
    const item = { productId: p.id, quantity: 5, unitCostCents: 10000 }
    await expect(createPurchase(B, { items: [item], credit: true })).rejects.toThrow(/proveedor/)
    expect(await stockOf(p.id)).toBe(10) // el error no sube stock
    const c = await createPurchase(B, { supplierId: prov.id, items: [item], credit: true, dueDate: '2026-07-01' })
    expect(await stockOf(p.id)).toBe(15)
    expect(await contactBalance(prov.id)).toBe(50000)
    expect((await getTransaction(c.transactionId))).toMatchObject({ status: 'credit', dueDate: '2026-07-01' })
    expect((await balanceForRange(B)).expenseCents).toBe(0)
    await addPayment(prov.id, 20000)
    expect((await balanceForRange(B)).expenseCents).toBe(20000)
    expect(await contactBalance(prov.id)).toBe(30000)
    await expect(deleteContact(prov.id)).rejects.toThrow(/saldo pendiente/)
  })
})

describe('anular una compra', () => {
  it('baja el stock, restaura el costo y anula el gasto', async () => {
    const p = await silla(10, 40000)
    const c = await createPurchase(B, { items: [{ productId: p.id, quantity: 10, unitCostCents: 60000 }] })
    await voidPurchase(c.id)
    expect(await stockOf(p.id)).toBe(10)
    expect(await stockFromMovements(p.id)).toBe(10)
    expect(await costOf(p.id)).toBe(40000)
    expect((await stockHistory(p.id))[0]).toMatchObject({ delta: -10, reason: 'void', transactionId: c.transactionId })
    expect(await getPurchase(c.id)).toBeUndefined()
    expect(await getTransaction(c.transactionId)).toBeUndefined()
    expect(await listPurchases(B)).toHaveLength(0)
    expect((await balanceForRange(B)).expenseCents).toBe(0)
    await expect(voidPurchase(c.id)).rejects.toThrow(/no existe/)
    expect(await stockOf(p.id)).toBe(10) // anular dos veces no baja dos veces
  })

  it('con varias líneas del mismo producto restaura el costo original', async () => {
    const p = await silla(10, 400)
    const c = await createPurchase(B, { items: [{ productId: p.id, quantity: 10, unitCostCents: 600 }, { productId: p.id, quantity: 20, unitCostCents: 800 }] })
    expect(await costOf(p.id)).toBe(650)
    await voidPurchase(c.id)
    expect(await costOf(p.id)).toBe(400)
    expect(await stockOf(p.id)).toBe(10)
  })

  it('si el costo cambió después, no se pisa', async () => {
    const p = await silla(10, 40000)
    const c = await createPurchase(B, { items: [{ productId: p.id, quantity: 10, unitCostCents: 60000 }] })
    await updateProduct(p.id, { costCents: 99900 })
    await voidPurchase(c.id)
    expect(await costOf(p.id)).toBe(99900)
  })

  it('puede dejar el stock en negativo si ya se vendió lo comprado', async () => {
    const p = await silla(0, 40000)
    const c = await createPurchase(B, { items: [{ productId: p.id, quantity: 5, unitCostCents: 50000 }] })
    const { adjustStock } = await import('./products')
    await adjustStock(p.id, -4, 'sale') // se vendieron 4
    await voidPurchase(c.id)
    expect(await stockOf(p.id)).toBe(-4)
  })

  it('a crédito con pagos: primero se anulan los pagos, sin tocar el stock mientras tanto', async () => {
    const p = await silla(10)
    const prov = await proveedor()
    const c = await createPurchase(B, { supplierId: prov.id, items: [{ productId: p.id, quantity: 5, unitCostCents: 10000 }], credit: true })
    const batch = await addPayment(prov.id, 10000)
    await expect(voidPurchase(c.id)).rejects.toThrow(/anula los pagos hechos al proveedor/)
    expect(await stockOf(p.id)).toBe(15)
    expect(await getPurchase(c.id)).toBeTruthy()
    await voidPayment(batch)
    await voidPurchase(c.id)
    expect(await stockOf(p.id)).toBe(10)
    expect((await contactDebts(prov.id))).toHaveLength(0)
  })
})

describe('el gasto de una compra no se toca por fuera', () => {
  it('no se edita ni se borra directamente, pero un gasto normal sí', async () => {
    const p = await silla()
    const c = await createPurchase(B, { items: [{ productId: p.id, quantity: 1, unitCostCents: 100 }] })
    await expect(updateExpense(c.transactionId, { amountCents: 5 })).rejects.toThrow(/viene de una compra/)
    await expect(voidTransaction(c.transactionId)).rejects.toThrow(/viene de una compra/)
    expect(await stockOf(p.id)).toBe(11) // sin efectos
    const normal = await createExpense(B, { amountCents: 100 })
    await expect(updateExpense(normal.id, { amountCents: 200 })).resolves.toBeTruthy()
    await expect(voidTransaction(normal.id)).resolves.toBeUndefined()
  })
})

describe('lista', () => {
  it('más recientes primero y separada por negocio', async () => {
    const p = await silla()
    const otro = await createProduct('otro', { name: 'X', stock: 0 })
    const item = { productId: p.id, quantity: 1, unitCostCents: 100 }
    const a = await createPurchase(B, { items: [item], date: '2026-03-01T12:00:00.000Z' })
    const b = await createPurchase(B, { items: [item], date: '2026-03-05T12:00:00.000Z' })
    await createPurchase('otro', { items: [{ productId: otro.id, quantity: 1, unitCostCents: 5 }] })
    expect((await listPurchases(B)).map((x) => x.id)).toEqual([b.id, a.id])
  })
})
