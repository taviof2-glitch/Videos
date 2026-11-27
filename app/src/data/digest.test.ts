import { describe, expect, it } from 'vitest'
import { buildDigest, todayIn } from './digest'

const now = new Date('2026-12-02T14:00:00Z') // 8:00 en Tepatitlán
const rows = [
  { tbl: 'business', data: { id: 'b', name: 'House Lite', timezone: 'America/Mexico_City', currency: 'MXN' } },
  { tbl: 'contact', data: { id: 'c1', name: 'Marta', type: 'customer' } },
  { tbl: 'contact', data: { id: 'c2', name: 'Luis', type: 'customer' } },
  { tbl: 'appointment', data: { id: 'a1', kind: 'instalar', date: '2026-12-02', time: '16:30', contactId: 'c1', title: 'Closet' } },
  { tbl: 'appointment', data: { id: 'a2', kind: 'medir', date: '2026-12-02', time: '09:00', title: 'Cocina Pérez' } },
  { tbl: 'appointment', data: { id: 'a3', kind: 'medir', date: '2026-12-03', title: 'Otra' } },
  { tbl: 'appointment', data: { id: 'a4', kind: 'medir', date: '2026-12-02', title: 'Hecha', done: true } },
  { tbl: 'quote', data: { id: 'q1', status: 'pending', contactId: 'c2', title: 'Cocina', createdAt: '2026-11-25T10:00:00Z', validUntil: '2026-12-10' } },
  { tbl: 'quote', data: { id: 'q2', status: 'converted', contactId: 'c1', title: 'Closet', createdAt: '2026-11-01T10:00:00Z', job: { stage: 'armado', deliveryDate: '2026-12-02' } } },
  { tbl: 'txn', data: { id: 't1', type: 'sale', status: 'credit', contactId: 'c2', amountCents: 500000, dueDate: '2026-11-30', concept: 'Repisas', job: { stage: 'material', deliveryDate: '2026-11-28' } } },
  { tbl: 'payment', data: { id: 'p1', transactionId: 't1', amountCents: 200000 } },
]

describe('resumen del día', () => {
  it('junta citas, entregas, atrasos, cotizaciones y cobros vencidos', () => {
    expect(todayIn('America/Mexico_City', now)).toBe('2026-12-02')
    const d = buildDigest(rows, now)
    expect(d.title).toBe('Buenos días · tu día en House Lite')
    expect(d.body).toContain('Hoy: medir 9am Cocina Pérez, instalar 4:30pm Marta')
    expect(d.body).toContain('Mañana: 1 cita')
    expect(d.body).toContain('Se entrega hoy: Closet')
    expect(d.body).toContain('1 obra atrasada (Repisas)')
    expect(d.body).toContain('1 cotización sin respuesta (Luis)')
    expect(d.body).toMatch(/Luis debe \$3,000/)
    expect(d.empty).toBe(false)
  })
  it('sin pendientes lo dice', () => {
    const d = buildDigest([rows[0]], now)
    expect(d.empty).toBe(true)
    expect(d.body).toMatch(/no hay/)
  })
})
