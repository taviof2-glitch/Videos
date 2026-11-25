import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createProduct, getProduct, deleteProduct, stockFromMovements, stockHistory, updateProduct } from './products'
import {
  autoConcept,
  createExpense,
  createSale,
  getItems,
  getTransaction,
  listTransactions,
  saleProfit,
  updateExpense,
  updateSale,
  voidTransaction,
} from './transactions'

const B = 'negocio-1'

beforeEach(async () => {
  await Promise.all([db.txn.clear(), db.txnItem.clear(), db.product.clear(), db.stockMovement.clear()])
})

async function silla(stock = 10) {
  return createProduct(B, { name: 'Silla', priceCents: 85000, costCents: 40000, stock })
}
const stockOf = async (id: string) => (await getProduct(id))!.stock
/** La caché del producto siempre debe coincidir con la suma de sus movimientos. */
async function expectConsistent(id: string) {
  expect(await stockOf(id)).toBe(await stockFromMovements(id))
}

describe('venta rápida', () => {
  it('guarda monto y concepto sin tocar el stock', async () => {
    const p = await silla()
    const s = await createSale(B, { amountCents: 25000, concept: ' Barnizado ', paymentMethod: 'transfer' })
    expect(s).toMatchObject({ type: 'sale', amountCents: 25000, concept: 'Barnizado', paymentMethod: 'transfer', status: 'paid' })
    expect(await getItems(s.id)).toHaveLength(0)
    expect(await stockOf(p.id)).toBe(10)
  })

  it('rechaza monto 0, negativo, decimal o ausente', async () => {
    for (const amountCents of [0, -5, 10.5, undefined]) {
      await expect(createSale(B, { amountCents })).rejects.toThrow(/mayor que cero/)
    }
  })

  it('acepta fecha pasada y rechaza fechas inválidas', async () => {
    const s = await createSale(B, { amountCents: 100, date: '2026-01-05T15:00:00.000Z' })
    expect(s.date).toBe('2026-01-05T15:00:00.000Z')
    await expect(createSale(B, { amountCents: 100, date: 'ayer' })).rejects.toThrow(/fecha/)
  })
})

