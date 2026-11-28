import { beforeEach, describe, expect, it } from 'vitest'
import { balanceForRange } from './balance'
import { createContact, deleteContact } from './contacts'
import { dayRange } from './dates'
import { addPayment, contactBalance, contactDebts, debtSummary, groupPayments, listPayments, voidPayment } from './debts'
import { db } from './db'
import { whatsappLink, whatsappNumber, reminderMessage } from './reminder'
import { createExpense, createSale, updateExpense, updateSale, voidTransaction } from './transactions'

const B = 'negocio-1'
const TODAY = '2026-06-10'

beforeEach(async () => {
  await Promise.all([db.txn.clear(), db.txnItem.clear(), db.product.clear(), db.stockMovement.clear(), db.payment.clear(), db.contact.clear()])
})

const cliente = (name = 'Olga') => createContact(B, 'customer', { name, phone: '33 1234 5678' })
const proveedor = (name = 'Maderería Sur') => createContact(B, 'supplier', { name })
const fiar = (contactId: string, amountCents: number, extra: { date?: string; dueDate?: string } = {}) =>
  createSale(B, { amountCents, contactId, credit: true, ...extra })

describe('vender fiado', () => {
  it('exige cliente y valida la fecha límite', async () => {
    await expect(createSale(B, { amountCents: 100, credit: true })).rejects.toThrow(/cliente/)
    const c = await cliente()
    await expect(fiar(c.id, 100, { dueDate: '31/12/2026' })).rejects.toThrow(/fecha límite/)
    await expect(fiar(c.id, 100, { dueDate: '2026-02-31' })).rejects.toThrow(/fecha límite/)
    await expect(fiar(c.id, 100, { dueDate: '2026-13-01' })).rejects.toThrow(/fecha límite no es válida/)
    const s = await fiar(c.id, 100, { dueDate: '2026-07-01' })
    expect(s).toMatchObject({ status: 'credit', contactId: c.id, dueDate: '2026-07-01' })
    await expect(createExpense(B, { amountCents: 100, credit: true })).rejects.toThrow(/proveedor/)
  })

  it('una venta de contado ignora la fecha límite', async () => {
    expect(await createSale(B, { amountCents: 100, dueDate: '2026-07-01' })).toMatchObject({ status: 'paid', dueDate: undefined })
  })

  it('el fiado también descuenta stock como cualquier venta', async () => {
    const { createProduct, getProduct } = await import('./products')
    const p = await createProduct(B, { name: 'Silla', stock: 5 })
    const c = await cliente()
    await createSale(B, { items: [{ productId: p.id, quantity: 2, unitPriceCents: 100 }], contactId: c.id, credit: true })
    expect((await getProduct(p.id))!.stock).toBe(3)
  })
})

