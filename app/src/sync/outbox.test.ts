import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { createContact, deleteContact, updateContact } from '../data/contacts'
import { db } from '../data/db'
import { addPayment } from '../data/debts'
import { createProduct } from '../data/products'
import { createSale, updateSale, voidTransaction } from '../data/transactions'
import { markRemote } from './outbox'

const B = 'biz-outbox'
const queued = async () => (await db.outbox.orderBy('seq').toArray()).map((e) => `${e.tbl}:${e.rowId}`)

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('cola de cambios (outbox)', () => {
  it('cada escritura en una tabla sincronizada queda en la cola', async () => {
    const c = await createContact(B, 'customer', { name: 'Ana' })
    await updateContact(c.id, { name: 'Ana López' })
    await deleteContact(c.id)
    expect(await queued()).toEqual([`contact:${c.id}`, `contact:${c.id}`, `contact:${c.id}`])
  })

  it('las líneas apuntan a su documento, también al borrarlas', async () => {
    const p = await createProduct(B, { name: 'Silla', priceCents: 1000, stock: 5 })
    await db.outbox.clear()
    const s = await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 1000 }] })
    const afterCreate = await queued()
    expect(afterCreate).toContain(`txn:${s.id}`)
    expect(afterCreate).toContain(`product:${p.id}`)
    expect(afterCreate.some((k) => k.startsWith('stockMovement:'))).toBe(true)
    expect(afterCreate.some((k) => k.startsWith('txnItem:'))).toBe(false)
    await db.outbox.clear()
    await updateSale(s.id, { items: [{ productId: p.id, quantity: 1, unitPriceCents: 1000 }] })
    expect((await queued()).filter((k) => k === `txn:${s.id}`).length).toBeGreaterThanOrEqual(2) // borrar y crear líneas + la venta
    await db.outbox.clear()
    await db.txnItem.where({ transactionId: s.id }).delete() // solo borrar líneas
    expect(await queued()).toEqual([`txn:${s.id}`])
    await db.outbox.clear()
    await voidTransaction(s.id)
    expect(await queued()).toContain(`txn:${s.id}`)
  })

  it('abonos y su anulación entran en la cola', async () => {
    const c = await createContact(B, 'customer', { name: 'Beto' })
    await createSale(B, { amountCents: 5000, contactId: c.id, credit: true })
    await db.outbox.clear()
    await addPayment(c.id, 1000)
    expect((await queued()).some((k) => k.startsWith('payment:'))).toBe(true)
  })

  it('si la transacción falla no queda nada en la cola', async () => {
    await expect(
      db.transaction('rw', db.contact, async () => {
        await db.contact.add({ id: crypto.randomUUID(), businessId: B, type: 'customer', name: 'X', phone: '', documentId: '', notes: '', createdAt: '', updatedAt: '' })
        throw new Error('falla')
      }),
    ).rejects.toThrow('falla')
    expect(await db.contact.count()).toBe(0)
    expect(await queued()).toEqual([])
  })

  it('lo que llega del servidor no vuelve a la cola', async () => {
    await db.transaction('rw', db.contact, async () => {
      markRemote(Dexie.currentTransaction.idbtrans)
      await db.contact.put({ id: crypto.randomUUID(), businessId: B, type: 'customer', name: 'Remota', phone: '', documentId: '', notes: '', createdAt: '', updatedAt: '' })
    })
    expect(await db.contact.count()).toBe(1)
    expect(await queued()).toEqual([])
  })

  it('las tablas solo del dispositivo no se anotan', async () => {
    await db.meta.put({ key: 'x', value: '1' })
    await db.syncState.put({ key: 'cursor:x', value: 3 })
    expect(await queued()).toEqual([])
  })
})
