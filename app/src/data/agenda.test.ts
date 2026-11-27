import { beforeEach, describe, expect, it } from 'vitest'
import { createAppointment, formatTime, listAppointments, overdueAppointments, removeAppointment, setAppointmentDone, updateAppointment } from './agenda'
import { createBusiness } from './business'
import { db } from './db'

let biz: string
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  biz = (await createBusiness({ name: 'House Lite' })).id
})

describe('agenda', () => {
  it('crea, ordena por día y hora, y oculta las borradas', async () => {
    await createAppointment(biz, { kind: 'instalar', date: '2026-12-02', time: '16:00', title: 'Closet de Marta', address: 'Hidalgo 12' })
    const a = await createAppointment(biz, { kind: 'medir', date: '2026-12-02', time: '09:30', title: 'Cocina Luis' })
    await createAppointment(biz, { kind: 'entregar', date: '2026-12-01', title: 'Repisas' })
    const x = await createAppointment(biz, { kind: 'otro', date: '2026-12-03', title: 'Borrar' })
    await removeAppointment(x.id)
    const list = await listAppointments(biz, '2026-12-01', '2026-12-07')
    expect(list.map((i) => i.title)).toEqual(['Repisas', 'Cocina Luis', 'Closet de Marta'])
    await updateAppointment(a.id, { kind: 'medir', date: '2026-12-04', title: 'Cocina Luis' })
    expect((await db.appointment.get(a.id))?.time).toBeUndefined()
  })
  it('pide día, hora válida y a quién', async () => {
    await expect(createAppointment(biz, { kind: 'medir', date: '', title: 'x' })).rejects.toThrow(/día/)
    await expect(createAppointment(biz, { kind: 'medir', date: '2026-12-01', time: '25:00', title: 'x' })).rejects.toThrow(/hora/)
    await expect(createAppointment(biz, { kind: 'medir', date: '2026-12-01' })).rejects.toThrow(/quién/)
  })
  it('las pasadas sin marcar quedan pendientes', async () => {
    const a = await createAppointment(biz, { kind: 'medir', date: '2026-11-20', title: 'Vieja' })
    await createAppointment(biz, { kind: 'medir', date: '2026-11-27', title: 'Hoy' })
    expect((await overdueAppointments(biz, '2026-11-27')).map((i) => i.title)).toEqual(['Vieja'])
    await setAppointmentDone(a.id, true)
    expect(await overdueAppointments(biz, '2026-11-27')).toEqual([])
    expect(formatTime('09:05')).toBe('9:05 a. m.')
    expect(formatTime('16:30')).toBe('4:30 p. m.')
    expect(formatTime('12:00')).toBe('12:00 p. m.')
  })
})
