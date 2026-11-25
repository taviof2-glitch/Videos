import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { listContacts } from '../data/contacts'
import { formatMoney } from '../data/money'
import { listPurchaseRows } from '../data/purchases'
import type { Business } from '../data/types'
import { formatDateTime } from '../ui/forms'

/** Compras a proveedores, las más recientes primero. */
export default function Purchases({ business }: { business: Business }) {
  const rows = useLiveQuery(() => listPurchaseRows(business.id), [business.id])
  const suppliers = useLiveQuery(() => listContacts(business.id, 'supplier'), [business.id])
  const names = new Map((suppliers ?? []).map((s) => [s.id, s.name]))

  return (
    <>
      <section className="row-between">
        <h1>Compras</h1>
        <Link to="/compras/nueva" className="btn primary small">+ Compra</Link>
      </section>
      {!rows ? (
        <p className="loading">Cargando…</p>
      ) : rows.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>🚚</span>
          <h2>Aún no has registrado compras</h2>
          <p className="muted">Cuando te lleguen productos de un proveedor, regístralos aquí: sube el inventario, actualiza el costo y queda el gasto.</p>
          <Link to="/compras/nueva" className="btn primary">Registrar mi primera compra</Link>
        </section>
      ) : (
        <section className="card list">
          {rows.map(({ purchase: p, concept, credit }) => (
            <Link key={p.id} to={`/compras/${p.id}`} className="product-row">
              <div className="dot expense" aria-hidden>↙</div>
              <div className="grow">
                <strong>{concept.replace(/^Compra: /, '')}</strong>
                <small className="muted">{p.supplierId ? (names.get(p.supplierId) ?? 'Proveedor') : 'Sin proveedor'} · {formatDateTime(p.date)}</small>
              </div>
              <span className="stock">
                <strong className={credit ? 'muted' : 'neg'}>−{formatMoney(p.totalCents, business.currency)}</strong>
                {credit && <span className="badge low">A crédito</span>}
              </span>
            </Link>
          ))}
        </section>
      )}
    </>
  )
}