describe('abonos', () => {
  it('abona parcial y deja el saldo; saldar deja 0', async () => {
    const c = await cliente()
    const s = await fiar(c.id, 100000)
    await addPayment(c.id, 30000)
    expect(await contactBalance(c.id)).toBe(70000)
    const [item] = await contactDebts(c.id)
    expect(item).toMatchObject({ paidCents: 30000, remainingCents: 70000 })
    expect(item.txn.id).toBe(s.id)
    await addPayment(c.id, 70000, { method: 'transfer' })
    expect(await contactBalance(c.id)).toBe(0)
    await expect(addPayment(c.id, 1)).rejects.toThrow(/no tiene deudas/i)
  })

  it('rechaza abonos mayores al saldo, cero, negativos o con decimales', async () => {
    const c = await cliente()
    await fiar(c.id, 10000)
    await expect(addPayment(c.id, 10001)).rejects.toThrow(/superar el saldo/)
    for (const bad of [0, -5, 10.5]) await expect(addPayment(c.id, bad)).rejects.toThrow(/mayor que cero/)
    expect(await contactBalance(c.id)).toBe(10000)
    expect(await db.payment.count()).toBe(0)
  })

  it('reparte un abono entre las deudas más antiguas primero', async () => {
    const c = await cliente()
    const vieja = await fiar(c.id, 10000, { date: '2026-05-01T12:00:00.000Z' })
    const nueva = await fiar(c.id, 20000, { date: '2026-06-01T12:00:00.000Z' })
    const batch = await addPayment(c.id, 15000)
    const [a, b] = await contactDebts(c.id)
    expect(a.txn.id).toBe(vieja.id)
    expect(a.remainingCents).toBe(0)
    expect(b.txn.id).toBe(nueva.id)
    expect(b.remainingCents).toBe(15000)
    const rows = await db.payment.where({ batchId: batch }).toArray()
    expect(rows.map((r) => r.amountCents).sort((x, y) => x - y)).toEqual([5000, 10000])
    expect(groupPayments(rows)).toHaveLength(1)
    expect(groupPayments(rows)[0].amountCents).toBe(15000)
  })

  it('con transactionId el abono va solo a esa deuda, no a las más antiguas', async () => {
    const c = await cliente()
    const vieja = await fiar(c.id, 10000, { date: '2026-05-01T12:00:00.000Z' })
    const nueva = await fiar(c.id, 20000, { date: '2026-06-01T12:00:00.000Z' })
    await addPayment(c.id, 5000, { transactionId: nueva.id })
    const [a, b] = await contactDebts(c.id)
    expect(a.txn.id).toBe(vieja.id)
    expect(a.remainingCents).toBe(10000)
    expect(b.txn.id).toBe(nueva.id)
    expect(b.remainingCents).toBe(15000)
    await expect(addPayment(c.id, 15001, { transactionId: nueva.id })).rejects.toThrow(/superar el saldo/)
    await expect(addPayment(c.id, 1, { transactionId: 'otra' })).rejects.toThrow(/no tiene deudas/i)
  })

  it('anular un abono devuelve el saldo y permite volver a abonar', async () => {
    const c = await cliente()
    await fiar(c.id, 10000)
    const batch = await addPayment(c.id, 10000)
    expect(await contactBalance(c.id)).toBe(0)
    await voidPayment(batch)
    expect(await contactBalance(c.id)).toBe(10000)
    await expect(voidPayment(batch)).rejects.toThrow(/no existe/)
    await expect(addPayment(c.id, 10000)).resolves.toBeTruthy()
  })

  it('un cliente solo paga sus propias deudas', async () => {
    const a = await cliente('Ana')
    const b = await cliente('Beto')
    await fiar(a.id, 5000)
    await expect(addPayment(b.id, 100)).rejects.toThrow(/no tiene deudas/i)
    expect(await contactBalance(a.id)).toBe(5000)
  })

  it('un gasto a crédito se paga al proveedor', async () => {
    const p = await proveedor()
    await createExpense(B, { amountCents: 80000, contactId: p.id, credit: true })
    await addPayment(p.id, 50000)
    expect(await contactBalance(p.id)).toBe(30000)
    const [row] = await listPayments(B)
    expect(row.direction).toBe('out')
  })
})

describe('balance de caja con fiados', () => {
  it('el fiado no es ingreso hasta que se cobra, y cuenta el día del abono', async () => {
    const c = await cliente()
    await fiar(c.id, 100000, { date: '2026-06-01T12:00:00.000Z' })
    const day = (k: string) => dayRange(k, 'UTC')
    expect((await balanceForRange(B, day('2026-06-01'))).incomeCents).toBe(0)
    await addPayment(c.id, 40000, { date: '2026-06-05T12:00:00.000Z' })
    expect((await balanceForRange(B, day('2026-06-01'))).incomeCents).toBe(0)
    expect((await balanceForRange(B, day('2026-06-05'))).incomeCents).toBe(40000)
    expect((await balanceForRange(B)).incomeCents).toBe(40000)
  })

  it('suma contado + abonos de cobro − gastos al contado − pagos a proveedores', async () => {
    const c = await cliente()
    const p = await proveedor()
    await createSale(B, { amountCents: 10000 })
    await fiar(c.id, 50000)
    await addPayment(c.id, 20000)
    await createExpense(B, { amountCents: 3000 })
    await createExpense(B, { amountCents: 9000, contactId: p.id, credit: true })
    await addPayment(p.id, 4000)
    expect(await balanceForRange(B)).toMatchObject({ incomeCents: 30000, expenseCents: 7000, profitCents: 23000, salesCount: 2, expenseCount: 2 })
  })

  it('un abono anulado deja de contar', async () => {
    const c = await cliente()
    await fiar(c.id, 10000)
    const batch = await addPayment(c.id, 10000)
    await voidPayment(batch)
    expect((await balanceForRange(B)).incomeCents).toBe(0)
  })
})

