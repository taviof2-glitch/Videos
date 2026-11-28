import { beforeEach, describe, expect, it } from 'vitest'
import { defaultValues, templateOf, type BaseState } from './bases'
import { createBusiness } from './business'
import { createContact } from './contacts'
import { db } from './db'
import { startJob } from './jobs'
import { baseItems, materialNeeds } from './materialNeeds'
import { saveMaterial } from './materials'
import { createQuote } from './quotes'
import { DEFAULT_CONFIG } from './quoter'
import type { Business } from './types'

let biz: Business
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'House Lite' })
})

const closet = (): BaseState => {
  const t = templateOf('closet')
  return { key: 'closet', values: defaultValues(t), opts: { esp: 16, veta: false, suave: true, cubierta: false, iguales: 1, fondo: 'embutido', estilo: 'A' } }
}

async function jobFromBase(title: string, due: string, base = closet()) {
  const ana = await createContact(biz.id, 'customer', { name: `Cliente ${title}` })
  const q = await createQuote(biz.id, { title, contactId: ana.id, validUntil: '2026-12-30', items: [{ name: title, quantity: 1, unitPriceCents: 100000 }] })
  await db.quote.update(q.id, { quoter: { type: 'otro', q: 1, suave: true, pint: false, cub: false, km: 0, xmat: 0, xhrs: 0, desc: '', delivery: '', iva: false, costCents: 0, base } })
  await startJob(q.id, { deliveryDate: due })
  return q.id
}

describe('material necesario', () => {
  it('los muebles de Bases dicen qué llevan', () => {
    const items = baseItems(closet(), DEFAULT_CONFIG)
    expect(items.find((i) => i.name === 'Hoja de melamina de 16 mm')?.qty).toBeGreaterThan(0)
    expect(items.some((i) => i.name === 'Bisagras')).toBe(true)
  })
  it('compara contra el taller, reparte por fecha y dice qué comprar', async () => {
    const first = await jobFromBase('Closet A', '2026-12-01')
    await jobFromBase('Closet B', '2026-12-10')
    const sheets = baseItems(closet(), DEFAULT_CONFIG).find((i) => i.name.startsWith('Hoja de melamina'))!.qty
    await saveMaterial(biz.id, { name: 'Hoja de melamina 16 mm blanca', unit: 'hojas', stock: sheets, prices: [{ supplier: 'Maximaderas', priceCents: 110000 }] })
    const n = await materialNeeds((await db.business.get(biz.id))!)
    const mel = n.lines.find((l) => l.materialId)!
    expect(mel.need).toBe(sheets * 2)
    expect(mel.have).toBe(sheets)
    expect(mel.short).toBe(sheets)
    expect(mel.supplier).toBe('Maximaderas')
    // La de entrega más cercana se queda con las hojas que hay.
    const a = n.jobs.find((j) => j.id === first)!
    expect(a.items.find((i) => i.name.startsWith('Hoja de melamina'))!.missing).toBe(0)
    expect(n.jobs[1].items.find((i) => i.name.startsWith('Hoja de melamina'))!.missing).toBe(sheets)
    expect(n.unknown.some((l) => l.name === 'Bisagras')).toBe(true)
    expect(n.buyCents).toBe(sheets * 110000)
  })
})

describe('obras sin medidas y material a mano', () => {
  it('estima por metro y suma lo agregado a mano; muestra las obras sin nada', async () => {
    const ana = await createContact(biz.id, 'customer', { name: 'Ana' })
    const q = await createQuote(biz.id, { title: 'Closet 2 m', contactId: ana.id, validUntil: '2026-12-30', items: [{ name: 'Closet', quantity: 1, unitPriceCents: 100000 }] })
    await db.quote.update(q.id, { quoter: { type: 'closet', q: 2, suave: true, pint: false, cub: false, km: 0, xmat: 0, xhrs: 0, desc: '', delivery: '', iva: false, costCents: 0 } })
    await startJob(q.id)
    const q2 = await createQuote(biz.id, { title: 'A mano', contactId: ana.id, validUntil: '2026-12-30', items: [{ name: 'Mueble', quantity: 1, unitPriceCents: 100000 }] })
    await startJob(q2.id)
    let n = await materialNeeds((await db.business.get(biz.id))!)
    const est = n.jobs.find((j) => j.id === q.id)!
    expect(est.items.find((i) => i.name === 'Bisagras')).toMatchObject({ qty: 12, est: true }) // 6 por metro × 2 m
    expect(n.jobs.find((j) => j.id === q2.id)!.items).toHaveLength(0)
    const { updateJob } = await import('./jobs')
    await updateJob(q2.id, { extraMaterial: [{ name: 'Jaladeras', qty: 4, unit: 'piezas' }] })
    n = await materialNeeds((await db.business.get(biz.id))!)
    expect(n.jobs.find((j) => j.id === q2.id)!.items).toMatchObject([{ name: 'Jaladeras', qty: 4 }])
  })
})
