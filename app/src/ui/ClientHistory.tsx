import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { contactBalance } from '../data/debts'
import { db } from '../data/db'
import { docNumber } from '../data/folio'
import { STAGE_LABEL } from '../data/jobs'
import { formatMoney } from '../data/money'
import type { Business, Contact } from '../data/types'
import { formatDateTime } from './forms'

/** Ficha del cliente: todo lo que ha comprado, lo que debe, sus cotizaciones, obras y fotos. */
export default function ClientHistory({ business, contact }: { business: Business; contact: Contact }) {
  const data = useLiveQuery(async () => {
    const [sales, quotes, balance] = await Promise.all([
      db.txn.where('[businessId+type]').equals([business.id, 'sale']).filter((t) => !t.deletedAt && t.contactId === contact.id).toArray(),
      db.quote.where('contactId').equals(contact.id).filter((q) => !q.deletedAt).toArray(),
      contactBalance(contact.id),
    ])
    return { sales: sales.sort((a, b) => b.date.localeCompare(a.date)), quotes: quotes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), balance }
  }, [business.id, contact.id])
  if (!data) return null
  const money = (c: number) => formatMoney(c, business.currency)
  const total = data.sales.reduce((s, t) => s + t.amountCents, 0)
  const jobs = [...data.quotes.filter((q) => q.job).map((q) => ({ id: q.id, title: q.title, job: q.job! })), ...data.sales.filter((t) => t.job).map((t) => ({ id: t.id, title: t.concept || 'Venta', job: t.job! }))]
  const photos = jobs.flatMap((j) => j.job.photos ?? []).slice(0, 8)
  if (!data.sales.length && !data.quotes.length) return null

  return (
    <section className="card client-history">
      <h2>Historial de {contact.name.split(' ')[0]}</h2>
      <div className="fixed-totals">
        <div><small className="muted">Ha comprado</small><strong className="amount sale">{money(total)}</strong></div>
        <div><small className="muted">Compras</small><strong>{data.sales.length}</strong></div>
        <div><small className="muted">Debe</small><strong className={data.balance > 0 ? 'amount expense' : ''}>{money(data.balance)}</strong></div>
      </div>
      {data.balance > 0 && <Link to={`/deudas/${contact.id}`} className="btn ghost small">Ver su deuda</Link>}
      {jobs.length > 0 && (
        <>
          <h3>Obras</h3>
          <ul className="moves">{jobs.map((j) => <li key={j.id}><span>{j.title}</span><small className="muted">{STAGE_LABEL[j.job.stage]}{j.job.deliveredAt ? ` · entregada ${j.job.deliveredAt}` : ''}</small></li>)}</ul>
        </>
      )}
      {photos.length > 0 && <div className="gallery-more">{photos.map((p, i) => <img key={i} src={p} alt="Foto de su obra" />)}</div>}
      {data.sales.length > 0 && (
        <>
          <h3>Compras</h3>
          <ul className="moves">{data.sales.slice(0, 10).map((t) => <li key={t.id}><Link to={`/venta/${t.id}`} className="grow plain">{t.concept || 'Venta'}<small className="muted"> · {formatDateTime(t.date)}{t.status === 'credit' ? ' · fiado' : ''}</small></Link><strong>{money(t.amountCents)}</strong></li>)}</ul>
        </>
      )}
      {data.quotes.length > 0 && (
        <>
          <h3>Cotizaciones</h3>
          <ul className="moves">{data.quotes.slice(0, 10).map((q) => <li key={q.id}><Link to={`/cotizaciones/${q.id}`} className="grow plain">{docNumber(q)} · {q.title || 'Cotización'}<small className="muted"> · {q.status === 'converted' ? 'vendida' : q.status === 'accepted' ? 'aceptada' : q.status === 'rejected' ? 'rechazada' : 'pendiente'}</small></Link><strong>{money(q.totalCents)}</strong></li>)}</ul>
        </>
      )}
    </section>
  )
}