describe('editar y borrar deudas con abonos', () => {
  it('no se puede borrar una deuda con abonos hasta anularlos', async () => {
    const c = await cliente()
    const s = await fiar(c.id, 10000)
    const batch = await addPayment(c.id, 1000)
    await expect(voidTransaction(s.id)).rejects.toThrow(/anula los abonos/)
    await voidPayment(batch)
    await voidTransaction(s.id)
    expect(await contactBalance(c.id)).toBe(0)
  })

  it('borrar un fiado sin abonos lo quita de las deudas', async () => {
    const c = await cliente()
    const s = await fiar(c.id, 10000)
    await voidTransaction(s.id)
    expect((await debtSummary(B, 'receivable', TODAY)).debtors).toHaveLength(0)
  })

  it('con abonos: el monto no baja de lo abonado, pero sí puede subir', async () => {
    const c = await cliente()
    const s = await fiar(c.id, 10000)
    await addPayment(c.id, 6000)
    const input = { contactId: c.id, credit: true }
    await expect(updateSale(s.id, { ...input, amountCents: 5000 })).rejects.toThrow(/menor a lo ya abonado/)
    await updateSale(s.id, { ...input, amountCents: 6000 })
    expect(await contactBalance(c.id)).toBe(0)
    await updateSale(s.id, { ...input, amountCents: 9000 })
    expect(await contactBalance(c.id)).toBe(3000)
  })

  it('con abonos no se cambia entre contado y fiado ni de cliente', async () => {
    const a = await cliente('Ana')
    const b = await cliente('Beto')
    const s = await fiar(a.id, 10000)
    await addPayment(a.id, 1000)
    await expect(updateSale(s.id, { amountCents: 10000, contactId: a.id })).rejects.toThrow(/contado y fiado/)
    await expect(updateSale(s.id, { amountCents: 10000, contactId: b.id, credit: true })).rejects.toThrow(/contacto/)
    const g = await createExpense(B, { amountCents: 500, contactId: (await proveedor()).id, credit: true })
    await addPayment(g.contactId!, 100)
    await expect(updateExpense(g.id, { amountCents: 500, contactId: g.contactId })).rejects.toThrow(/contado y fiado/)
  })

  it('sin abonos se puede pasar de fiado a contado y al revés', async () => {
    const c = await cliente()
    const s = await fiar(c.id, 10000)
    expect(await updateSale(s.id, { amountCents: 10000, contactId: c.id })).toMatchObject({ status: 'paid', dueDate: undefined })
    expect(await contactBalance(c.id)).toBe(0)
    expect(await updateSale(s.id, { amountCents: 10000, contactId: c.id, credit: true, dueDate: '2026-08-01' })).toMatchObject({ status: 'credit', dueDate: '2026-08-01' })
    expect(await contactBalance(c.id)).toBe(10000)
  })
})

describe('contactos con deuda', () => {
  it('no se borran con saldo pendiente, sí cuando lo saldan', async () => {
    const c = await cliente()
    await fiar(c.id, 10000)
    await expect(deleteContact(c.id)).rejects.toThrow(/saldo pendiente/)
    await addPayment(c.id, 10000)
    await expect(deleteContact(c.id)).resolves.toBeUndefined()
  })
})