describe('venta con productos', () => {
  it('calcula el total, congela precio y costo y baja el stock', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 85000 }] })
    expect(s.amountCents).toBe(255000)
    expect(s.concept).toBe('Silla ×3')
    expect(await getItems(s.id)).toMatchObject([{ name: 'Silla', quantity: 3, unitPriceCents: 85000, unitCostCents: 40000 }])
    expect(await stockOf(p.id)).toBe(7)
    const move = (await stockHistory(p.id))[0]
    expect(move).toMatchObject({ delta: -3, reason: 'sale', transactionId: s.id })
    await expectConsistent(p.id)
  })

  it('permite cambiar el precio en la venta sin cambiar el del producto', async () => {
    const p = await silla()
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 70000 }] })
    expect(s.amountCents).toBe(70000)
    expect((await getProduct(p.id))!.priceCents).toBe(85000)
  })

  it('redondea cada línea una sola vez al centavo', async () => {
    const p = await createProduct(B, { name: 'Tabla (m)', stock: 100 })
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2.5, unitPriceCents: 3333 }] })
    expect(s.amountCents).toBe(8333) // 8332.5 -> 8333
  })

  it('vender más de lo que hay deja el stock negativo, sin bloquear', async () => {
    const p = await silla(1)
    await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 100 }] })
    expect(await stockOf(p.id)).toBe(-2)
    await expectConsistent(p.id)
  })

  it('varias líneas del mismo producto descuentan la suma', async () => {
    const p = await silla(10)
    await createSale(B, {
      items: [
        { productId: p.id, quantity: 2, unitPriceCents: 100 },
        { productId: p.id, quantity: 1, unitPriceCents: 90 },
      ],
    })
    expect(await stockOf(p.id)).toBe(7)
    await expectConsistent(p.id)
  })

  it('mezcla productos y líneas libres (las libres no mueven stock)', async () => {
    const p = await silla(5)
    const s = await createSale(B, {
      items: [
        { productId: p.id, quantity: 1, unitPriceCents: 85000 },
        { name: 'Instalación', quantity: 1, unitPriceCents: 30000 },
      ],
    })
    expect(s.amountCents).toBe(115000)
    expect(s.concept).toBe('Silla, Instalación')
    expect(await stockOf(p.id)).toBe(4)
    await expect(createSale(B, { items: [{ quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/nombre/)
  })

  it('valida cantidades, precios y productos, sin dejar nada a medias', async () => {
    const p = await silla(5)
    await expect(createSale(B, { items: [{ productId: p.id, quantity: 0, unitPriceCents: 100 }] })).rejects.toThrow(/cantidad/)
    await expect(createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: -1 }] })).rejects.toThrow(/precio/)
    await expect(createSale(B, { items: [{ productId: 'nope', quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/ya no existe/)
    // el segundo producto falla: el primero no debe haberse descontado
    await expect(
      createSale(B, {
        items: [
          { productId: p.id, quantity: 1, unitPriceCents: 100 },
          { productId: 'nope', quantity: 1, unitPriceCents: 1 },
        ],
      }),
    ).rejects.toThrow()
    expect(await stockOf(p.id)).toBe(5)
    expect(await db.txn.count()).toBe(0)
    expect(await db.txnItem.count()).toBe(0)
  })

  it('no vende productos de otro negocio ni borrados', async () => {
    const ajeno = await createProduct('otro', { name: 'Ajeno', stock: 1 })
    await expect(createSale(B, { items: [{ productId: ajeno.id, quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/ya no existe/)
    const p = await silla()
    await deleteProduct(p.id)
    await expect(createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow(/ya no existe/)
  })

  it('calcula la ganancia con el costo congelado, aunque el costo cambie después', async () => {
    const p = await silla()
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 85000 }] })
    await updateProduct(p.id, { costCents: 99999 })
    expect(saleProfit(await getItems(s.id))).toBe(2 * (85000 - 40000))
  })
})

describe('editar una venta', () => {
  it('devuelve o quita stock por la diferencia', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 100 }] })
    await updateSale(s.id, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }] })
    expect(await stockOf(p.id)).toBe(9)
    await updateSale(s.id, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 100 }] })
    expect(await stockOf(p.id)).toBe(6)
    await expectConsistent(p.id)
    expect((await getTransaction(s.id))!.amountCents).toBe(400)
    expect(await getItems(s.id)).toHaveLength(1)
  })

  it('cambiar de producto devuelve el viejo y descuenta el nuevo', async () => {
    const a = await silla(5)
    const b = await createProduct(B, { name: 'Mesa', stock: 5 })
    const s = await createSale(B, { items: [{ productId: a.id, quantity: 2, unitPriceCents: 100 }] })
    await updateSale(s.id, { items: [{ productId: b.id, quantity: 1, unitPriceCents: 500 }] })
    expect(await stockOf(a.id)).toBe(5)
    expect(await stockOf(b.id)).toBe(4)
    await expectConsistent(a.id)
    await expectConsistent(b.id)
  })

  it('editar solo el método de pago o el concepto no mueve stock', async () => {
    const p = await silla(5)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })
    const movesBefore = await db.stockMovement.count()
    const u = await updateSale(s.id, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }], paymentMethod: 'card', concept: 'Pedido de Ana' })
    expect(u).toMatchObject({ paymentMethod: 'card', concept: 'Pedido de Ana', createdAt: s.createdAt, date: s.date })
    expect(await db.stockMovement.count()).toBe(movesBefore)
  })

  it('conserva el costo que tenía la línea', async () => {
    const p = await silla(5)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }] })
    await updateProduct(p.id, { costCents: 77700 })
    await updateSale(s.id, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })
    expect((await getItems(s.id))[0].unitCostCents).toBe(40000)
  })

  it('pasar de productos a venta rápida devuelve todo el stock', async () => {
    const p = await silla(5)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })
    await updateSale(s.id, { amountCents: 999, concept: 'Trato' })
    expect(await stockOf(p.id)).toBe(5)
    expect(await getItems(s.id)).toHaveLength(0)
  })

  it('se puede editar si un producto se borró después de vender', async () => {
    const p = await silla(5)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })
    await deleteProduct(p.id)
    await expect(updateSale(s.id, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }] })).resolves.toBeTruthy()
    expect(await db.product.get(p.id).then((x) => x!.stock)).toBe(4)
  })

  it('un error al editar deja venta y stock intactos', async () => {
    const p = await silla(5)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }] })
    await expect(updateSale(s.id, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }, { productId: 'nope', quantity: 1, unitPriceCents: 1 }] })).rejects.toThrow()
    expect(await stockOf(p.id)).toBe(3)
    expect((await getItems(s.id))[0].quantity).toBe(2)
  })

  it('solo edita ventas vivas', async () => {
    const g = await createExpense(B, { amountCents: 100 })
    await expect(updateSale(g.id, { amountCents: 5 })).rejects.toThrow(/no existe/)
    const s = await createSale(B, { amountCents: 100 })
    await voidTransaction(s.id)
    await expect(updateSale(s.id, { amountCents: 5 })).rejects.toThrow(/no existe/)
  })
})

