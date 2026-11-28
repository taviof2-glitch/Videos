import { decodeOrderCode } from './orderCode'
import { shortId } from './catalog'
import { db } from './db'
import { docNumber, isLinked } from './folio'
import { actorId } from './team'
import { listProducts, unitPrice } from './products'
import { roundQty } from './quantity'
import { createSale, lineTotal, voidLinkedTransaction } from './transactions'
import type { Order, OrderItem, OrderStatus, PaymentMethod, Transaction } from './types'

export type OrderItemInput = { productId: string; variantId?: string; quantity: number; unitPriceCents: number; name?: string }
export type OrderInput = { customerName?: string; notes?: string; items: OrderItemInput[]; source?: Order['source'] }

const STORES = () => [db.order, db.orderItem, db.product, db.productVariant, db.stockMovement, db.txn, db.txnItem, db.payment, db.contact]

type Line = Omit<OrderItem, 'id' | 'orderId'>

async function buildLines(businessId: string, items: OrderItemInput[]): Promise<Line[]> {
  if (items.length === 0) throw new Error('Agrega al menos un producto')
  const lines: Line[] = []
  for (const [position, it] of items.entries()) {
    const quantity = roundQty(it.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('La cantidad debe ser mayor que cero')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0) throw new Error('El precio no es válido')
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
    lines.push({ position, productId: p.id, ...(it.variantId && { variantId: it.variantId }), name: it.name?.trim() || (variantName ? `${p.name} (${variantName})` : p.name), quantity, unitPriceCents: it.unitPriceCents })
  }
  return lines
}

const totalOf = (lines: Line[]) => lines.reduce((sum, l) => sum + lineTotal(l.quantity, l.unitPriceCents), 0)

export async function createOrder(businessId: string, input: OrderInput): Promise<Order> {
  const pending = await isLinked(businessId)
  const by = await actorId(businessId)
  return db.transaction('rw', STORES(), async () => {
    const lines = await buildLines(businessId, input.items)
    const last = await db.order.where('[businessId+number]').between([businessId, 0], [businessId, Number.MAX_SAFE_INTEGER]).last()
    const now = new Date().toISOString()
    const order: Order = {
      id: crypto.randomUUID(), businessId, number: (last?.number ?? 0) + 1, ...(pending && { numberPending: true }), ...(by && { createdBy: by }), customerName: input.customerName?.trim() ?? '', notes: input.notes?.trim() ?? '',
      status: 'pending', totalCents: totalOf(lines), source: input.source ?? 'manual', createdAt: now, updatedAt: now,
    }
    await db.order.add(order)
    await db.orderItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), orderId: order.id })))
    return order
  })
}

async function liveOrder(id: string): Promise<Order> {
  const o = await db.order.get(id)
  if (!o || o.deletedAt) throw new Error('El pedido no existe')
  return o
}

const OPEN: OrderStatus[] = ['pending', 'processing']

/** Reemplaza los datos y los productos. Solo mientras el pedido sigue abierto (pendiente o en proceso). */
export async function updateOrder(id: string, input: OrderInput): Promise<Order> {
  return db.transaction('rw', STORES(), async () => {
    const old = await liveOrder(id)
    if (!OPEN.includes(old.status)) throw new Error(old.status === 'paid' ? 'Ya está pagado: cancélalo para cambiarlo' : 'Reabre el pedido para editarlo')
    const lines = await buildLines(old.businessId, input.items)
    const next: Order = { ...old, customerName: input.customerName?.trim() ?? '', notes: input.notes?.trim() ?? '', totalCents: totalOf(lines), updatedAt: new Date().toISOString() }
    await db.orderItem.where({ orderId: id }).delete()
    await db.orderItem.bulkAdd(lines.map((l) => ({ ...l, id: crypto.randomUUID(), orderId: id })))
    await db.order.put(next)
    return next
  })
}

/** Pendiente ↔ en proceso. Cobrar y cancelar tienen sus propias funciones. */
export async function setOrderStatus(id: string, status: 'pending' | 'processing'): Promise<void> {
  const o = await liveOrder(id)
  if (!OPEN.includes(o.status)) throw new Error('Solo un pedido abierto pasa de pendiente a en proceso')
  await db.order.update(id, { status, updatedAt: new Date().toISOString() })
}

