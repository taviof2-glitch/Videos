import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { db } from './db'
import { deleteFixed, expectedInMonth, fixedMonth, listFixed, monthlyAverageCents, payFixed, saveFixed } from './fixed'
import { listTransactions, voidTransaction } from './transactions'
import type { Business } from './types'

let biz: Business
const reload = async () => (biz = (await db.business.get(biz.id))!)
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'Taller' })
})

describe('pagos habituales del taller', () => {
  it('se agregan, se cambian y se quitan; no se repite el nombre', async () => {
    const renta = await saveFixed(biz.id, { name: ' Renta ', amountCents: 500000, freq: 'mensual', day: 5 })
    await saveFixed(biz.id, { name: 'Luz', amountCents: 120000, freq: 'bimestral', day: 20, month: 1 })
    expect(listFixed(await reload()).map((p) => p.name)).toEqual(['Renta', 'Luz'])
    await expect(saveFixed(biz.id, { name: 'renta', amountCents: 100, freq: 'mensual' })).rejects.toThrow('Ya tienes un pago')
    await expect(saveFixed(biz.id, { name: 'Agua', amountCents: 0, freq: 'mensual' })).rejects.toThrow('mayor que cero')
    await saveFixed(biz.id, { id: renta.id, name: 'Renta del local', amountCents: 550000, freq: 'mensual', day: 5 })
    expect(listFixed(await reload())[0]).toMatchObject({ id: renta.id, name: 'Renta del local', amountCents: 550000 })
    await deleteFixed(biz.id, renta.id)
    expect(listFixed(await reload()).map((p) => p.name)).toEqual(['Luz'])
  })

  it('cuántas veces toca al mes según la frecuencia', () => {
    const p = (freq: 'semanal' | 'quincenal' | 'mensual' | 'bimestral' | 'anual', month?: number) => ({ id: 'x', name: 'x', amountCents: 1200, freq, month })
    expect(expectedInMonth(p('semanal'), '2026-11-10')).toBe(4)
    expect(expectedInMonth(p('quincenal'), '2026-11-10')).toBe(2)
    expect(expectedInMonth(p('mensual'), '2026-11-10')).toBe(1)
    expect(expectedInMonth(p('bimestral', 1), '2026-11-10')).toBe(1) // ene, mar, …, nov
    expect(expectedInMonth(p('bimestral', 1), '2026-12-10')).toBe(0)
    expect(expectedInMonth(p('anual', 3), '2026-03-10')).toBe(1)
    expect(expectedInMonth(p('anual', 3), '2026-11-10')).toBe(0)
    expect(monthlyAverageCents(p('anual'))).toBe(100)
    expect(monthlyAverageCents(p('bimestral'))).toBe(600)
    expect(monthlyAverageCents(p('semanal'))).toBe(5200)
  })

  it('el control del mes: pendiente, vencido y pagado, con sus totales', async () => {
    const renta = await saveFixed(biz.id, { name: 'Renta', amountCents: 500000, freq: 'mensual', day: 5 })
    const net = await saveFixed(biz.id, { name: 'Internet', amountCents: 60000, freq: 'mensual', day: 25 })
    await saveFixed(biz.id, { name: 'Predial', amountCents: 300000, freq: 'anual', day: 31, month: 1 })
    await reload()
    let m = await fixedMonth(biz, '2026-11-10', '2026-11-10')
    expect(m.rows.map((r) => [r.payment.name, r.state])).toEqual([['Renta', 'vencido'], ['Internet', 'pendiente'], ['Predial', 'no-toca']])
    expect(m).toMatchObject({ expectedCents: 560000, paidCents: 0, remainingCents: 560000 })
    expect(m.averageCents).toBe(500000 + 60000 + 25000)

    // Se paga la renta (salió más cara): queda como gasto normal y el control la marca pagada.
    const gasto = await payFixed(biz.id, renta, { amountCents: 520000, paymentMethod: 'transfer', date: '2026-11-10T18:00:00.000Z' })
    expect(gasto).toMatchObject({ type: 'expense', concept: 'Renta', fixedId: renta.id, status: 'paid' })
    m = await fixedMonth(biz, '2026-11-10', '2026-11-10')
    expect(m.rows.find((r) => r.payment.id === renta.id)).toMatchObject({ state: 'pagado', paidCents: 520000, remainingCents: 0 })
    expect(m).toMatchObject({ paidCents: 520000, remainingCents: 60000 })
    expect((await listTransactions(biz.id, { type: 'expense' })).length).toBe(1)

    // Otro mes empieza de cero; un mes pasado sin pagar está vencido.
    expect((await fixedMonth(biz, '2026-12-01', '2026-11-10')).rows.find((r) => r.payment.id === renta.id)!.state).toBe('pendiente')
    expect((await fixedMonth(biz, '2026-10-01', '2026-11-10')).rows.find((r) => r.payment.id === net.id)!.state).toBe('vencido')

    // Si el gasto se anula, vuelve a quedar pendiente.
    await voidTransaction(gasto.id)
    expect((await fixedMonth(biz, '2026-11-10', '2026-11-10')).rows.find((r) => r.payment.id === renta.id)!.state).toBe('vencido')
  })

  it('un pago semanal lleva la cuenta de cuántos van', async () => {
    const sueldo = await saveFixed(biz.id, { name: 'Sueldos', amountCents: 300000, freq: 'semanal' })
    await reload()
    await payFixed(biz.id, sueldo, { amountCents: 300000, date: '2026-11-06T18:00:00.000Z' })
    await payFixed(biz.id, sueldo, { amountCents: 300000, date: '2026-11-13T18:00:00.000Z' })
    const row = (await fixedMonth(biz, '2026-11-15', '2026-11-15')).rows[0]
    expect(row).toMatchObject({ expected: 4, paidCents: 600000, remainingCents: 600000, state: 'pendiente' })
    expect(row.paid.length).toBe(2)
  })
})
