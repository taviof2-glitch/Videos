import { createContact } from '../data/contacts'
import type { ContactType, Transaction } from '../data/types'

export { METHODS, METHOD_LABEL } from '../data/methods'

/** Valor del <select> para "crear uno nuevo desde aquí". */
export const NEW_OPTION = '__nuevo__'

/**
 * Devuelve el id elegido, creando el contacto si se escogió "nuevo". '' = ninguno.
 * `onCreated` se llama en cuanto se crea, para que el formulario pase a elegir ese contacto:
 * si el guardado falla después y la persona reintenta, no se crea otro igual.
 */
export async function resolveContactId(
  businessId: string,
  type: ContactType,
  value: string,
  newName: string,
  onCreated?: (id: string) => void,
): Promise<string> {
  if (value !== NEW_OPTION) return value
  if (!newName.trim()) return ''
  const { id } = await createContact(businessId, type, { name: newName })
  onCreated?.(id)
  return id
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
