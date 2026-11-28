import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { listJobs, startJob } from './jobs'
import { createQuote } from './quotes'
import { matches, searchAll } from './search'
import type { Business } from './types'
import { autoPlan, planByDay, planWeekDays, savePlan, togglePlanDay } from './weekPlan'

let biz: Business
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'House Lite' })
})

describe('buscador', () => {
  it('sin acentos, por palabras y por teléfono con espacios', () => {
    expect(matches('jose closet', 'José Pérez', 'Closet de recámara')).toBe(true)
    expect(matches('3781234', '378 123 4567')).toBe(true)
    expect(matches('cocina', 'Closet')).toBe(false)
  })
  it('encuentra cliente, cotización por folio y obra', async () => {
    const ana = await createContact(biz.id, 'customer', { name: 'Ana Ruiz', phone: '378 111 2233' })
    const q = await createQuote(biz.id, { title: 'Cocina integral', contactId: ana.id, validUntil: '2026-12-30', items: [{ name: 'Cocina', quantity: 1, unitPriceCents: 2000000 }] })
    expect((await searchAll(biz, 'ana')).map((h) => h.kind)).toContain('cliente')
    expect((await searchAll(biz, '3781112')).some((h) => h.title === 'Ana Ruiz')).toBe(true)
    expect((await searchAll(biz, `#${q.number}`)).some((h) => h.kind === 'cotización')).toBe(true)
    await startJob(q.id)
    expect((await searchAll(biz, 'cocina')).some((h) => h.kind === 'obra')).toBe(true)
    expect(await searchAll(biz, 'a')).toEqual([])
  })
})

describe('plan de la semana', () => {
  it('acomoda por fecha de entrega, reparte horas y avisa sobrecarga', async () => {
    const ana = await createContact(biz.id, 'customer', { name: 'Ana' })
    for (const [title, date] of [['Closet', '2026-12-05'], ['Cocina', '2026-12-02']] as const) {
      const q = await createQuote(biz.id, { title, contactId: ana.id, validUntil: '2026-12-30', items: [{ name: title, quantity: 1, unitPriceCents: 100000 }] })
      await startJob(q.id, { deliveryDate: date })
    }
    const today = '2026-11-30' // lunes
    const days = planWeekDays(today)
    expect(days[0]).toBe('2026-11-30')
    expect(days).toHaveLength(6)
    let jobs = await listJobs(biz.id)
    const plan = autoPlan(biz, jobs, days, today)
    const cocina = jobs.find((j) => j.title === 'Cocina')!
    expect(plan.get(cocina.id)?.[0]).toBe('2026-11-30') // la de entrega más cercana va primero
    await savePlan(jobs, days, plan)
    jobs = await listJobs(biz.id)
    const byDay = planByDay(biz, jobs, days, today)
    expect(byDay.every((d) => !d.over)).toBe(true)
    expect(byDay[0].hours).toBeGreaterThan(0)
    // Poner las dos obras el mismo día lo sobrecarga.
    const closet = jobs.find((j) => j.title === 'Closet')!
    await savePlan(jobs, days, new Map([[cocina.id, ['2026-12-01']], [closet.id, ['2026-12-01']]]))
    jobs = await listJobs(biz.id)
    expect(planByDay(biz, jobs, days, today)[1].over).toBe(true)
    await togglePlanDay(jobs.find((j) => j.title === 'Closet')!, '2026-12-01')
    jobs = await listJobs(biz.id)
    expect(jobs.find((j) => j.title === 'Closet')!.job.planDays).toBeUndefined()
  })
})