export type PayOrderOptions = { method?: PaymentMethod; contactId?: string; date?: string }

/**
 * Cobra el pedido: crea la venta de contado con sus productos (entra al balance y baja el inventario) y lo marca pagado.
 * Todo o nada: si un producto ya no existe, el pedido sigue abierto.
 */
export async function payOrder(id: string, opts: PayOrderOptions = {}): Promise<{ order: Order; sale: Transaction }> {
  const by = await actorId((await db.order.get(id))?.businessId ?? '')
  return db.transaction('rw', STORES(), async () => {
    const o = await liveOrder(id)
    if (!OPEN.includes(o.status)) throw new Error(o.status === 'paid' ? 'El pedido ya está pagado' : 'Reabre el pedido para cobrarlo')
    const items = await getOrderItems(id)
    const sale = await createSale(o.businessId, {
      items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, name: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
      concept: o.customerName ? `Pedido ${docNumber(o)} · ${o.customerName}` : `Pedido ${docNumber(o)}`,
      paymentMethod: opts.method, contactId: opts.contactId, date: opts.date, orderId: o.id, createdBy: by,
    })
    const order: Order = { ...o, status: 'paid', transactionId: sale.id, updatedAt: new Date().toISOString() }
    await db.order.put(order)
    return { order, sale }
  })
}

/** Cancela el pedido. Si ya estaba pagado, también anula su venta: el inventario vuelve y el dinero sale del balance. */
export async function cancelOrder(id: string): Promise<void> {
  await db.transaction('rw', STORES(), async () => {
    const o = await liveOrder(id)
    if (o.status === 'cancelled') throw new Error('El pedido ya está cancelado')
    if (o.status === 'paid' && o.transactionId) await voidLinkedTransaction(o.transactionId)
    await db.order.update(id, { status: 'cancelled', transactionId: undefined, updatedAt: new Date().toISOString() })
  })
}

export async function reopenOrder(id: string): Promise<void> {
  const o = await liveOrder(id)
  if (o.status !== 'cancelled') throw new Error('Solo un pedido cancelado se reabre')
  await db.order.update(id, { status: 'pending', updatedAt: new Date().toISOString() })
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const o = await db.order.get(id)
  return o && !o.deletedAt ? o : undefined
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  return (await db.orderItem.where({ orderId }).toArray()).sort((a, b) => a.position - b.position)
}

/** Pedidos vivos del negocio, el más reciente primero. */
export async function listOrders(businessId: string): Promise<Order[]> {
  const rows = await db.order.where('[businessId+status]').between([businessId, ''], [businessId, '￿']).filter((o) => !o.deletedAt).toArray()
  return rows.sort((a, b) => b.number - a.number)
}

export type OrderDraft = { input: OrderInput; unmatched: string[] }

/**
 * Arma un pedido a partir del mensaje que mandó el cliente desde el catálogo. Los productos se encuentran por su id corto;
 * el precio es el que vio el cliente. Lo que ya no existe se avisa en `unmatched` y no se incluye.
 */
export async function orderDraftFromMessage(businessId: string, text: string): Promise<OrderDraft> {
  const decoded = decodeOrderCode(text)
  if (!decoded.ok) throw new Error(decoded.error)
  const products = await listProducts(businessId)
  const items: OrderItemInput[] = []
  const unmatched: string[] = []
  for (const it of decoded.payload.i) {
    const p = products.find((x) => shortId(x.id) === it.p)
    if (!p) {
      unmatched.push(`Un producto del pedido ya no está en tu inventario (código ${it.p}).`)
      continue
    }
    const v = it.v ? p.variants?.find((x) => shortId(x.id) === it.v) : undefined
    if (p.hasVariants && !v) {
      unmatched.push(`"${p.name}": la variante que pidió el cliente ya no existe.`)
      continue
    }
    items.push({ productId: p.id, variantId: v?.id, quantity: it.q, unitPriceCents: it.c, name: v ? `${p.name} (${v.name})` : p.name })
  }
  if (items.length === 0) throw new Error('Ninguno de los productos del pedido existe ya en tu inventario.')
  return { input: { customerName: decoded.payload.n, notes: decoded.payload.m, items, source: 'catalog' }, unmatched }
}

/** El precio actual de un producto o variante, para avisar si cambió desde que el cliente pidió. */
export { unitPrice }
