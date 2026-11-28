import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { addPayment } from './debts'
import { db } from './db'
import { createOrder, payOrder } from './orders'
import { createProduct } from './products'
import { convertQuote, createQuote } from './quotes'
import { createExpense, createSale } from './transactions'
import { can, createEmployee, currentActor, listEmployees, lock, login, removeEmployee, setOwnerPin, SOLO_OWNER, teamEnabled, updateEmployee } from './team'

let B: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  B = (await createBusiness({ name: 'Taller' })).id
})

describe('empleados con PIN', () => {
  it('sin PIN de dueño todo funciona como siempre y nada se atribuye', async () => {
    expect(await teamEnabled(B)).toBe(false)
    expect(await currentActor(B)).toEqual(SOLO_OWNER)
    expect((await createSale(B, { amountCents: 1000 })).createdBy).toBeUndefined()
  })

  it('primero va el PIN del dueño; después se pueden crear empleados', async () => {
    await expect(createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })).rejects.toThrow('PIN de dueño')
    await expect(setOwnerPin(B, '12')).rejects.toThrow('4 a 6')
    await expect(setOwnerPin(B, 'abcd')).rejects.toThrow('4 a 6')
    const owner = await setOwnerPin(B, '9999')
    expect(await teamEnabled(B)).toBe(true)
    expect(await currentActor(B)).toMatchObject({ id: owner.id, role: 'owner' }) // queda dentro
    await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: ['expenses'] })
    await expect(createEmployee(B, { name: ' rosa ', pin: '4321', permissions: [] })).rejects.toThrow('Ya hay alguien')
    expect((await listEmployees(B)).map((e) => [e.name, e.role])).toEqual([['Dueño', 'owner'], ['Rosa', 'employee']])
  })

  it('el PIN no se guarda: solo su huella con sal', async () => {
    await setOwnerPin(B, '9999')
    const e = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })
    const row = (await db.employee.get(e.id))!
    expect(JSON.stringify(row)).not.toContain('1234')
    expect(row.pinHash).toMatch(/^[0-9a-f]{64}$/)
    const e2 = await createEmployee(B, { name: 'Luis', pin: '1234', permissions: [] })
    expect((await db.employee.get(e2.id))!.pinHash).not.toBe(row.pinHash) // misma PIN, distinta sal
  })

  it('entrar con PIN, bloquear y límite de intentos', async () => {
    const owner = await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })
    await lock(B)
    expect(await currentActor(B)).toBeNull()
    await expect(login(B, rosa.id, '0000')).rejects.toThrow('PIN incorrecto')
    expect(await currentActor(B)).toBeNull()
    expect(await login(B, rosa.id, '1234')).toMatchObject({ id: rosa.id, role: 'employee' })
    expect(await currentActor(B)).toMatchObject({ name: 'Rosa' })
    await lock(B)
    for (let i = 0; i < 4; i++) await expect(login(B, owner.id, '1111')).rejects.toThrow('PIN incorrecto')
    await expect(login(B, owner.id, '1111')).rejects.toThrow('Espera 30 segundos')
    await expect(login(B, owner.id, '9999')).rejects.toThrow('Espera') // ni con el PIN bueno hasta que pase el tiempo
  })

  it('un empleado desactivado o quitado queda fuera aunque tuviera la sesión abierta', async () => {
    await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })
    await login(B, rosa.id, '1234')
    await updateEmployee(rosa.id, { active: false })
    expect(await currentActor(B)).toBeNull()
    await expect(login(B, rosa.id, '1234')).rejects.toThrow('ya no puede entrar')
    await updateEmployee(rosa.id, { active: true })
    await login(B, rosa.id, '1234')
    await removeEmployee(rosa.id)
    expect(await currentActor(B)).toBeNull()
    expect((await listEmployees(B)).map((e) => e.name)).toEqual(['Dueño'])
    await expect(removeEmployee((await listEmployees(B))[0].id)).rejects.toThrow('dueño')
  })

  it('los permisos: el dueño puede todo y el empleado solo lo que se le dio', async () => {
    const owner = await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: ['expenses', 'void'] })
    const a = await login(B, rosa.id, '1234')
    expect(['balance', 'expenses', 'inventory', 'void'].map((p) => can(a, p as never))).toEqual([false, true, false, true])
    const o = await login(B, owner.id, '9999')
    expect(['balance', 'expenses', 'inventory', 'void'].every((p) => can(o, p as never))).toBe(true)
    await updateEmployee(rosa.id, { permissions: ['balance'] })
    expect((await currentActor(B)) && can((await login(B, rosa.id, '1234')), 'balance')).toBe(true)
  })
})

