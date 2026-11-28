import { describe, expect, it } from 'vitest'
import { afterSaleDue, afterSaleMessage } from './aftersale'
import type { JobItem } from './jobs'

const j = (deliveredAt?: string, extra = {}) => ({ id: deliveredAt ?? 'x', kind: 'sale', title: 'Closet', folio: '', totalCents: 0, incomeCents: 0, balanceCents: 0, job: { stage: 'instalado', startedAt: '', deliveredAt, ...extra } }) as unknown as JobItem

describe('postventa', () => {
  it('reseña a los 2 días y ajuste a los 6 meses, una vez', () => {
    const due = afterSaleDue([j('2026-11-25'), j('2026-11-27'), j('2026-05-20'), j('2026-11-20', { reviewAsked: '2026-11-22' }), j()], '2026-11-27')
    expect(due.map((d) => [d.item.id, d.kind])).toEqual([['2026-11-25', 'review'], ['2026-05-20', 'adjust']])
    expect(afterSaleMessage('review', { customer: 'Marta López', title: 'Closet', business: 'House Lite', reviewUrl: 'https://g.page/r/x' })).toContain('https://g.page/r/x')
  })
})
