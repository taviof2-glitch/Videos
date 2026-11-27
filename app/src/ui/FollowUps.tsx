import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { docNumber } from '../data/folio'
import { FOLLOW_DAYS, followUpDue, followUpMessage, markFollowUp, monthQuotes } from '../data/followup'
import { formatMoney } from '../data/money'
import { whatsappLink } from '../data/reminder'
import type { Business, Contact, Quote } from '../data/types'

/** Cotizaciones a las que toca escribirles (3, 7 y 15 días sin respuesta) y cómo va el mes. */
export default function FollowUps({ business, quotes, contacts, today }: { business: Business; quotes: Quote[]; contacts: Contact[]; today: string }) {
  const [hidden, setHidden] = useState<string[]>([])
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const due = quotes.flatMap((q) => { const s = followUpDue(q, today); return s === undefined || hidden.includes(q.id) ? [] : [{ q, s }] })
  const m = monthQuotes(quotes, today.slice(0, 7), today)
  const money = (c: number) => formatMoney(c, business.currency)
  const done = (id: string) => { setHidden((h) => [...h, id]); void markFollowUp(id, today) }

  return (
    <>
      {due.length > 0 && (
        <section className="card">
          <h2><MessageCircle className="i-inline" aria-hidden /> Por dar seguimiento <small className="muted">({due.length})</small></h2>
          <p className="muted">Cotizaciones sin respuesta. Un mensaje amable a tiempo cierra más ventas; cada vez es distinto.</p>
          <ul className="moves">
            {due.map(({ q, s }) => {
              const c = byId.get(q.contactId)
              const text = followUpMessage(s, { customer: c?.name ?? '', title: q.title, business: business.name, validUntil: q.validUntil })
              return (
                <li key={q.id} className="followup">
                  <span>
                    <Link to={`/cotizaciones/${q.id}`}><strong>{c?.name ?? 'Cliente'}</strong> · {q.title || docNumber(q)}</Link>
                    <small className="muted"> · {money(q.totalCents)} · {s === 0 ? `${FOLLOW_DAYS[0]}+ días sin respuesta` : s === 1 ? 'segundo seguimiento' : 'último seguimiento'}</small>
                  </span>
                  <span className="quick">
                    <a className="btn sale small" href={whatsappLink(text, c?.phone ?? '', business.country)} target="_blank" rel="noopener noreferrer" onClick={() => done(q.id)}>Mandar mensaje</a>
                    <button type="button" className="btn ghost small" onClick={() => done(q.id)}>Ya le escribí</button>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {m.made > 0 && (
        <section className="card">
          <h2>Este mes</h2>
          <div className="fixed-totals">
            <div><small className="muted">Hiciste</small><strong>{m.made}</strong></div>
            <div><small className="muted">Cerraste</small><strong className="amount sale">{m.closed} <small>({m.rate} %)</small></strong></div>
            <div><small className="muted">Esperando</small><strong>{m.waiting}</strong></div>
          </div>
          <p className="muted">Cerrado: <strong>{money(m.closedCents)}</strong>{m.waitingCents > 0 ? ` · por cerrar: ${money(m.waitingCents)}` : ''}{m.lostCents > 0 ? ` · se perdió: ${money(m.lostCents)}` : ''}</p>
        </section>
      )}
    </>
  )
}
