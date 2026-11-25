import { ensureCategory } from './categories'
import { db } from './db'
import { adjustStock, unitCost } from './products'
import { roundQty } from './quantity'
import { autoConcept, createExpense, lineTotal, voidLinkedTransaction } from './transactions'
import type { PaymentMethod, Purchase, PurchaseItem } from './types'

export type PurchaseItemInput = {
  productId: string
  /** Obligatorio si el producto tiene variantes: el costo promedio se lleva por variante. */
  variantId?: string
  quantity: number
  /** Lo que se pagó por unidad, en centavos. */
  unitCostCents: number
}

export type PurchaseInput = {
  supplierId?: string
  items: PurchaseItemInput[]
  date?: string
  paymentMethod?: PaymentMethod
  /** A crédito: exige proveedor y se paga con abonos (ver debts.ts). */
  credit?: boolean
  dueDate?: string
  notes?: string
}

export const PURCHASE_CATEGORY = 'Compras de mercancía'

const STORES = () => [db.purchase, db.purchaseItem, db.product, db.productVariant, db.stockMovement, db.txn, db.txnItem, db.payment, db.category, db.contact]

/**
 * Costo del producto tras comprar `qty` a `unitCost`: promedio ponderado con lo que ya hay.
 * Sin existencias (o en negativo) el costo es el de la compra. Un solo redondeo.
 */
export function weightedCost(stock: number, currentCost: number, qty: number, unitCost: number): number {
  if (stock <= 0) return unitCost
  return Math.round((stock * currentCost + qty * unitCost) / (stock + qty))
}

/**
 * Registra una compra: sube el stock de cada producto, actualiza su costo (promedio ponderado) y crea
 * el gasto por el total (al contado, o a crédito con el proveedor). Todo o nada.
 */
export async function createPurchase(businessId: string, input: PurchaseInput): Promise<Purchase> {
  return db.transaction('rw', STORES(), async () => {
    if (input.items.length === 0) throw new Error('Agrega al menos un producto')
    if (input.supplierId) {
      const s = await db.contact.get(input.supplierId)
      if (!s || s.deletedAt || s.businessId !== businessId || s.type !== 'supplier') throw new Error('Elige un proveedor')
    }
    // Primero se valida todo, para no dejar nada a medias.
    const checked: { productId: string; variantId?: string; name: string; quantity: number; unitCostCents: number }[] = []
    for (const it of input.items) {
      const quantity = roundQty(it.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
      if (!Number.isInteger(it.unitCostCents) || it.unitCostCents < 0) throw new Error('El costo no es válido')
      const p = await db.product.get(it.productId)
      if (!p || p.deletedAt || p.businessId !== businessId) throw new Error('Uno de los productos ya no existe')
      let variantName = ''
      if (it.variantId) {
        const v = await db.productVariant.get(it.variantId)
        if (!v || v.deletedAt || v.productId !== p.id) throw new Error('Una de las variantes ya no existe')
        variantName = v.name
      } else if (p.hasVariants) {
        throw new Error(`Elige la variante de "${p.name}"`)
      }
      checked.push({ productId: p.id, variantId: it.variantId, name: variantName ? `${p.name} (${variantName})` : p.name, quantity, unitCostCents: it.unitCostCents })
    }
    const totalCents = checked.reduce((sum, l) => sum + lineTotal(l.quantity, l.unitCostCents), 0)

    const purchaseId = crypto.randomUUID()
    const category = await ensureCategory(businessId, 'expense', PURCHASE_CATEGORY)
    const expense = await createExpense(businessId, {
      amountCents: totalCents, concept: `Compra: ${autoConcept(checked)}`, categoryId: category.id, paymentMethod: input.paymentMethod,
      date: input.date, contactId: input.supplierId, credit: input.credit, dueDate: input.dueDate, purchaseId,
    })

    const lines: Omit<PurchaseItem, 'id' | 'purchaseId'>[] = []
    for (const [position, l] of checked.entries()) {
      // se vuelve a leer: varias líneas del mismo producto (o variante) se acumulan
      const p = (await db.product.get(l.productId))!
      const v = l.variantId ? (await db.productVariant.get(l.variantId))! : undefined
      const costBeforeCents = unitCost(p, v)
      const costAfterCents = weightedCost(v ? v.stock : p.stock, costBeforeCents, l.quantity, l.unitCostCents)
      await adjustStock(p.id, l.quantity, 'purchase', expense.id, v?.id)
      if (v) await db.productVariant.update(v.id, { costCents: costAfterCents })
      else await db.product.update(p.id, { costCents: costAfterCents })
      lines.push({ position, productId: p.id, ...(v && { variantId: v.id }), name: l.name, quantity: l.quantity, unitCostCents: l.unitCostCents, costBeforeCents, costAfterCents })
    }

    const now = new Date().toISOString()
    const purchase: Purchase = {
      id: purchaseId, businessId, supplierId: input.supplierId || undefined, date: expense.date, totalCents, transactionId: expense.id,
      notes: input.notes?.trim() ?? '', createdAt: now, updatedAt: now,
    }
    await db.purchase.add(purchase)
    await db.purchaseItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), purchaseId })))
    return purchase
  })
}

