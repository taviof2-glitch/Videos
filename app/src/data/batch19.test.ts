import { describe, expect, it } from 'vitest'
import { buildWeekly, isSunday, type DigestRow } from './digest'
import { buildForecast, fixedDates } from './forecast'
import { expandLabels, fromCutPieces, labelsPdf } from './labels'
import { dueTasks } from './machines'
import { swatchText } from './swatches'
import type { FixedPayment, Machine } from './types'

describe('resumen de la semana', () => {
  const now = new Date('2026-11-29T15:00:00Z') // domingo
  it('detecta el domingo en la zona del negocio', () => {
    expect(isSunday('America/Mexico_City', now)).toBe(true)
    expect(isSunday('America/Mexico_City', new Date('2026-11-28T15:00:00Z'))).toBe(false)
  })
  it('suma ventas y gastos de los últimos 7 días y quién debe', () => {
    const rows: DigestRow[] = [
      { tbl: 'business', data: { name: 'House Lite', timezone: 'America/Mexico_City' } },
      { tbl: 'contact', data: { id: 'c1', name: 'Ana' } },
      { tbl: 'txn', data: { id: 't1', type: 'sale', status: 'paid', amountCents: 500000, date: '2026-11-27T12:00:00Z' } },
      { tbl: 'txn', data: { id: 't1', type: 'sale', status: 'paid', amountCents: 500000, date: '2026-11-27T12:00:00Z' } },
      { tbl: 'txn', data: { id: 't2', type: 'expense', status: 'paid', amountCents: 100000, date: '2026-11-25' } },
      { tbl: 'txn', data: { id: 't3', type: 'sale', status: 'credit', contactId: 'c1', amountCents: 300000, date: '2026-10-01' } },
      { tbl: 'payment', data: { transactionId: 't3', amountCents: 100000 } },
    ]
    const w = buildWeekly(rows, now)
    expect(w.body).toContain('Vendiste $5,000 (1 venta)')
    expect(w.body).toContain('gastaste $1,000')
    expect(w.body).toContain('Ana $2,000')
  })
})

describe('dinero de las próximas semanas', () => {
  it('fechas de pagos del taller', () => {
    const renta: FixedPayment = { id: 'r', name: 'Renta', amountCents: 800000, freq: 'mensual', day: 5 }
    expect(fixedDates(renta, '2026-11-28', '2026-12-25')).toEqual(['2026-11-28', '2026-12-05'])
    expect(fixedDates(renta, '2026-11-28', '2026-12-25', true)).toEqual(['2026-12-05'])
    expect(fixedDates({ ...renta, freq: 'semanal' }, '2026-11-28', '2026-12-12')).toHaveLength(3)
  })
  it('avisa la semana apretada', () => {
    const f = buildForecast('2026-11-28', [{ label: 'Saldo', cents: 100000, date: '2026-12-10' }, { label: 'Sin fecha', cents: 5000, date: '' }], [{ label: 'Renta', cents: 300000, date: '2026-11-30' }])
    expect(f.weeks[0].netCents).toBe(-300000)
    expect(f.tight?.from).toBe('2026-11-28')
    expect(f.undatedInCents).toBe(5000)
    expect(f.weeks[3].runningCents).toBe(-200000)
  })
})

describe('etiquetas', () => {
  it('una por pieza y PDF válido', () => {
    const l = expandLabels([{ n: 'Costado', l: 720, a: 560, q: 2, e: 'GG--' }, { n: 'Fondo', l: 700, a: 500, q: 1, e: '----', mdf: true }])
    expect(l).toHaveLength(3)
    expect(l[1].name).toBe('Costado (2 de 2)')
    expect(l[2].edges).toBe('Fondo 3 mm')
    const pdf = new TextDecoder('latin1').decode(labelsPdf(fromCutPieces([{ name: 'Repisa', qty: 3, largo: 50, ancho: 80, material: 'melamina' }]), 'Closet'))
    expect(pdf.startsWith('%PDF')).toBe(true)
    expect(pdf).toContain('800 x 500 mm')
  })
})

describe('maquinaria y muestrario', () => {
  it('tareas que tocan', () => {
    const m: Machine[] = [{ id: 'm', name: 'Sierra', tasks: [{ id: 't', name: 'Disco', everyDays: 30, lastDone: '2026-10-20' }, { id: 'u', name: 'Guías', everyDays: 30, lastDone: '2026-11-20' }] }]
    expect(dueTasks(m, '2026-11-28').map((x) => x.task.name)).toEqual(['Disco'])
    expect(dueTasks(m, '2026-11-28', 30)).toHaveLength(2)
  })
  it('texto del muestrario', () => expect(swatchText([{ id: '1', name: 'Nogal', supplier: '', esp: [16] }], 'House Lite')).toContain('• Nogal (16 mm)'))
})
