import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { afterSaleDue, afterSaleMessage } from '../data/aftersale'
import { listContacts } from '../data/contacts'
import { listJobs, updateJob } from '../data/jobs'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

/** Postventa: a quién pedirle reseña (recién entregado) y a quién ofrecerle el ajuste de los 6 meses. */
export default function AfterSaleCard({ business, today }: { business: Business; today: string }) {
  const [hidden, setHidden] = useState<string[]>([])
  const data = useLiveQuery(async () => ({ jobs: await listJobs(business.id), contacts: new Map((await listContacts(business.id, 'customer')).map((c) => [c.id, c])) }), [business.id])
  if (!data) return null
  const due = afterSaleDue(data.jobs, today).filter((d) => !hidden.includes(`${d.item.id}:${d.kind}`))
  if (!due.length) return null
  const done = (id: string, kind: 'review' | 'adjust') => {
    setHidden((h) => [...h, `${id}:${kind}`])
    void updateJob(id, kind === 'review' ? { reviewAsked: today } : { adjustOffered: today })
  }
  return (
    <section className="card">
      <h2><Star className="i-inline" aria-hidden /> Postventa <small className="muted">({due.length})</small></h2>
      <p className="muted">Clientes recién entregados para pedirles una reseña, y los de hace 6 meses para ofrecer el ajuste de puertas y bisagras.{!business.reviewUrl && ' Pon tu enlace de reseñas de Google en «Datos del negocio» para incluirlo en el mensaje.'}</p>
      <ul className="moves">
        {due.map(({ item, kind, days }) => {
          const c = data.contacts.get(item.contactId ?? '')
          const text = afterSaleMessage(kind, { customer: c?.name ?? '', title: item.title, business: business.name, reviewUrl: business.reviewUrl })
          return (
            <li key={`${item.id}:${kind}`} className="followup">
              <span><strong>{c?.name ?? 'Cliente'}</strong> · {item.title}<small className="muted"> · {kind === 'review' ? `entregado hace ${days} días: pedir reseña` : `entregado hace ${Math.round(days / 30)} meses: ofrecer ajuste`}</small></span>
              <span className="quick">
                <a className="btn sale small" href={whatsappLink(text, c?.phone ?? '', business.country)} target="_blank" rel="noopener noreferrer" onClick={() => done(item.id, kind)}>Mandar mensaje</a>
                <button type="button" className="btn ghost small" onClick={() => done(item.id, kind)}>Listo</button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
