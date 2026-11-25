import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { listCategories } from '../data/categories'
import { formatMoney } from '../data/money'
import { listTransactions } from '../data/transactions'
import type { Business } from '../data/types'
import { METHOD_LABEL, formatDateTime, movementTitle } from '../ui/forms'

/**
 * Lista de movimientos. En T4 es simple (más recientes primero); T5 añade
 * la tira de días, los totales y los filtros.
 */
export default function Movements({ business }: { business: Business }) {
  const rows = useLiveQuery(() => listTransactions(business.id), [business.id])
  const categories = useLiveQuery(() => listCategories(business.id, 'expense'), [business.id]) ?? []
  if (!rows) return <p className="loading">Cargando…</p>
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  return (
    <>
      <h1>Movimientos</h1>
      <div className="quick">
        <Link to="/venta/nueva" className="btn sale">+ Nueva venta</Link>
        <Link to="/gasto/nuevo" className="btn expense">− Nuevo gasto</Link>
      </div>
      {rows.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>🧾</span>
          <h2>Todavía no hay movimientos</h2>
          <p className="muted">Registra tu primera venta para empezar a ver cómo va tu negocio.</p>
          <Link to="/venta/nueva" className="btn primary">Registrar mi primera venta</Link>
        </section>
      ) : (
        <section className="card list">
          {rows.map((t) => (
            <Link key={t.id} to={`/${t.type === 'sale' ? 'venta' : 'gasto'}/${t.id}`} className="product-row">
              <div className={`dot ${t.type}`} aria-hidden>{t.type === 'sale' ? '↗' : '↙'}</div>
              <div className="grow">
                <strong>{movementTitle(t, t.categoryId ? categoryName.get(t.categoryId) : undefined)}</strong>
                <small className="muted">{METHOD_LABEL[t.paymentMethod]} · {formatDateTime(t.date)}</small>
              </div>
              <strong className={t.type === 'sale' ? 'pos' : 'neg'}>
                {t.type === 'sale' ? '+' : '−'}{formatMoney(t.amountCents, business.currency)}
              </strong>
            </Link>
          ))}
        </section>
      )}
    </>
  )
}
