import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { docNumber } from '../data/folio'
import { listContacts } from '../data/contacts'
import { dayKey, formatDay } from '../data/dates'
import { formatMoney } from '../data/money'
import { listQuotes, needsAttention, quoteState, deletingSoon, daysToDelete, keepQuote, purgeStaleQuotes } from '../data/quotes'
import type { Business } from '../data/types'
import QuoteBadge from '../ui/QuoteBadge'
import { FileText, TriangleAlert, Zap } from 'lucide-react'

const TABS = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'cerradas', label: 'Cerradas' },
  { value: 'todas', label: 'Todas' },
] as const
type Tab = (typeof TABS)[number]['value']

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** S26: lista de cotizaciones con pestañas, búsqueda por cliente y aviso de las que están por vencer. */
export default function Quotes({ business }: { business: Business }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const tab: Tab = TABS.some((t) => t.value === params.get('t')) ? (params.get('t') as Tab) : 'pendientes'
  const quotes = useLiveQuery(() => listQuotes(business.id), [business.id])
  const customers = useLiveQuery(() => listContacts(business.id, 'customer'), [business.id])
  const money = (c: number) => formatMoney(c, business.currency)

  const view = useMemo(() => {
    if (!quotes) return undefined
    const names = new Map((customers ?? []).map((c) => [c.id, c.name]))
    const q = normalize(search.trim())
    const open = (x: (typeof quotes)[number]) => x.status === 'pending' || x.status === 'accepted'
    const shown = quotes.filter((x) => {
      if (tab === 'pendientes' && !open(x)) return false
      if (tab === 'cerradas' && open(x)) return false
      return !q || normalize(`${names.get(x.contactId) ?? ''} ${x.title} ${docNumber(x)}`).includes(q)
    })
    return { names, shown, attention: quotes.filter((x) => needsAttention(x, today)).length, soon: deletingSoon(quotes, today, business.timezone) }
  }, [quotes, customers, search, tab, today, business.timezone])
  useEffect(() => { void purgeStaleQuotes(business.id, today, business.timezone).catch(() => undefined) }, [business.id, today, business.timezone])
  const left = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`)

  return (
    <>
      <section className="row-between">
        <h1>Cotizaciones</h1>
        <span className="quick">
          <Link to="/cotizador" className="btn ghost small"><Zap className="i-inline" aria-hidden /> Cotizador</Link>
          <Link to="/cotizaciones/nueva" className="btn primary small">+ Cotización</Link>
        </span>
      </section>

      {!view ? (
        <p className="loading">Cargando…</p>
      ) : quotes!.length === 0 ? (
        <section className="card empty-state">
          <FileText aria-hidden strokeWidth={1.75} />
          <h2>Aún no tienes cotizaciones</h2>
          <p className="muted">Cotiza por pieza, compártela por WhatsApp o PDF y conviértela en venta cuando te la acepten.</p>
          <Link to="/cotizaciones/nueva" className="btn primary">Crear mi primera cotización</Link>
        </section>
      ) : (
        <>
          {view.attention > 0 && (
            <p className="alert static"><TriangleAlert className="i-inline" aria-hidden /> {view.attention === 1 ? '1 cotización por vencer o vencida' : `${view.attention} cotizaciones por vencer o vencidas`}</p>
          )}
          {view.soon.length > 0 && (
            <section className="card form">
              <h2>Se borran pronto</h2>
              <p className="muted">Estas cotizaciones nunca se concretaron y se borran solas al cumplir 30 días. Si quieres conservar alguna, dale «Conservar 30 días más»; si no haces nada, se borran.</p>
              <ul className="fixed-paid">
                {view.soon.map((x) => (
                  <li key={x.id} className="row-between">
                    <Link to={`/cotizaciones/${x.id}`}>{docNumber(x)} · {view.names.get(x.contactId) ?? 'Cliente'} · {money(x.totalCents)} <small className="muted">· se borra {left(daysToDelete(x, today, business.timezone))}</small></Link>
                    <button type="button" className="btn small ghost" onClick={() => void keepQuote(x.id, today, business.timezone)}>Conservar 30 días más</button>
                  </li>
                ))}
              </ul>
              {view.soon.length > 1 && <button type="button" className="btn ghost" onClick={() => void Promise.all(view.soon.map((x) => keepQuote(x.id, today, business.timezone)))}>Conservar todas</button>}
            </section>
          )}
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={`tab-btn ${tab === t.value ? 'on' : ''}`} onClick={() => setParams(t.value === 'pendientes' ? {} : { t: t.value }, { replace: true })}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Buscar por cliente o título" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar cotización" />
          {view.shown.length === 0 ? (
            <section className="card"><p className="muted">No hay cotizaciones en esta lista.</p></section>
          ) : (
            <section className="card list">
              {view.shown.map((x) => (
                <Link key={x.id} to={`/cotizaciones/${x.id}`} className="quote-row">
                  <div className="row-between">
                    <strong>{x.title || `Cotización ${docNumber(x)}`}</strong>
                    <strong>{money(x.totalCents)}</strong>
                  </div>
                  <small className="muted">{docNumber(x)} · {view.names.get(x.contactId) ?? 'Cliente'}</small>
                  <div className="row-between">
                    <QuoteBadge quote={x} today={today} />
                    <small className="muted">{quoteState(x, today) === 'converted' ? 'Vendida' : `Vigencia ${formatDay(x.validUntil)}`}</small>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </>
  )
}
