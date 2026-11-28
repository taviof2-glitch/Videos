import { describe, expect, it } from 'vitest'
import { followUpDue, followUpMessage, monthQuotes } from './followup'
import type { Quote } from './types'

const q = (p: Partial<Quote>): Quote => ({ id: 'q', businessId: 'b', number: 1, title: 'Cocina', contactId: 'c', validUntil: '2026-12-31', status: 'pending', taxRate: 0, discountCents: 0, subtotalCents: 0, taxCents: 0, totalCents: 1000000, advanceCents: 0, notes: '', createdAt: '2026-11-20T10:00:00Z', updatedAt: '', ...p })

describe('seguimiento de cotizaciones', () => {
  it('toca a los 3, 7 y 15 días, una vez cada una', () => {
    expect(followUpDue(q({}), '2026-11-22')).toBeUndefined()
    expect(followUpDue(q({}), '2026-11-23')).toBe(0)
    expect(followUpDue(q({ followUps: ['2026-11-23'] }), '2026-11-23')).toBeUndefined()
    expect(followUpDue(q({ followUps: ['2026-11-23'] }), '2026-11-26')).toBeUndefined()
    expect(followUpDue(q({ followUps: ['2026-11-23'] }), '2026-11-27')).toBe(1)
    expect(followUpDue(q({ followUps: ['a', 'b'] }), '2026-12-05')).toBe(2)
    expect(followUpDue(q({ followUps: ['a', 'b', 'c'] }), '2026-12-20')).toBeUndefined()
    expect(followUpDue(q({ status: 'converted' }), '2026-11-27')).toBeUndefined()
    expect(followUpMessage(0, { customer: 'Luis Pérez', title: 'Cocina', business: 'House Lite' })).toContain('Hola Luis')
  })
  it('resumen del mes', () => {
    const list = [q({ status: 'converted' }), q({ status: 'rejected', totalCents: 500000 }), q({}), q({ createdAt: '2026-10-01T00:00:00Z' })]
    expect(monthQuotes(list, '2026-11', '2026-11-27')).toMatchObject({ made: 3, closed: 1, closedCents: 1000000, lost: 1, lostCents: 500000, waiting: 1, rate: 33 })
  })
})
