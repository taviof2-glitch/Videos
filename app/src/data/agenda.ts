// Agenda: visitas para medir, instalaciones, entregas y otras citas del taller.
import { db } from './db'
import type { Appointment, AppointmentKind } from './types'
import { actorId } from './team'

export const KIND_LABEL: Record<AppointmentKind, string> = { medir: 'Ir a medir', instalar: 'Instalar', entregar: 'Entregar', otro: 'Otra cita' }
export const KINDS = Object.keys(KIND_LABEL) as AppointmentKind[]

export type AppointmentInput = {
  kind: AppointmentKind
  date: string
  time?: string
  contactId?: string
  title?: string
  address?: string
  note?: string
  linkId?: string
}

function clean(input: AppointmentInput) {
  if (!KINDS.includes(input.kind)) throw new Error('Elige qué tipo de cita es')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error('Elige el día')
  const time = (input.time ?? '').trim()
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('La hora no es válida')
  const title = (input.title ?? '').trim()
  if (!title && !input.contactId) throw new Error('Escribe a quién se visita o elige un cliente')
  return {
    kind: input.kind, date: input.date, title, address: (input.address ?? '').trim(), note: (input.note ?? '').trim(),
    ...(time && { time }), ...(input.contactId && { contactId: input.contactId }), ...(input.linkId && { linkId: input.linkId }),
  }
}

export async function createAppointment(businessId: string, input: AppointmentInput): Promise<Appointment> {
  const now = new Date().toISOString()
  const by = await actorId(businessId)
  const a: Appointment = { id: crypto.randomUUID(), businessId, ...clean(input), ...(by && { createdBy: by }), createdAt: now, updatedAt: now }
  await db.appointment.add(a)
  return a
}

export async function updateAppointment(id: string, input: AppointmentInput): Promise<Appointment> {
  return db.transaction('rw', db.appointment, async () => {
    const cur = await db.appointment.get(id)
    if (!cur || cur.deletedAt) throw new Error('La cita ya no existe')
    const { time: _t, contactId: _c, linkId: _l, ...rest } = cur
    const next: Appointment = { ...rest, ...clean(input), updatedAt: new Date().toISOString() }
    await db.appointment.put(next)
    return next
  })
}

export async function setAppointmentDone(id: string, done: boolean): Promise<void> {
  await db.appointment.update(id, { done, updatedAt: new Date().toISOString() })
}

export async function removeAppointment(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.appointment.update(id, { deletedAt: now, updatedAt: now })
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  const a = await db.appointment.get(id)
  return a && !a.deletedAt ? a : undefined
}

const byWhen = (a: Appointment, b: Appointment) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99')

/** Citas entre dos días (incluidos), en orden de día y hora. */
export async function listAppointments(businessId: string, from: string, to: string): Promise<Appointment[]> {
  const rows = await db.appointment.where('[businessId+date]').between([businessId, from], [businessId, to], true, true).toArray()
  return rows.filter((a) => !a.deletedAt).sort(byWhen)
}

/** Citas pendientes de días pasados (no se marcaron como hechas). */
export async function overdueAppointments(businessId: string, today: string): Promise<Appointment[]> {
  const rows = await db.appointment.where('[businessId+date]').between([businessId, '0000-00-00'], [businessId, today], true, false).toArray()
  return rows.filter((a) => !a.deletedAt && !a.done).sort(byWhen)
}

/** Enlace para abrir la dirección en Google Maps (o la app de mapas del teléfono). */
export const mapsLink = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

/** «10:30» → «10:30 a. m.» */
export function formatTime(t?: string): string {
  if (!t) return 'Sin hora'
  const [h, m] = t.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}
