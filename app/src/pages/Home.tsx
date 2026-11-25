import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { backupStatus } from '../data/backup'
import { balanceForRange } from '../data/balance'
import { dayKey, formatDay, periodRange } from '../data/dates'
import { debtSummary } from '../data/debts'
import { formatMoney } from '../data/money'
import { listProducts } from '../data/products'
import { listOrders } from '../data/orders'
import { listQuotes, needsAttention } from '../data/quotes'
import type { Business } from '../data/types'

const MODULES = [
  { label: 'Inventario', to: '/inventario', icon: '📦' },
  { label: 'Estadísticas', to: '/estadisticas', icon: '📈' },
  { label: 'Cotizaciones', to: '/cotizaciones', icon: '📝' },
  { label: 'Clientes', to: '/clientes', icon: '👥' },
  { label: 'Proveedores', to: '/proveedores', icon: '🚚' },
  { label: 'Compras', to: '/compras', icon: '🛒' },
  { label: 'Catálogo', to: '/catalogo', icon: '🛍️' },
  { label: 'Pedidos', to: '/pedidos', icon: '📥' },
]

export default function Home({ business }: { business: Business }) {
  const [today, setToday] = useState(() => dayKey(Date.now(), business.timezone))
  // Si la app se queda abierta pasada la medianoche, «hoy» cambia solo.
  useEffect(() => {
    const tick = () => setToday(dayKey(Date.now(), business.timezone))
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [business.timezone])
  const day = useLiveQuery(() => balanceForRange(business.id, periodRange('day', today, business.timezone)), [business.id, today, business.timezone])
  const receivable = useLiveQuery(() => debtSummary(business.id, 'receivable', today), [business.id, today])
  const payable = useLiveQuery(() => debtSummary(business.id, 'payable', today), [business.id, today])
  const dueQuotes = useLiveQuery(async () => (await listQuotes(business.id)).filter((q) => needsAttention(q, today)).length, [business.id, today]) ?? 0
  const openOrders = useLiveQuery(async () => (await listOrders(business.id)).filter((o) => o.status === 'pending').length, [business.id]) ?? 0
  const backup = useLiveQuery(() => backupStatus(), [])
  const restock = useLiveQuery(() => listProducts(business.id, { onlyRestock: true }), [business.id]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)
  return (
    <>
      <Link to="/balance" className="card today" aria-label="Balance de hoy: ver el detalle">
        <div className="row-between">
          <h2>Hoy</h2>
          <small className="muted">{formatDay(today)}</small>
        </div>
        <div className="today-grid">
          <div>
            <small>Vendido</small>
            <strong className="pos">{day ? money(day.incomeCents) : '…'}</strong>
            {day && <small className="muted">{day.salesCount === 1 ? '1 venta' : `${day.salesCount} ventas`}</small>}
          </div>
          <div>
            <small>Gastado</small>
            <strong className="neg">{day ? money(day.expenseCents) : '…'}</strong>
            {day && <small className="muted">{day.expenseCount === 1 ? '1 gasto' : `${day.expenseCount} gastos`}</small>}
          </div>
          <div>
            <small>Ganancia</small>
            <strong className={day && day.profitCents < 0 ? 'neg' : 'pos'}>{day ? money(day.profitCents) : '…'}</strong>
          </div>
        </div>
        <small className="muted">Cuenta lo que ya cobraste y pagaste; lo fiado cuenta cuando se cobra.</small>
      </Link>
      {backup?.due && (
        <Link to="/mas" className="alert">
          💾 {backup.ageDays === null ? 'Aún no has hecho una copia de seguridad' : `Hace ${backup.ageDays} días que no haces una copia de seguridad`}
          <span>Hacer copia</span>
        </Link>
      )}
      {openOrders > 0 && (
        <Link to="/pedidos" className="alert">
          📥 {openOrders === 1 ? '1 pedido pendiente' : `${openOrders} pedidos pendientes`}
          <span>Ver</span>
        </Link>
      )}
      {dueQuotes > 0 && (
        <Link to="/cotizaciones" className="alert">
          📝 {dueQuotes === 1 ? '1 cotización por vencer o vencida' : `${dueQuotes} cotizaciones por vencer o vencidas`}
          <span>Ver</span>
        </Link>
      )}
      {restock.length > 0 && (
        <Link to="/inventario?reabastecer=1" className="alert">
          ⚠️ {restock.length === 1 ? `Reabastece ${restock[0].name}` : `${restock.length} productos necesitan reabastecerse`}
          <span>Ver</span>
        </Link>
      )}
      {((receivable?.totalCents ?? 0) > 0 || (payable?.totalCents ?? 0) > 0) && (
        <section className="stats">
          <Link to="/deudas" className="card stat plain">
            <small>Te deben</small>
            <strong className="pos">{formatMoney(receivable?.totalCents ?? 0, business.currency)}</strong>
          </Link>
          <Link to="/deudas?t=pagar" className="card stat plain">
            <small>Debes</small>
            <strong className="neg">{formatMoney(payable?.totalCents ?? 0, business.currency)}</strong>
          </Link>
        </section>
      )}
      <section className="card">
        <h2>Accesos rápidos</h2>
        <div className="quick">
          <Link to="/venta/nueva" className="btn sale">+ Nueva venta</Link>
          <Link to="/gasto/nuevo" className="btn expense">− Nuevo gasto</Link>
        </div>
      </section>
      <section className="card">
        <h2>Tu negocio, {business.name}</h2>
        <div className="grid">
          {MODULES.map((m) => (
            <Link key={m.label} to={m.to} className="module">
              <span aria-hidden>{m.icon}</span>
              {m.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
