import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_TABLES, backupFileName, exportBackup, importBackup, lastBackupAt } from './backup'
import { balanceForRange } from './balance'
import { createBusiness, getCurrentBusiness } from './business'
import { createContact } from './contacts'
import { addPayment, contactBalance } from './debts'
import { db } from './db'
import { createProduct, getProduct, stockFromMovements } from './products'
import { createExpense, createSale } from './transactions'

async function clearAll() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
beforeEach(clearAll)

/** Un negocio con de todo: producto con foto, ventas, fiado con abono, gasto a crédito. */
async function seed() {
  const business = await createBusiness({ name: 'Carpintería López', phone: '3312345678' })
  const photo = new Blob([new Uint8Array([0, 1, 2, 250, 251, 255, 128, 64])], { type: 'image/jpeg' })
  const silla = await createProduct(business.id, { name: 'Silla', priceCents: 85000, costCents: 40000, stock: 10, minStock: 2, photos: [photo] })
  const olga = await createContact(business.id, 'customer', { name: 'Olga', phone: '33 1234 5678' })
  const prov = await createContact(business.id, 'supplier', { name: 'Maderería Sur' })
  await createSale(business.id, { items: [{ productId: silla.id, quantity: 3, unitPriceCents: 85000 }], contactId: olga.id, credit: true, dueDate: '2026-07-01' })
  await addPayment(olga.id, 100000)
  await createSale(business.id, { amountCents: 25000, concept: 'Barnizado' })
  await createExpense(business.id, { amountCents: 80000, contactId: prov.id, credit: true })
  return { business, silla, olga }
}

describe('copia de seguridad', () => {
  it('exportar e importar devuelve exactamente lo mismo (fotos incluidas)', async () => {
    const { business, silla, olga } = await seed()
    const balance = await balanceForRange(business.id)
    const text = JSON.stringify(await exportBackup())
    const before = Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async (t) => [t, await db.table(t).count()])))

    await clearAll()
    expect(await getCurrentBusiness()).toBeUndefined()
    const summary = await importBackup(text)

    expect(summary).toEqual({ products: 1, contacts: 2, movements: 3 })
    for (const t of BACKUP_TABLES) expect(await db.table(t).count()).toBe(before[t])
    expect((await getCurrentBusiness())?.name).toBe('Carpintería López')
    expect(await lastBackupAt()).toBeTruthy() // la fecha viaja en la copia
    expect(await balanceForRange(business.id)).toEqual(balance)
    expect(await contactBalance(olga.id)).toBe(255000 - 100000)
    const p = (await getProduct(silla.id))!
    expect(p.stock).toBe(7)
    expect(await stockFromMovements(silla.id)).toBe(7)
    expect(p.photos).toHaveLength(1)
    expect(p.photos[0].type).toBe('image/jpeg')
    expect(Array.from(new Uint8Array(await p.photos[0].arrayBuffer()))).toEqual([0, 1, 2, 250, 251, 255, 128, 64])
  })

  it('importar reemplaza lo que había, no lo mezcla', async () => {
    const { business } = await seed()
    const text = JSON.stringify(await exportBackup())
    await createContact(business.id, 'customer', { name: 'Cliente posterior a la copia' })
    await createSale(business.id, { amountCents: 999 })
    await importBackup(text)
    expect(await db.contact.count()).toBe(2)
    expect(await db.txn.count()).toBe(3)
  })

  it('exportar anota la fecha de la última copia', async () => {
    await seed()
    expect(await lastBackupAt()).toBeUndefined()
    const file = await exportBackup()
    expect(await lastBackupAt()).toBe(file.exportedAt)
    expect(backupFileName('2026-03-05T10:00:00.000Z')).toBe('copia-mi-negocio-2026-03-05.json')
  })

  it('cubre todas las tablas de la base (si falla, añade la nueva a BACKUP_TABLES)', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...BACKUP_TABLES].sort())
  })
})

describe('archivos inválidos: no cambian nada', () => {
  async function snapshot() {
    return JSON.stringify(Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async (t) => [t, (await db.table(t).toArray()).length]))))
  }
  async function good() {
    await seed()
    return await exportBackup()
  }

  it('rechaza texto que no es JSON, otra app y versiones más nuevas', async () => {
    const file = await good()
    const before = await snapshot()
    await expect(importBackup('esto no es json')).rejects.toThrow(/no se puede leer/)
    await expect(importBackup('null')).rejects.toThrow(/de esta app/)
    await expect(importBackup(JSON.stringify({ ...file, app: 'otra-cosa' }))).rejects.toThrow(/de esta app/)
    await expect(importBackup(JSON.stringify({ ...file, version: 99 }))).rejects.toThrow(/versión más nueva/)
    await expect(importBackup(JSON.stringify({ ...file, version: 'x' }))).rejects.toThrow(/versión más nueva/)
    expect(await snapshot()).toBe(before)
  })

  it('rechaza copias incompletas o con filas dañadas', async () => {
    const file = await good()
    const before = await snapshot()
    const { txn: _omit, ...withoutTxn } = file.tables
    await expect(importBackup(JSON.stringify({ ...file, tables: withoutTxn }))).rejects.toThrow(/falta la tabla "txn"/)
    await expect(importBackup(JSON.stringify({ ...file, tables: { ...file.tables, contact: [{ name: 'sin id' }] } }))).rejects.toThrow(/fila de "contact"/)
    await expect(importBackup(JSON.stringify({ ...file, tables: { ...file.tables, meta: [{ id: 'x' }] } }))).rejects.toThrow(/fila de "meta"/)
    await expect(importBackup(JSON.stringify({ ...file, tables: { ...file.tables, product: [{ ...file.tables.product[0], photos: [{ type: 'image/png', data: '%%%no-es-base64%%%' }] }] } }))).rejects.toThrow(/foto/)
    expect(await snapshot()).toBe(before)
  })

  it('si falla a mitad de la escritura, la base queda como estaba', async () => {
    const file = await good()
    const before = await snapshot()
    // dos filas con el mismo id en una tabla: bulkAdd falla después de haber borrado las demás tablas
    const dup = { ...file, tables: { ...file.tables, txn: [file.tables.txn[0], file.tables.txn[0]] } }
    await expect(importBackup(JSON.stringify(dup))).rejects.toThrow()
    expect(await snapshot()).toBe(before)
    expect(await db.txn.count()).toBe(3)
  })
})
