// Seguimiento de cotizaciones: a los 3, 7 y 15 días sin respuesta toca escribirle al cliente, con un mensaje distinto
// cada vez. También el resumen del mes: cuántas se cerraron y cuánto dinero quedó sin cerrar.
import { daysBetween } from './dates'
import { db } from './db'
import type { Quote } from './types'

export const FOLLOW_DAYS = [3, 7, 15]

const open = (q: Pick<Quote, 'status'>) => q.status === 'pending'

/** Qué seguimiento toca hoy (0, 1 o 2) o undefined si no toca. */
export function followUpDue(q: Pick<Quote, 'status' | 'createdAt' | 'validUntil' | 'followUps' | 'deletedAt'>, today: string): number | undefined {
  if (q.deletedAt || !open(q)) return undefined
  const done = q.followUps?.length ?? 0
  if (done >= FOLLOW_DAYS.length) return undefined
  if (q.followUps?.includes(today)) return undefined
  const age = daysBetween(q.createdAt.slice(0, 10), today)
  return age >= FOLLOW_DAYS[done] ? done : undefined
}

export function followUpMessage(stage: number, o: { customer: string; title: string; business: string; validUntil?: string }): string {
  const name = o.customer.split(' ')[0] || ''
  const what = o.title ? ` del ${o.title.toLowerCase()}` : ''
  if (stage === 0) return `Hola ${name}, ¿cómo está? Le escribo de ${o.business} para saber si pudo revisar la cotización${what}. Si tiene alguna duda o quiere ajustar medidas o materiales, con gusto lo vemos.`
  if (stage === 1) return `Hola ${name}, buen día. Sigo a sus órdenes con la cotización${what}. Si le interesa, podemos apartar su lugar en el taller con un anticipo y le doy fecha de entrega. ¿Le gustaría que lo agendemos?`
  return `Hola ${name}, le escribo por última vez sobre la cotización${what} de ${o.business}${o.validUntil ? `, que sigue vigente hasta el ${o.validUntil.split('-').reverse().join('/')}` : ''}. Si por ahora no es buen momento, no se preocupe; aquí estamos cuando lo necesite.`
}

export async function markFollowUp(quoteId: string, today: string): Promise<void> {
  const q = await db.quote.get(quoteId)
  if (!q) return
  await db.quote.update(quoteId, { followUps: [...(q.followUps ?? []), today], updatedAt: new Date().toISOString() })
}

export type MonthQuotes = { made: number; closed: number; closedCents: number; lost: number; lostCents: number; waiting: number; waitingCents: number; rate: number }

/** Cotizaciones hechas en el mes (AAAA-MM): cuántas se cerraron, cuántas se perdieron y cuántas siguen esperando. */
export function monthQuotes(quotes: Quote[], month: string, today: string): MonthQuotes {
  const mine = quotes.filter((q) => !q.deletedAt && q.createdAt.slice(0, 7) === month)
  const closed = mine.filter((q) => q.status === 'converted' || q.status === 'accepted' || !!q.job)
  const lost = mine.filter((q) => !closed.includes(q) && (q.status === 'rejected' || q.validUntil < today))
  const waiting = mine.filter((q) => !closed.includes(q) && !lost.includes(q))
  const sum = (l: Quote[]) => l.reduce((s, q) => s + q.totalCents, 0)
  return { made: mine.length, closed: closed.length, closedCents: sum(closed), lost: lost.length, lostCents: sum(lost), waiting: waiting.length, waitingCents: sum(waiting), rate: mine.length ? Math.round((closed.length / mine.length) * 100) : 0 }
}
