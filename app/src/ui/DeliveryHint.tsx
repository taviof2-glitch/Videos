import { useLiveQuery } from 'dexie-react-hooks'
import { capacity, jobHours } from '../data/capacity'
import { formatDay } from '../data/dates'
import { listJobs } from '../data/jobs'
import type { Business, Quote } from '../data/types'

/** «Si te la aceptan hoy, la podrías entregar el …», según el trabajo que ya hay en el taller. */
export default function DeliveryHint({ business, quote, today }: { business: Business; quote: Quote; today: string }) {
  const jobs = useLiveQuery(() => listJobs(business.id), [business.id])
  if (!jobs || quote.job || quote.status === 'converted' || quote.status === 'rejected') return null
  const hours = jobHours(business, { id: quote.id, kind: 'quote', job: { stage: 'anticipo', startedAt: '' }, title: quote.title, folio: '', totalCents: 0, incomeCents: 0, balanceCents: 0, quote })
  const cap = capacity(business, jobs.filter((j) => j.id !== quote.id && j.job.stage !== 'liquidado'), today, hours)
  return <p className="muted">🗓️ Si te la aceptan hoy, con el trabajo que ya tienes podrías entregarla el <strong>{formatDay(cap.nextDelivery)}</strong> (≈ {Math.round(hours)} h de trabajo).</p>
}
