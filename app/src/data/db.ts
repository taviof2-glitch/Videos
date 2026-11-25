import Dexie, { type EntityTable } from 'dexie'
import type { Business, Meta } from './types'

class AppDB extends Dexie {
  business!: EntityTable<Business, 'id'>
  meta!: EntityTable<Meta, 'key'>

  constructor(name = 'mi-negocio') {
    super(name)
    // Versión 1: solo negocio. Las demás tablas se añaden en sus tareas (T2+),
    // siempre con una versión nueva para no perder datos.
    this.version(1).stores({
      business: 'id',
      meta: 'key',
    })
  }
}

export const db = new AppDB()
