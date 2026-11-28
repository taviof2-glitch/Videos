import { daysBetween } from '../data/dates'
import { quoteState, type QuoteState } from '../data/quotes'
import type { Quote } from '../data/types'

const LABEL: Record<QuoteState, string> = {
  pending: 'Pendiente', expiring: 'Por vencer', expired: 'Vencida', accepted: 'Aceptada', rejected: 'Rechazada', converted: 'Convertida en venta',
}
const TONE: Record<QuoteState, string> = { pending: 'low', expiring: 'low', expired: 'out', accepted: 'ok', rejected: 'muted', converted: 'ok' }

export default function QuoteBadge({ quote, today }: { quote: Pick<Quote, 'status' | 'validUntil'>; today: string }) {
  const state = quoteState(quote, today)
  const days = daysBetween(today, quote.validUntil)
  const suffix = state === 'expiring' ? (days === 0 ? ' · vence hoy' : ` · ${days} ${days === 1 ? 'día' : 'días'}`) : ''
  return <span className={`badge ${TONE[state]}`}>{LABEL[state]}{suffix}</span>
}
