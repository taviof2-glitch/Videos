import Dexie, { type EntityTable } from 'dexie'
import type { Business, Category, Contact, Meta, Payment, Product, StockMovement, Transaction, TransactionItem } from './types'

class AppDB extends Dexie {
  business!: EntityTable<Business, 'id'>
  meta!: EntityTable<Meta, 'key'>
  category!: EntityTable<Category, 'id'>
  contact!: EntityTable<Contact, 'id'>
  // `txn` y no `transaction`: Dexie ya tiene un método db.transaction().
  txn!: EntityTable<Transaction, 'id'>
  txnItem!: EntityTable<TransactionItem, 'id'>
  payment!: EntityTable<Payment, 'id'>
  product!: EntityTable<Product, 'id'>
  stockMovement!: EntityTable<StockMovement, 'id'>

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
  }
}

export const db = new AppDB()
