import type { PaymentMethod } from './types'

export const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
]
export const METHOD_LABEL: Record<PaymentMethod, string> = Object.fromEntries(METHODS.map((m) => [m.value, m.label])) as Record<PaymentMethod, string>
