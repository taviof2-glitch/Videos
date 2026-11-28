import { describe, expect, it } from 'vitest'
import { estimateRange } from './leadTypes'
import { dayRoute, installChecklist, TOOLS } from './fieldwork'
import { withFavorite, MAX_FAVORITES } from './favorites'
import { fillCampaign } from './campaigns'
import { toBackupFile } from '../sync/cloudBackup'
import type { Appointment } from './types'
import type { JobItem } from './jobs'

const ap = (p: Partial<Appointment>): Appointment => ({ id: Math.random().toString(), businessId: 'b', kind: 'instalar', date: '2026-11-28', title: 'x', address: '', note: '', createdAt: '', updatedAt: '', ...p }) as Appointment

describe('cotizador en línea', () => {
  it('rango ±15 % redondeado a $100', () => {
    expect(estimateRange(650000, 2)).toEqual([1110000, 1500000])
    expect(estimateRange(100000, 0)[0]).toBe(30000)
  })
})

describe('ruta del día', () => {
  it('ordena por hora, salta hechas y sin dirección', () => {
    const r = dayRoute([ap({ time: '12:00', address: 'B' }), ap({ time: '09:00', address: 'A 1' }), ap({ address: '' }), ap({ time: '08:00', address: 'Z', done: true })])!
    expect(r.stops.map((s) => s.address)).toEqual(['A 1', 'B'])
    expect(r.url).toContain('destination=B')
    expect(r.url).toContain('waypoints=A%201')
  })
  it('sin direcciones no hay ruta', () => expect(dayRoute([ap({})])).toBeUndefined())
})

describe('lista para instalar', () => {
  it('herramienta siempre y cobro si hay saldo', () => {
    const items = installChecklist({ balanceCents: 500000, job: {} } as unknown as JobItem, {} as never, (c) => `$${c / 100}`)
    expect(items.filter((i) => i.group === 'herramienta')).toHaveLength(TOOLS.length)
    expect(items.find((i) => i.group === 'cobro')?.label).toContain('$5000')
  })
})

describe('favoritos', () => {
  it('reemplaza el mismo nombre y limita', () => {
    let l = withFavorite(undefined, 'Closet 2m', { a: 1 })
    l = withFavorite(l, 'closet 2m', { a: 2 })
    expect(l).toHaveLength(1)
    expect(l[0].state).toEqual({ a: 2 })
    for (let i = 0; i < 30; i++) l = withFavorite(l, `m${i}`, {})
    expect(l).toHaveLength(MAX_FAVORITES)
    expect(() => withFavorite(l, '  ', {})).toThrow()
  })
})

describe('campañas y respaldos', () => {
  it('pone el primer nombre y el negocio', () => expect(fillCampaign('Hola {nombre}, {negocio}', { name: 'Ana López', business: 'House Lite' })).toBe('Hola Ana, House Lite'))
  it('respaldo de la nube a archivo de copia', () => {
    const f = toBackupFile([{ tbl: 'contact', data: { id: 'c1' } }, { tbl: 'raro', data: { id: 'x' } }], '2026-11-28T14:00:00Z')
    expect(f.tables.contact).toEqual([{ id: 'c1' }])
    expect(f.tables.raro).toBeUndefined()
    expect(f.tables.txn).toEqual([])
  })
})
