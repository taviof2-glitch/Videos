import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { backupStatus } from '../data/backup'
import { balanceForRange, changeVsYesterday } from '../data/balance'
import { addDays, dayKey, periodRange } from '../data/dates'
import { debtSummary } from '../data/debts'
import { formatMoney } from '../data/money'
import { listProducts } from '../data/products'
import { listOrders } from '../data/orders'
import { listQuotes, needsAttention } from '../data/quotes'
import type { Business } from '../data/types'
import type { Permission } from '../data/team'
import { useActor, useCan } from '../ui/actor'
import { InstallBanner } from '../ui/install'

const MODULES: { label: string; to: string; icon: string; need?: Permission }[] = [
  { label: 'Inventario', to: '/inventario', icon: '📦' },
  { label: 'Estadísticas', to: '/estadisticas', icon: '📈', need: 'balance' },
  { label: 'Cotizaciones', to: '/cotizaciones', icon: '📝' },
  { label: 'Cotizador', to: '/cotizador', icon: '⚡' },
  { label: 'Clientes', to: '/clientes', icon: '👥' },
  { label: 'Proveedores', to: '/proveedores', icon: '🚚', need: 'expenses' },
  { label: 'Compras', to: '/compras', icon: '🛒', need: 'expenses' },
  { label: 'Pedidos', to: '/pedidos', icon: '📥' },
]

export default function Home({ business }: { business: Business }) {
  const actor = useActor()
  const can = useCan()
  const isOwner = actor.role === 'owner'
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
  const yesterday = useLiveQuery(() => balanceForRange(business.id, periodRange('day', addDays(today, -1), business.timezone)), [business.id, today, business.timezone])
  const change = day && yesterday ? changeVsYesterday(day.incomeCents, yesterday.incomeCents) : undefined
  const receivable = useLiveQuery(() => debtSummary(business.id, 'receivable', today), [business.id, today])
  const payable = useLiveQuery(() => debtSummary(business.id, 'payable', today), [business.id, today])
  const dueQuotes = useLiveQuery(async () => (await listQuotes(business.id)).filter((q) => needsAttention(q, today)).length, [business.id, today]) ?? 0
  const openOrders = useLiveQuery(async () => (await listOrders(business.id)).filter((o) => o.status === 'pending').length, [business.id]) ?? 0
  const backup = useLiveQuery(() => backupStatus(), [])
  const restock = useLiveQuery(() => listProducts(business.id, { onlyRestock: true }), [business.id]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)
  return (
    <>
      {!can('balance') && (
        <section className="card today" aria-label="Registrar">
          <h2>{actor.id ? `Hola, ${actor.name}` : 'Hoy'}</h2>
          <Link to="/venta/nueva" className="btn dark">💵 Registrar venta</Link>
          {can('expenses') && <Link to="/gasto/nuevo" className="btn ghost">− Registrar gasto</Link>}
        </section>
      )}
      {can('balance') && (
      <section className="card today" aria-label="Tu negocio hoy">
        <h2>Tu negocio hoy</h2>
        <div className="today-top">
          <div>
            <strong className="today-sales">{day ? money(day.incomeCents) : '…'}</strong>
            <small className="muted">{day ? `Vendido hoy · ${day.salesCount === 1 ? '1 venta' : `${day.salesCount} ventas`}` : 'Vendido hoy'}</small>
          </div>
          {change && (
            <div className="today-vs">
              <small className="muted">vs ayer</small>
              <span className={`pill ${change.kind === 'pct' && change.pct < 0 ? 'down' : 'up'}`}>
                {change.kind === 'new' ? 'Nuevo' : `${change.pct < 0 ? '↓' : '↑'} ${Math.abs(change.pct).toFixed(1)}%`}
              </span>
            </div>
          )}
        </div>
        <Link to="/balance" className="today-bottom" aria-label="Ver el balance completo">
          <div>
            <strong className={day && day.profitCents < 0 ? 'neg' : 'pos'}>{day ? money(day.profitCents) : '…'}</strong>
            <small className="muted">Balance del día</small>
          </div>
          <div className="right">
            <strong className="neg">{day ? money(day.expenseCents) : '…'}</strong>
            <small className="muted">{day ? `Gastos hoy · ${day.expenseCount === 1 ? '1 gasto' : `${day.expenseCount} gastos`}` : 'Gastos hoy'}</small>
          </div>
        </Link>
        <Link to="/venta/nueva" className="btn dark">💵 Registrar venta</Link>
        <Link to="/gasto/nuevo" className="btn ghost">− Registrar gasto</Link>
        <small className="muted">Cuenta lo que ya cobraste y pagaste; lo fiado cuenta cuando se cobra.</small>
      </section>
      )}
      <InstallBanner />
      {isOwner && backup?.due && (
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
      {can('balance') && ((receivable?.totalCents ?? 0) > 0 || (payable?.totalCents ?? 0) > 0) && (
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
      <h2 className="discover">Descubre todo lo que puedes hacer</h2>
      {isOwner && <Link to="/catalogo" className="banner">
        <span aria-hidden className="banner-icon">🛍️</span>
        <span className="grow">
          <strong>Catálogo</strong>
          <small>Comparte tus productos y recibe pedidos</small>
        </span>
        <span aria-hidden>›</span>
      </Link>}
      <div className="tiles">
        {MODULES.filter((m) => !m.need || can(m.need)).map((m) => (
          <Link key={m.label} to={m.to} className="tile">
            <span aria-hidden>{m.icon}</span>
            {m.label}
          </Link>
        ))}
      </div>
    </>
  )
}
