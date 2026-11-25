import Dexie, { type EntityTable } from 'dexie'
import { outboxMiddleware } from '../sync/outbox'
import type { OutboxEntry, SyncStateRow } from '../sync/tables'
import type { Business, Category, Contact, Employee, Meta, Order, OrderItem, Payment, Product, ProductVariant, Purchase, PurchaseItem, Quote, QuoteItem, StockMovement, Transaction, TransactionItem } from './types'

export class AppDB extends Dexie {
  business!: EntityTable<Business, 'id'>
  meta!: EntityTable<Meta, 'key'>
  category!: EntityTable<Category, 'id'>
  contact!: EntityTable<Contact, 'id'>
  // `txn` y no `transaction`: Dexie ya tiene un método db.transaction().
  txn!: EntityTable<Transaction, 'id'>
  txnItem!: EntityTable<TransactionItem, 'id'>
  payment!: EntityTable<Payment, 'id'>
  quote!: EntityTable<Quote, 'id'>
  order!: EntityTable<Order, 'id'>
  orderItem!: EntityTable<OrderItem, 'id'>
  purchase!: EntityTable<Purchase, 'id'>
  purchaseItem!: EntityTable<PurchaseItem, 'id'>
  quoteItem!: EntityTable<QuoteItem, 'id'>
  product!: EntityTable<Product, 'id'>
  productVariant!: EntityTable<ProductVariant, 'id'>
  stockMovement!: EntityTable<StockMovement, 'id'>
  // T15: solo de este dispositivo (ni se sincronizan ni van en la copia de seguridad).
  employee!: EntityTable<Employee, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>
  syncState!: EntityTable<SyncStateRow, 'key'>

  // El nombre interno 'mi-negocio' se conserva aunque la app ahora se llame Houselite: cambiarlo dejaría sin acceso los datos ya guardados.
  constructor(name = 'mi-negocio') {
    super(name)
    // Versión 1: solo negocio. Las demás tablas se añaden en sus tareas (T2+),
    // siempre con una versión nueva para no perder datos.
    this.version(1).stores({
      business: 'id',
      meta: 'key',
    })
    // Versión 2 (T2): inventario.
    this.version(2).stores({
      category: 'id, [businessId+kind]',
      product: 'id, [businessId+name], [businessId+barcode], categoryId',
      stockMovement: 'id, productId, transactionId, [productId+createdAt]',
    })
    // Versión 3 (T3): clientes y proveedores.
    this.version(3).stores({
      contact: 'id, [businessId+type], name, phone',
    })
    // Versión 4 (T4): ventas y gastos.
    this.version(4).stores({
      txn: 'id, [businessId+date], [businessId+type], contactId, status',
      txnItem: 'id, transactionId, productId',
    })
    // Versión 5 (T6): abonos y pagos de deudas.
    this.version(5).stores({
      payment: 'id, transactionId, contactId, batchId, [businessId+date]',
    })
    // Versión 6 (T8): cotizaciones.
    this.version(6).stores({
      quote: 'id, [businessId+status], [businessId+number], contactId',
      quoteItem: 'id, quoteId',
    })
    // Versión 7 (T9): compras a proveedores.
    this.version(7).stores({
      purchase: 'id, [businessId+date], supplierId, transactionId',
      purchaseItem: 'id, purchaseId, productId',
    })
    // Versión 8 (T11): variantes de producto.
    this.version(8).stores({
      productVariant: 'id, productId, businessId, [businessId+barcode]',
    })
    // Versión 9 (T12): pedidos.
    this.version(9).stores({
      order: 'id, [businessId+status], [businessId+number]',
      orderItem: 'id, orderId',
    })
    // Versión 10 (T15): cola de cambios por subir y estado de la sincronización.
    this.version(10).stores({
      outbox: '++seq, [tbl+rowId]',
      syncState: 'key',
    })
    // Versión 11 (T13): empleados con PIN.
    this.version(11).stores({
      employee: 'id, businessId',
    })
    // Cada escritura en una tabla sincronizada se anota en `outbox` en la misma transacción.
    this.use(outboxMiddleware)
  }
}

export const db = new AppDB()
