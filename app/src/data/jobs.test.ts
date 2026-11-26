import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { DEFAULT_SPECS } from './cutlist'
import { db } from './db'
import { addJobPhoto, awaitingPayment, balanceDue, balanceReminder, removeJobPhoto, dueThisWeek, isLate, jobProfit, jobSummary, listJobs, removeJob, setJobStage, shoppingList, shoppingText, startJob, updateJob, warrantyUntil } from './jobs'
import { DEFAULT_CONFIG, saveQuoterQuote } from './quoter'
import { getQuote } from './quotes'
import type { Business } from './types'

let biz: Business
const x = { customer: 'Ana', description: '', delivery: '2 semanas', iva: false, ivaRate: 16, phone: '' }
const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'Taller' })
})

describe('obras del taller', () => {
  it('una cotización pasa a obra y avanza por etapas; al instalar se anota la entrega', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await startJob(q.id, { deliveryDate: '2026-12-05' })
    expect((await getQuote(q.id))!.job).toMatchObject({ stage: 'anticipo', deliveryDate: '2026-12-05' })
    await expect(startJob(q.id)).rejects.toThrow('ya es una obra')
    await setJobStage(q.id, 'corte')
    expect((await getQuote(q.id))!.job!.deliveredAt).toBeUndefined()
    await setJobStage(q.id, 'instalado', '2026-12-04')
    expect((await getQuote(q.id))!.job).toMatchObject({ stage: 'instalado', deliveredAt: '2026-12-04' })
    // Si se regresa de etapa, deja de contar como entregada.
    await setJobStage(q.id, 'armado')
    expect((await getQuote(q.id))!.job!.deliveredAt).toBeUndefined()
    expect((await listJobs(biz.id)).length).toBe(1)
    await removeJob(q.id)
    expect((await getQuote(q.id))!.job).toBeUndefined()
    expect((await getQuote(q.id))!.quoter).toBeTruthy()
  })

  it('atrasadas y entregas de la semana', async () => {
    const job = (deliveryDate: string, stage: 'corte' | 'instalado' = 'corte') => ({ stage, startedAt: '', deliveryDate })
    // 2026-11-25 es miércoles: la semana acaba el domingo 29.
    expect(isLate(job('2026-11-20'), '2026-11-25')).toBe(true)
    expect(isLate(job('2026-11-20', 'instalado'), '2026-11-25')).toBe(false)
    expect(isLate(job('2026-11-25'), '2026-11-25')).toBe(false)
    expect(dueThisWeek(job('2026-11-28'), '2026-11-25')).toBe(true)
    expect(dueThisWeek(job('2026-12-02'), '2026-11-25')).toBe(false)
    const a = await saveQuoterQuote(biz, tv, x)
    const b = await saveQuoterQuote(biz, tv, { ...x, customer: 'Luis' })
    await startJob(a.id, { deliveryDate: '2026-11-20' })
    await startJob(b.id, { deliveryDate: '2026-11-27' })
    expect(await jobSummary(biz, '2026-11-25')).toEqual({ active: 2, late: 1, thisWeek: 1, unpaid: 0 })
  })

  it('ganancia real: lo cobrado menos material y horas reales, contra lo estimado', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await startJob(q.id)
    expect(jobProfit(biz, (await getQuote(q.id))!)).toBeUndefined()
    await updateJob(q.id, { realMaterialCents: 150000, realHours: 10 })
    const quote = (await getQuote(q.id))!
    const p = jobProfit(biz, quote)!
    // Hora de taller: (20,000 + 8,000) / (24 × 9) = $129.63
    expect(p.realCostCents).toBe(150000 + 129630)
    expect(p.profitCents).toBe(quote.subtotalCents - p.realCostCents)
    expect(p.overCents).toBe(p.realCostCents - quote.quoter!.costCents)
    await updateJob(q.id, { realHours: undefined, note: 'color nogal', warrantyMonths: 12 })
    expect((await getQuote(q.id))!.job).toMatchObject({ realMaterialCents: 150000, note: 'color nogal', warrantyMonths: 12 })
    expect((await getQuote(q.id))!.job!.realHours).toBeUndefined()
  })

  it('garantía: corre desde la entrega', () => {
    expect(warrantyUntil({ stage: 'instalado', startedAt: '', deliveredAt: '2026-12-04', warrantyMonths: 12 })).toBe('2027-12-04')
    expect(warrantyUntil({ stage: 'corte', startedAt: '', warrantyMonths: 12 })).toBeUndefined()
  })

  it('lista de compras: hojas según el acomodo, herrajes, tubos y riel', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    const list = shoppingList((await getQuote(q.id))!, DEFAULT_CONFIG)
    expect(list.find((i) => i.name.startsWith('Hoja de melamina'))).toMatchObject({ qty: 2, unit: 'hojas' })
    expect(list.find((i) => i.name === 'Bisagras')).toMatchObject({ qty: 4 })
    expect(list.find((i) => i.name === 'Jaladeras')).toMatchObject({ qty: 2 })
    const c = await saveQuoterQuote(biz, { ...tv, type: 'closet', med: { ...DEFAULT_SPECS.closet, puertas: 2, puertaTipo: 'corrediza' } }, { ...x, customer: 'Luis' })
    const closet = shoppingList((await getQuote(c.id))!, DEFAULT_CONFIG)
    expect(closet.find((i) => i.name.startsWith('Riel'))).toMatchObject({ qty: 2.4, unit: 'metros' })
    expect(closet.find((i) => i.name === 'Tubo para colgar')).toMatchObject({ qty: 2.4 })
    expect(closet.find((i) => i.name === 'Soportes de tubo')).toMatchObject({ qty: 4 })
    expect(closet.find((i) => i.name === 'Bisagras')).toBeUndefined()
    expect(shoppingText((await getQuote(c.id))!, DEFAULT_CONFIG, 'Luis')).toContain('*Lista de compras: Closet (Luis)*')
  })
})

