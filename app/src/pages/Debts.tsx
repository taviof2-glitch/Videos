import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { dayKey, formatDay } from '../data/dates'
import { debtSummary, type DebtKind } from '../data/debts'
import { formatMoney } from '../data/money'
import type { Business } from '../data/types'

const KINDS: Record<DebtKind, { tab: string; total: string; empty: string; hint: string; cta: string; to: string }> = {
  receivable: {
    tab: 'Por cobrar', total: 'Te deben', empty: 'Nadie te debe por ahora',
    hint: 'Cuando vendas fiado, aquí verás quién te debe y cuánto.', cta: 'Registrar una venta fiada', to: '/venta/nueva',
  },
  payable: {
    tab: 'Por pagar', total: 'Debes', empty: 'No debes nada por ahora',
    hint: 'Cuando registres un gasto a crédito con un proveedor, aparecerá aquí.', cta: 'Registrar un gasto a crédito', to: '/gasto/nuevo',
  },
}

/** S08: cuentas por cobrar (clientes) y por pagar (proveedores). */
export default function Debts({ business }: { business: Business }) {
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const kind: DebtKind = params.get('t') === 'pagar' ? 'payable' : 'receivable'
  const text = KINDS[kind]
  const summary = useLiveQuery(() => debtSummary(business.id, kind, today), [business.id, kind, today])
  const money = (c: number) => formatMoney(c, business.currency)

  return (
    <>
      <h1>Deudas</h1>
      <div className="tabs" role="tablist">
        {(['receivable', 'payable'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={`tab-btn ${kind === k ? 'on' : ''}`} onClick={() => setParams(k === 'payable' ? { t: 'pagar' } : {}, { replace: true })}>
            {KINDS[k].tab}
          </button>
        ))}
      </div>

      {!summary ? (
        <p className="loading">Cargando…</p>
      ) : summary.debtors.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>🧾</span>
          <h2>{text.empty}</h2>
          <p className="muted">{text.hint}</p>
          <Link to={text.to} className="btn primary">{text.cta}</Link>
        </section>
      ) : (
        <>
          <section className="card balance" aria-label="Total">
            <div className="balance-total" style={{ margin: 0, padding: 0, border: 0 }}>
              <span>{text.total}</span>
              <strong className={kind === 'receivable' ? 'pos' : 'neg'}>{money(summary.totalCents)}</strong>
            </div>
            {summary.overdueCents > 0 && <p className="warn" style={{ marginTop: '.5rem' }}>⚠️ {money(summary.overdueCents)} ya venció</p>}
          </section>
          <section className="card list">
            {summary.debtors.map((d) => (
              <Link key={d.contact.id} to={`/deudas/${d.contact.id}`} className="product-row">
                <div className="avatar-sm" aria-hidden>{d.contact.name.slice(0, 1).toUpperCase()}</div>
                <div className="grow">
                  <strong>{d.contact.name}</strong>
                  <small className="muted">
                    {d.overdueCents > 0 ? <span className="badge out">Vencida</span> : d.nextDue ? `Vence ${formatDay(d.nextDue)}` : `${d.openCount} ${d.openCount === 1 ? 'cuenta' : 'cuentas'}`}
                  </small>
                </div>
                <strong className={kind === 'receivable' ? 'pos' : 'neg'}>{money(d.balanceCents)}</strong>
              </Link>
            ))}
          </section>
        </>
      )}
    </>
  )
}