describe('concepto automático', () => {
  it('sigue a los productos al editar, pero respeta uno escrito a mano', async () => {
    const p = await silla(10)
    const auto = await createSale(B, { items: [{ productId: p.id, quantity: 3, unitPriceCents: 100 }] })
    expect(auto.concept).toBe(autoConcept(await getItems(auto.id)))
    const edited = await updateSale(auto.id, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }] })
    expect(edited.concept).toBe('Silla')
    const manual = await createSale(B, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 100 }], concept: 'Pedido de Ana' })
    const kept = await updateSale(manual.id, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }], concept: 'Pedido de Ana' })
    expect(kept.concept).toBe('Pedido de Ana')
  })
})

describe('borrar una venta', () => {
  it('devuelve el stock con movimientos y la oculta', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 100 }] })
    await voidTransaction(s.id)
    expect(await stockOf(p.id)).toBe(10)
    await expectConsistent(p.id)
    expect((await stockHistory(p.id))[0]).toMatchObject({ delta: 4, reason: 'void', transactionId: s.id })
    expect(await getTransaction(s.id)).toBeUndefined()
    expect(await listTransactions(B)).toHaveLength(0)
    expect(await getItems(s.id)).toHaveLength(1) // historial conservado
  })

  it('borrar dos veces falla y no devuelve stock dos veces', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 100 }] })
    await voidTransaction(s.id)
    await expect(voidTransaction(s.id)).rejects.toThrow(/no existe/)
    expect(await stockOf(p.id)).toBe(10)
  })

  it('editar y luego borrar deja el stock como al principio', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 100 }] })
    await updateSale(s.id, { items: [{ productId: p.id, quantity: 7, unitPriceCents: 100 }] })
    await voidTransaction(s.id)
    expect(await stockOf(p.id)).toBe(10)
    await expectConsistent(p.id)
  })

  it('funciona aunque el producto se haya archivado', async () => {
    const p = await silla(10)
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 4, unitPriceCents: 100 }] })
    await deleteProduct(p.id)
    await voidTransaction(s.id)
    expect((await db.product.get(p.id))!.stock).toBe(10)
  })

  it('venta rápida: solo se oculta', async () => {
    const s = await createSale(B, { amountCents: 500 })
    await voidTransaction(s.id)
    expect(await listTransactions(B)).toHaveLength(0)
    expect(await db.stockMovement.count()).toBe(0)
  })
})

describe('gastos', () => {
  it('crea, edita y borra', async () => {
    const g = await createExpense(B, { amountCents: 120000, concept: ' Renta del taller ', categoryId: 'cat-1', paymentMethod: 'transfer', contactId: 'prov-1' })
    expect(g).toMatchObject({ type: 'expense', amountCents: 120000, concept: 'Renta del taller', categoryId: 'cat-1', contactId: 'prov-1', status: 'paid' })
    const u = await updateExpense(g.id, { amountCents: 130000, concept: 'Renta', categoryId: '', contactId: '' })
    expect(u).toMatchObject({ amountCents: 130000, categoryId: undefined, contactId: undefined, createdAt: g.createdAt })
    await voidTransaction(g.id)
    expect(await getTransaction(g.id)).toBeUndefined()
  })

  it('exige un monto válido y no toca el stock', async () => {
    await expect(createExpense(B, { amountCents: 0 })).rejects.toThrow(/mayor que cero/)
    await createExpense(B, { amountCents: 100 })
    expect(await db.stockMovement.count()).toBe(0)
  })
})

describe('listado', () => {
  it('ordena por fecha, filtra por tipo y rango, y separa negocios', async () => {
    const a = await createSale(B, { amountCents: 100, date: '2026-03-01T12:00:00.000Z' })
    const b = await createExpense(B, { amountCents: 200, date: '2026-03-03T12:00:00.000Z' })
    const c = await createSale(B, { amountCents: 300, date: '2026-03-02T12:00:00.000Z' })
    await createSale('otro', { amountCents: 999, date: '2026-03-02T12:00:00.000Z' })
    expect((await listTransactions(B)).map((t) => t.id)).toEqual([b.id, c.id, a.id])
    expect((await listTransactions(B, { type: 'sale' })).map((t) => t.id)).toEqual([c.id, a.id])
    expect((await listTransactions(B, { from: '2026-03-02T00:00:00.000Z', to: '2026-03-02T23:59:59.999Z' })).map((t) => t.id)).toEqual([c.id])
    expect(await listTransactions(B, { limit: 2 })).toHaveLength(2)
  })
})
