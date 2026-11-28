// Postventa: después de entregar, pedir una reseña (a los 2 días) y a los 6 meses ofrecer el ajuste de puertas y bisagras.
import { addDays, daysBetween } from './dates'
import type { JobItem } from './jobs'

export type AfterSale = { item: JobItem; kind: 'review' | 'adjust'; days: number }

/** Qué toca hoy: reseña entre 2 y 14 días después de entregar; ajuste entre 6 y 8 meses. */
export function afterSaleDue(jobs: JobItem[], today: string): AfterSale[] {
  const out: AfterSale[] = []
  for (const item of jobs) {
    const d = item.job.deliveredAt
    if (!d) continue
    const days = daysBetween(d, today)
    if (!item.job.reviewAsked && days >= 2 && days <= 14) out.push({ item, kind: 'review', days })
    if (!item.job.adjustOffered && days >= 180 && days <= 240) out.push({ item, kind: 'adjust', days })
  }
  return out.sort((a, b) => a.days - b.days)
}

export function afterSaleMessage(kind: AfterSale['kind'], o: { customer: string; title: string; business: string; reviewUrl?: string }): string {
  const name = o.customer.split(' ')[0] || ''
  const what = o.title ? ` su ${o.title.toLowerCase()}` : ' su mueble'
  if (kind === 'review') {
    return `Hola ${name}, le saluda ${o.business}. Esperamos que esté disfrutando${what}. ¿Nos ayudaría con una reseña? A otros clientes les sirve mucho para conocernos${o.reviewUrl ? `: ${o.reviewUrl}` : ' (en Google o en nuestra página de Facebook).'} ¡Muchas gracias por su confianza!`
  }
  return `Hola ${name}, le saluda ${o.business}. Ya van unos meses con${what}. Con el uso a veces las puertas o cajones se desajustan un poco; si gusta, pasamos a revisarlas y ajustar bisagras sin costo. ¿Le acomoda algún día de esta semana?`
}

/** Para pruebas y para el resumen del día: cuándo empieza cada aviso. */
export const afterSaleStarts = (deliveredAt: string) => ({ review: addDays(deliveredAt, 2), adjust: addDays(deliveredAt, 180) })
