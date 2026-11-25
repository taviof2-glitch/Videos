import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { docNumber } from '../data/folio'
import { formatMoney } from '../data/money'
import { listOrders } from '../data/orders'
import type { Business } from '../data/types'
import { formatDateTime } from '../ui/forms'
import OrderBadge from '../ui/OrderBadge'

const TABS = [
  { value: 'abiertos', label: 'Abiertos' },
  { value: 'pagados', label: 'Pagados' },
  { value: 'cancelados', label: 'Cancelados' },
] as const
type Tab = (typeof TABS)[number]['value']
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** S19: pedidos de los clientes. */
export default function Orders({ business }: { business: Business }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const orders = useLiveQuery(() => listOrders(business.id), [business.id])
  const tab: Tab = TABS.some((t) => t.value === params.get('t')) ? (params.get('t') as Tab) : 'abiertos'
  const shown = useMemo(() => {
    const q = normalize(search.trim())
    return (orders ?? []).filter((o) => {
      const inTab = tab === 'abiertos' ? o.status === 'pending' || o.status === 'processing' : tab === 'pagados' ? o.status === 'paid' : o.status === 'cancelled'
      return inTab && (!q || normalize(`${o.customerName} ${docNumber(o)}`).includes(q))
    })
  }, [orders, tab, search])

  return (
    <>
      <section className="row-between">
        <h1>Pedidos</h1>
        <Link to="/pedidos/nuevo" className="btn primary small">+ Pedido</Link>
      </section>
      {!orders ? (
        <p className="loading">Cargando…</p>
      ) : orders.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>📥</span>
          <h2>Aún no tienes pedidos</h2>
          <p className="muted">Cuando un cliente te mande un pedido desde tu catálogo por WhatsApp, pégalo aquí y se arma solo.</p>
          <Link to="/pedidos/pegar" className="btn primary">Pegar un pedido de WhatsApp</Link>
          <Link to="/catalogo" className="btn ghost">Configurar mi catálogo</Link>
        </section>
      ) : (
        <>
          <Link to="/pedidos/pegar" className="btn sale">Pegar pedido de WhatsApp</Link>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.value} type="button" role="tab" aria-selected={tab === t.value} className={`tab-btn ${tab === t.value ? 'on' : ''}`} onClick={() => setParams(t.value === 'abiertos' ? {} : { t: t.value }, { replace: true })}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="search" placeholder="Buscar por cliente o número" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar pedido" />
          {shown.length === 0 ? (
            <section className="card"><p className="muted">No hay pedidos en esta lista.</p></section>
          ) : (
            <section className="card list">
              {shown.map((o) => (
                <Link key={o.id} to={`/pedidos/${o.id}`} className="quote-row">
                  <div className="row-between">
                    <strong>{docNumber(o)} · {o.customerName || 'Sin nombre'}</strong>
                    <strong>{formatMoney(o.totalCents, business.currency)}</strong>
                  </div>
                  <div className="row-between">
                    <OrderBadge status={o.status} />
                    <small className="muted">{formatDateTime(o.createdAt)}{o.source === 'catalog' ? ' · catálogo' : ''}</small>
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
