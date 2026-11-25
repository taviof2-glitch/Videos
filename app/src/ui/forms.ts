import { createContact } from '../data/contacts'
import type { ContactType, PaymentMethod, Transaction } from '../data/types'

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
]
export const METHOD_LABEL: Record<PaymentMethod, string> = Object.fromEntries(METHODS.map((m) => [m.value, m.label])) as Record<PaymentMethod, string>

/** Valor del <select> para "crear uno nuevo desde aquí". */
export const NEW_OPTION = '__nuevo__'

/** Devuelve el id elegido, creando el contacto si se escogió "nuevo". '' = ninguno. */
export async function resolveContactId(businessId: string, type: ContactType, value: string, newName: string): Promise<string> {
  if (value !== NEW_OPTION) return value
  return newName.trim() ? (await createContact(businessId, type, { name: newName })).id : ''
}

/** ISO UTC -> valor de <input type="datetime-local"> en la hora del dispositivo. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): string | undefined {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Título de una fila de movimiento. */
export function movementTitle(t: Pick<Transaction, 'type' | 'concept'>, categoryName?: string): string {
  if (t.concept) return t.concept
  return t.type === 'sale' ? 'Venta rápida' : (categoryName ?? 'Gasto')
}
