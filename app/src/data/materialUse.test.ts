import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { DEFAULT_SPECS } from './cutlist'
import { db } from './db'
import { startJob } from './jobs'
import { listMaterials, saveMaterial } from './materials'
import { applyMaterialUse, matchMaterial, planMaterialUse, undoMaterialUse, materialUseCost } from './materialUse'
import { saveQuoterQuote } from './quoter'
import { getQuote } from './quotes'
import type { Business } from './types'

let biz: Business
const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }
const fresh = async () => (await db.business.get(biz.id))!

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = await createBusiness({ name: 'Taller' })
})

describe('material de una obra', () => {
  it('encuentra el material del taller por nombre', async () => {
    const list = [
      { id: 'a', name: 'Hoja de melamina blanca 16 mm', unit: 'hojas', stock: 5, prices: [] },
      { id: 'b', name: 'Hoja de fondo 3 mm', unit: 'hojas', stock: 2, prices: [] },
      { id: 'c', name: 'Bisagra cierre suave', unit: 'piezas', stock: 20, prices: [] },
    ]
    expect(matchMaterial('Hoja de melamina de 16 mm (2.44 × 1.22 m)', list)).toBe('a')
    expect(matchMaterial('Hoja de fondo de 3 mm (2.44 × 1.22 m)', list)).toBe('b')
    expect(matchMaterial('Bisagras', list)).toBe('c')
    expect(matchMaterial('Correderas', list)).toBe('')
  })

  it('descuenta lo del despiece, deja retazos y se puede deshacer', async () => {
    const mel = await saveMaterial(biz.id, { name: 'Hoja de melamina 16 mm', unit: 'hojas', stock: 5, prices: [{ supplier: 'López', priceCents: 90000 }] })
    const bis = await saveMaterial(biz.id, { name: 'Bisagras', unit: 'piezas', stock: 3, prices: [] })
    const q = await saveQuoterQuote(await fresh(), tv, { customer: 'Ana', description: '', delivery: '2 semanas', iva: false, ivaRate: 16, phone: '' })
    await startJob(q.id)
    const plan = planMaterialUse(await fresh(), (await getQuote(q.id))!)!
    const sheets = plan.lines.find((l) => l.name.startsWith('Hoja de melamina'))!
    expect(sheets).toMatchObject({ qty: 2, materialId: mel.id })
    expect(plan.lines.find((l) => l.name === 'Bisagras')).toMatchObject({ qty: 4, materialId: bis.id })
    for (const o of plan.offcuts) expect(o.a).toBeGreaterThanOrEqual(150)

    const use = await applyMaterialUse(biz.id, q.id, plan.lines, plan.offcuts)
    let list = listMaterials(await fresh())
    expect(list.find((m) => m.id === mel.id)!.stock).toBe(3)
    expect(list.find((m) => m.id === bis.id)!.stock).toBe(0) // no baja de cero
    expect(materialUseCost(use)).toBe(180000)
    expect((await fresh()).offcuts?.length).toBe(plan.offcuts.length)
    await expect(applyMaterialUse(biz.id, q.id, plan.lines, [])).rejects.toThrow(/ya se descontó/)

    await undoMaterialUse(biz.id, q.id)
    list = listMaterials(await fresh())
    expect(list.find((m) => m.id === mel.id)!.stock).toBe(5)
    expect(list.find((m) => m.id === bis.id)!.stock).toBe(3)
    expect((await fresh()).offcuts ?? []).toEqual([])
    expect((await getQuote(q.id))!.job!.materialUse).toBeUndefined()
  })
})