describe('saldo y fotos de la obra', () => {
  it('una obra instalada sin liquidar cuenta como saldo por cobrar', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await startJob(q.id)
    await setJobStage(q.id, 'instalado', '2026-11-25')
    const quote = (await getQuote(q.id))!
    expect(awaitingPayment(quote.job!)).toBe(true)
    expect((await jobSummary(biz, '2026-11-25')).unpaid).toBe(1)
    expect(balanceDue(quote)).toBe(quote.totalCents - quote.advanceCents)
    const msg = balanceReminder({ customer: 'Ana López', businessName: 'Taller', title: quote.title, balanceCents: balanceDue(quote), currency: 'MXN' })
    expect(msg).toContain('Hola Ana,')
    expect(msg).toContain('mueble de tv')
    await setJobStage(q.id, 'liquidado')
    expect((await jobSummary(biz, '2026-11-25')).unpaid).toBe(0)
  })

  it('fotos: hasta 4 por obra, solo JPEG reducido, y se pueden quitar', async () => {
    const q = await saveQuoterQuote(biz, tv, x)
    await startJob(q.id)
    const foto = (n: number) => `data:image/jpeg;base64,${'A'.repeat(100)}${n}`
    await expect(addJobPhoto(q.id, 'data:image/png;base64,AAAA')).rejects.toThrow('no es válida')
    await expect(addJobPhoto(q.id, `data:image/jpeg;base64,${'A'.repeat(200_000)}`)).rejects.toThrow('pesa demasiado')
    for (let i = 0; i < 4; i++) await addJobPhoto(q.id, foto(i))
    await expect(addJobPhoto(q.id, foto(5))).rejects.toThrow('Máximo 4')
    await removeJobPhoto(q.id, 0)
    expect((await getQuote(q.id))!.job!.photos).toEqual([foto(1), foto(2), foto(3)])
  })
})