/**
 * Anula una compra: el stock vuelve a bajar, el costo del producto se restaura si nadie lo ha cambiado
 * desde entonces, y el gasto se anula. Si el gasto era a crédito y ya tiene pagos, primero hay que anularlos.
 */
export async function voidPurchase(id: string): Promise<void> {
  await db.transaction('rw', STORES(), async () => {
    const purchase = await db.purchase.get(id)
    if (!purchase || purchase.deletedAt) throw new Error('La compra no existe')
    const paid = await db.payment.where({ transactionId: purchase.transactionId }).filter((p) => !p.deletedAt).count()
    if (paid > 0) throw new Error('Primero anula los pagos hechos al proveedor')
    await voidLinkedTransaction(purchase.transactionId) // se anula antes de tocar el stock
    const items = await getPurchaseItems(id)
    for (const i of [...items].reverse()) {
      await adjustStock(i.productId, -i.quantity, 'void', purchase.transactionId, i.variantId)
      if (i.variantId) {
        const v = await db.productVariant.get(i.variantId)
        if (v && v.costCents === i.costAfterCents) await db.productVariant.update(v.id, { costCents: i.costBeforeCents })
      } else {
        const p = await db.product.get(i.productId)
        if (p && p.costCents === i.costAfterCents) await db.product.update(i.productId, { costCents: i.costBeforeCents })
      }
    }
    const now = new Date().toISOString()
    await db.purchase.update(id, { deletedAt: now, updatedAt: now })
  })
}

export async function getPurchase(id: string): Promise<Purchase | undefined> {
  const p = await db.purchase.get(id)
  return p && !p.deletedAt ? p : undefined
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  return (await db.purchaseItem.where({ purchaseId }).toArray()).sort((a, b) => a.position - b.position)
}

/** Compras vivas del negocio, las más recientes primero. */
export async function listPurchases(businessId: string): Promise<Purchase[]> {
  const rows = await db.purchase.where('[businessId+date]').between([businessId, ''], [businessId, '￿']).filter((p) => !p.deletedAt).toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export type PurchaseRow = { purchase: Purchase; concept: string; credit: boolean }

/** Las compras con el concepto de su gasto y si fueron a crédito, para la lista. */
export async function listPurchaseRows(businessId: string): Promise<PurchaseRow[]> {
  const purchases = await listPurchases(businessId)
  const txns = await db.txn.bulkGet(purchases.map((p) => p.transactionId))
  return purchases.map((purchase, i) => ({ purchase, concept: txns[i]?.concept ?? 'Compra', credit: txns[i]?.status === 'credit' }))
}