describe('resumen de deudas', () => {
  it('totales, vencidos primero y luego mayor saldo', async () => {
    const ana = await cliente('Ana')
    const beto = await cliente('Beto')
    const cris = await cliente('Cris')
    await fiar(ana.id, 50000, { dueDate: '2026-07-01' }) // vigente, la mayor
    await fiar(beto.id, 20000, { dueDate: '2026-06-01' }) // vencida
    await fiar(beto.id, 5000)
    await fiar(cris.id, 10000, { dueDate: '2026-06-10' }) // vence hoy: aún no vencida
    const saldada = await cliente('Dora')
    await fiar(saldada.id, 100)
    await addPayment(saldada.id, 100)
    await createSale(B, { amountCents: 99999 }) // contado: no cuenta
    const s = await debtSummary(B, 'receivable', TODAY)
    expect(s.debtors.map((d) => d.contact.name)).toEqual(['Beto', 'Ana', 'Cris'])
    expect(s.totalCents).toBe(85000)
    expect(s.overdueCents).toBe(20000)
    expect(s.debtors[0]).toMatchObject({ balanceCents: 25000, overdueCents: 20000, nextDue: '2026-06-01', openCount: 2 })
    expect((await debtSummary(B, 'payable', TODAY)).totalCents).toBe(0)
  })

  it('por pagar y separado por negocio', async () => {
    const p = await proveedor()
    await createExpense(B, { amountCents: 7000, contactId: p.id, credit: true })
    const other = await createContact('otro', 'customer', { name: 'Ajeno' })
    await createSale('otro', { amountCents: 1, contactId: other.id, credit: true })
    expect((await debtSummary(B, 'payable', TODAY)).totalCents).toBe(7000)
    expect((await debtSummary(B, 'receivable', TODAY)).totalCents).toBe(0)
  })
})

describe('recordatorio por WhatsApp', () => {
  it('normaliza el teléfono para wa.me', () => {
    expect(whatsappNumber('33 1234 5678')).toBe('523312345678')
    expect(whatsappNumber('+52 (33) 1234-5678')).toBe('523312345678')
    expect(whatsappNumber('52 33 1234 5678')).toBe('523312345678')
    expect(whatsappNumber('521 33 1234 5678')).toBe('523312345678')
    expect(whatsappNumber('0052 33 1234 5678')).toBe('523312345678')
    expect(whatsappNumber('123')).toBeUndefined()
    expect(whatsappNumber('')).toBeUndefined()
    expect(whatsappNumber('57 300 123 4567', 'CO')).toBe('573001234567')
  })

  it('arma el mensaje y el enlace codificado', () => {
    const base = { name: 'Olga Acevedo', businessName: 'Carpintería López', balanceCents: 125050, currency: 'MXN' }
    expect(reminderMessage({ ...base, overdue: false })).toBe('Hola Olga, te saluda Carpintería López. Te recuerdo que tienes un saldo pendiente de $1,250.50. Gracias por tu apoyo.')
    expect(reminderMessage({ ...base, dueDate: '2026-06-01', overdue: true })).toMatch(/vencido desde el 1 jun.* 2026/)
    expect(reminderMessage({ ...base, dueDate: '2026-07-01', overdue: false })).toMatch(/con fecha límite el 1 jul.* 2026/)
    const url = whatsappLink('Hola, ¿qué tal? & más', '33 1234 5678')
    expect(url).toBe('https://wa.me/523312345678?text=Hola%2C%20%C2%BFqu%C3%A9%20tal%3F%20%26%20m%C3%A1s')
    expect(whatsappLink('Hola', '')).toBe('https://wa.me/?text=Hola')
  })
})

describe('editar un abono', () => {
  it('cambia fecha y forma de pago sin mover el saldo', async () => {
    const { createBusiness } = await import('./business')
    const { createContact } = await import('./contacts')
    const { createSale } = await import('./transactions')
    const { addPayment, contactBalance, editPayment, listPayments } = await import('./debts')
    const b = await createBusiness({ name: 'Taller' })
    const c = await createContact(b.id, 'customer', { name: 'Ana' })
    await createSale(b.id, { amountCents: 500000, credit: true, contactId: c.id })
    const batch = await addPayment(c.id, 200000, { method: 'cash' })
    await editPayment(batch, { date: '2026-11-20T15:00:00.000Z', method: 'transfer' })
    const live = (await listPayments(b.id)).filter((p) => p.contactId === c.id)
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ date: '2026-11-20T15:00:00.000Z', method: 'transfer', amountCents: 200000 })
    expect(await contactBalance(c.id)).toBe(300000)
  })
})
