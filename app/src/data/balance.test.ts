import { beforeEach, describe, expect, it } from 'vitest'
import { balanceForRange } from './balance'
import { addDays, addMonths, dayKey, dayRange, periodDays, periodLabel, periodRange, shiftAnchor, weekStart } from './dates'
import { db } from './db'
import { createExpense, createSale, voidTransaction } from './transactions'

const MX = 'America/Mexico_City' // UTC−6 todo el año desde 2022
const B = 'negocio-1'

describe('claves de día', () => {
  it('cerca de medianoche, el día depende de la zona del negocio', () => {
    expect(dayKey('2026-03-02T05:59:59.999Z', MX)).toBe('2026-03-01') // 23:59:59 en México
    expect(dayKey('2026-03-02T06:00:00.000Z', MX)).toBe('2026-03-02') // 00:00 en México
    expect(dayKey('2026-03-02T05:59:59.999Z', 'UTC')).toBe('2026-03-02')
    expect(dayKey('2026-03-02T01:00:00.000Z', 'Asia/Tokyo')).toBe('2026-03-02') // 10:00 en Tokio
    expect(dayKey('2026-03-01T16:00:00.000Z', 'Asia/Tokyo')).toBe('2026-03-02') // 01:00 en Tokio
  })

  it('aritmética de días y meses', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('la semana empieza en lunes', () => {
    expect(weekStart('2026-11-25')).toBe('2026-11-23') // miércoles
    expect(weekStart('2026-11-23')).toBe('2026-11-23') // lunes
    expect(weekStart('2026-11-29')).toBe('2026-11-23') // domingo
    expect(weekStart('2026-11-30')).toBe('2026-11-30')
  })
})

describe('rangos', () => {
  it('un día va de medianoche a medianoche en la zona del negocio', () => {
    expect(dayRange('2026-03-01', MX)).toEqual({ from: '2026-03-01T06:00:00.000Z', to: '2026-03-02T05:59:59.999Z' })
    expect(dayRange('2026-03-01', 'UTC')).toEqual({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-01T23:59:59.999Z' })
  })

  it('respeta los cambios de horario (días de 23 y 25 horas)', () => {
    const ny = 'America/New_York'
    const hours = (k: string) => {
      const r = dayRange(k, ny)
      return (new Date(r.to).getTime() + 1 - new Date(r.from).getTime()) / 3_600_000
    }
    expect(hours('2026-03-08')).toBe(23) // empieza el horario de verano
    expect(hours('2026-11-01')).toBe(25) // termina
    expect(hours('2026-06-15')).toBe(24)
    // los instantes extremos siguen cayendo en el día correcto
    for (const k of ['2026-03-08', '2026-11-01']) {
      const r = dayRange(k, ny)
      expect(dayKey(r.from, ny)).toBe(k)
      expect(dayKey(r.to, ny)).toBe(k)
      expect(dayKey(new Date(r.from).getTime() - 1, ny)).toBe(addDays(k, -1))
      expect(dayKey(new Date(r.to).getTime() + 1, ny)).toBe(addDays(k, 1))
    }
  })

  it('semana, mes y todo', () => {
    expect(periodDays('week', '2026-11-25')).toEqual({ start: '2026-11-23', end: '2026-11-29' })
    expect(periodDays('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(periodDays('month', '2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(periodDays('all', '2026-02-10')).toBeUndefined()
    expect(periodRange('all', '2026-02-10', MX)).toEqual({})
    expect(periodRange('month', '2026-03-10', MX)).toEqual({ from: '2026-03-01T06:00:00.000Z', to: '2026-04-01T05:59:59.999Z' })
  })

  it('navega por periodos', () => {
    expect(shiftAnchor('day', '2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftAnchor('week', '2026-03-01', 1)).toBe('2026-03-08')
    expect(shiftAnchor('month', '2026-01-20', -1)).toBe('2025-12-01')
  })

  it('etiquetas legibles', () => {
    expect(periodLabel('day', '2026-11-25')).toMatch(/25 nov.* 2026/)
    expect(periodLabel('month', '2026-11-25')).toMatch(/noviembre.* 2026/)
    expect(periodLabel('week', '2026-11-25')).toMatch(/23 nov.* 29 nov.* 2026/)
    expect(periodLabel('all', '2026-11-25')).toBe('Todo el historial')
  })
})

describe('balance', () => {
  beforeEach(async () => {
    await Promise.all([db.txn.clear(), db.txnItem.clear(), db.product.clear(), db.stockMovement.clear()])
  })

  it('suma ingresos y egresos, ignora borrados y otros negocios', async () => {
    await createSale(B, { amountCents: 10000 })
    await createSale(B, { amountCents: 2550 })
    const borrada = await createSale(B, { amountCents: 99999 })
    await voidTransaction(borrada.id)
    await createExpense(B, { amountCents: 4000 })
    await createSale('otro', { amountCents: 777 })
    expect(await balanceForRange(B)).toEqual({ incomeCents: 12550, expenseCents: 4000, profitCents: 8550, salesCount: 2, expenseCount: 1 })
  })

  it('la utilidad puede ser negativa y un negocio vacío da ceros', async () => {
    expect(await balanceForRange(B)).toEqual({ incomeCents: 0, expenseCents: 0, profitCents: 0, salesCount: 0, expenseCount: 0 })
    await createExpense(B, { amountCents: 500 })
    expect((await balanceForRange(B)).profitCents).toBe(-500)
  })

  it('ventas cerca de medianoche caen en el día correcto del negocio', async () => {
    await createSale(B, { amountCents: 100, date: '2026-03-02T05:30:00.000Z' }) // 23:30 del 1 de marzo en México
    await createSale(B, { amountCents: 200, date: '2026-03-02T06:10:00.000Z' }) // 00:10 del 2 de marzo
    await createSale(B, { amountCents: 400, date: '2026-03-02T05:59:59.999Z' }) // último instante del 1
    await createSale(B, { amountCents: 800, date: '2026-03-03T05:59:59.999Z' }) // último instante del 2
    const day = async (k: string) => (await balanceForRange(B, dayRange(k, MX))).incomeCents
    expect(await day('2026-03-01')).toBe(500)
    expect(await day('2026-03-02')).toBe(1000)
    expect(await day('2026-03-03')).toBe(0)
    // el mes completo suma todo, sin contar nada dos veces
    expect((await balanceForRange(B, periodRange('month', '2026-03-15', MX))).incomeCents).toBe(1500)
    // 1 de marzo de 2026 es domingo: pertenece a la semana que termina ese día; el lunes 2 abre otra.
    expect((await balanceForRange(B, periodRange('week', '2026-03-01', MX))).incomeCents).toBe(500)
    expect((await balanceForRange(B, periodRange('week', '2026-03-02', MX))).incomeCents).toBe(1000)
  })
})
