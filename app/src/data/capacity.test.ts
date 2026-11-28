import { describe, expect, it } from 'vitest'
import { addWorkDays, capacity } from './capacity'
import type { JobItem } from './jobs'
import type { Business } from './types'

const biz = { quoter: { cfg: { hDia: 8 } } } as unknown as Business
const job = (stage: string, extra = {}) => ({ id: stage, kind: 'sale', title: '', folio: '', totalCents: 0, incomeCents: 0, balanceCents: 0, job: { stage, startedAt: '', ...extra } }) as unknown as JobItem

describe('capacidad del taller', () => {
  it('suma lo que falta y salta domingos', () => {
    expect(addWorkDays('2026-11-28', 1)).toBe('2026-11-30') // sábado → lunes (domingo no cuenta)
    const cap = capacity(biz, [job('anticipo'), job('armado'), job('instalado')], '2026-11-28')
    // 16 + 16×0.45 = 23.2 h de pendiente; + 16 h de la nueva = 39.2 h → 5 días de 8 h
    expect(cap.backlogHours).toBe(23)
    expect(cap.nextDelivery).toBe('2026-12-04')
  })
})