describe('quién registró cada cosa', () => {
  it('ventas, gastos, abonos, cotizaciones, pedidos y sus conversiones llevan a quien las hizo', async () => {
    const owner = await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })
    const cliente = await createContact(B, 'customer', { name: 'Ana' })
    const silla = await createProduct(B, { name: 'Silla', priceCents: 1000, stock: 50 })
    await login(B, rosa.id, '1234')
    const venta = await createSale(B, { amountCents: 5000, contactId: cliente.id, credit: true })
    const gasto = await createExpense(B, { amountCents: 800 })
    await addPayment(cliente.id, 1000)
    const cot = await createQuote(B, { contactId: cliente.id, title: 'X', validUntil: '2099-12-31', items: [{ name: 'Puerta', quantity: 1, unitPriceCents: 1000 }] })
    const ped = await createOrder(B, { items: [{ productId: silla.id, quantity: 1, unitPriceCents: 1000 }] })
    expect([venta.createdBy, gasto.createdBy, cot.createdBy, ped.createdBy]).toEqual([rosa.id, rosa.id, rosa.id, rosa.id])
    expect((await db.payment.toArray()).map((p) => p.createdBy)).toEqual([rosa.id])
    // El dueño convierte y cobra: esas ventas son del dueño.
    await login(B, owner.id, '9999')
    const { sale } = await convertQuote(cot.id)
    const { sale: sale2 } = await payOrder(ped.id)
    expect([sale.createdBy, sale2.createdBy]).toEqual([owner.id, owner.id])
    await lock(B)
    expect((await createSale(B, { amountCents: 1 })).createdBy).toBeUndefined()
  })
})

describe('ventas por vendedor', () => {
  it('agrupa por quien registró, con «Sin asignar» para lo anterior', async () => {
    const { computeStats } = await import('./stats')
    const MX = 'America/Mexico_City'
    expect((await computeStats(B, 'month', '2026-03-15', MX)).sellers).toEqual([]) // sin PIN no hay sección
    await createSale(B, { amountCents: 1000, date: '2026-03-05T18:00:00.000Z' }) // de antes de los PIN
    const owner = await setOwnerPin(B, '9999')
    const rosa = await createEmployee(B, { name: 'Rosa', pin: '1234', permissions: [] })
    await login(B, rosa.id, '1234')
    await createSale(B, { amountCents: 4000, date: '2026-03-06T18:00:00.000Z' })
    await createSale(B, { amountCents: 2000, date: '2026-03-07T18:00:00.000Z' })
    await login(B, owner.id, '9999')
    await createSale(B, { amountCents: 3000, date: '2026-03-08T18:00:00.000Z' })
    await removeEmployee(rosa.id)
    const s = (await computeStats(B, 'month', '2026-03-15', MX)).sellers
    expect(s.map((x) => [x.name, x.totalCents, x.count, x.role])).toEqual([['Rosa', 6000, 2, 'employee'], ['Dueño', 3000, 1, 'owner'], ['Sin asignar', 1000, 1, undefined]])
    expect(Math.round(s[0].share * 100)).toBe(60)
  })
})
