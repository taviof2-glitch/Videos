import { formatDay } from './dates'
import { formatMoney } from './money'

/** Prefijo telefónico por país del negocio (se amplía cuando se necesite otro país). */
const CALLING_CODE: Record<string, string> = { MX: '52' }

/**
 * Número listo para wa.me (solo dígitos, con código de país), o undefined si no hay uno usable.
 * En México acepta 10 dígitos, 52 + 10 y el antiguo 521 + 10.
 */
export function whatsappNumber(phone: string, country = 'MX'): string | undefined {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length < 7) return undefined
  const code = CALLING_CODE[country]
  if (code && digits.length === 10) digits = code + digits
  if (country === 'MX' && digits.length === 13 && digits.startsWith('521')) digits = '52' + digits.slice(3)
  return digits
}

/** Enlace que abre WhatsApp con el mensaje escrito. Sin teléfono abre WhatsApp para elegir el chat. */
export function whatsappLink(text: string, phone = '', country = 'MX'): string {
  const number = phone ? whatsappNumber(phone, country) : undefined
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`
}

export function reminderMessage(o: { name: string; businessName: string; balanceCents: number; currency: string; dueDate?: string; overdue: boolean }): string {
  const first = o.name.trim().split(/\s+/)[0]
  const money = formatMoney(o.balanceCents, o.currency)
  const due = !o.dueDate ? '' : o.overdue ? `, vencido desde el ${formatDay(o.dueDate)}` : `, con fecha límite el ${formatDay(o.dueDate)}`
  return `Hola ${first}, te saluda ${o.businessName}. Te recuerdo que tienes un saldo pendiente de ${money}${due}. Gracias por tu apoyo.`
}
