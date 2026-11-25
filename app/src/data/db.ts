import Dexie, { type EntityTable } from 'dexie'
import type { Business, Category, Meta, Product, StockMovement } from './types'

class AppDB extends Dexie {
  business!: EntityTable<Business, 'id'>
  meta!: EntityTable<Meta, 'key'>
  category!: EntityTable<Category, 'id'>
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
  }
}

export const db = new AppDB()
