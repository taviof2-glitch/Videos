import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { db } from './db'
import { groupOffcuts, listOffcuts, planWithOffcuts, saveOffcuts, applyOffcutPlan, usableRests } from './offcuts'
import type { Offcut } from './types'

let biz: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = (await createBusiness({ name: 'Taller' })).id
})
const o = (id: string, l: number, a: number, color = 'Blanco', esp = 16): Offcut => ({ id, l, a, esp, color, kind: 'tablero', at: '' })

describe('retacera', () => {
  it('solo cuentan los sobrantes aprovechables', () => {
    expect(usableRests([{ w: 1200, h: 400 }, { w: 100, h: 900 }, { w: 250, h: 250 }, { w: 500, h: 2400 }])).toEqual([{ l: 2400, a: 500 }, { l: 1200, a: 400 }])
  })
  it('sale con retazos: acomoda piezas y dice qué falta', () => {
    const stock = [o('a', 1200, 500), o('b', 800, 400), o('c', 1000, 600, 'Nogal'), o('d', 900, 900, 'Blanco', 18)]
    const ok = planWithOffcuts([{ n: 'Repisa', l: 560, a: 300, q: 2 }, { n: 'Costado', l: 700, a: 350, q: 1 }], stock, { kind: 'tablero', esp: 16, color: 'blanco' })
    expect(ok.fits).toBe(true)
    expect(ok.candidates).toBe(2)
    expect(ok.used.flatMap((u) => u.pieces).length).toBe(3)
    const no = planWithOffcuts([{ n: 'Costado alto', l: 1800, a: 500, q: 1 }, { n: 'Repisa', l: 500, a: 300, q: 1 }], stock, { kind: 'tablero', esp: 16, color: 'Blanco' })
    expect(no.fits).toBe(false)
    expect(no.missing.map((m) => m.n)).toEqual(['Costado alto'])
  })
  it('usar el plan quita los retazos usados y guarda lo que sobra', async () => {
    await saveOffcuts(biz, [{ l: 1200, a: 600, esp: 16, color: 'Blanco', kind: 'tablero' }, { l: 2000, a: 300, esp: 3, color: 'Blanco', kind: 'fondo' }])
    const stock = listOffcuts((await db.business.get(biz))!)
    const plan = planWithOffcuts([{ n: 'Repisa', l: 600, a: 600, q: 1 }], stock, { kind: 'tablero', esp: 16 })
    expect(plan.fits).toBe(true)
    await applyOffcutPlan(biz, plan, 'Buró')
    const after = listOffcuts((await db.business.get(biz))!)
    expect(after.find((x) => x.kind === 'fondo')).toBeTruthy()
    const left = after.filter((x) => x.kind === 'tablero')
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ l: 600, a: 596, from: 'Buró' })
    expect(groupOffcuts(after).map((g) => g.key)).toEqual(['Fondo 3 mm · Blanco', 'Tablero 16 mm · Blanco'])
  })
})
