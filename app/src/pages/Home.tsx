import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { backupStatus } from '../data/backup'
import { balanceForRange, changeVsYesterday } from '../data/balance'
import { addDays, dayKey, periodRange } from '../data/dates'
import { debtSummary } from '../data/debts'
import { fixedMonth } from '../data/fixed'
import { jobSummary } from '../data/jobs'
import { isLow, listMaterials } from '../data/materials'
import { formatMoney } from '../data/money'
import { listProducts } from '../data/products'
import { listOrders } from '../data/orders'
import { listQuotes, needsAttention } from '../data/quotes'
import type { Business } from '../data/types'
import type { Permission } from '../data/team'
import { useActor, useCan } from '../ui/actor'
import { InstallBanner } from '../ui/install'
import { type LucideIcon, ArrowDown, ArrowUp, CalendarClock, ChartLine, Hammer, ChevronRight, FileText, HardDriveDownload, Inbox, Minus, Package, Plus, ShoppingBag, ShoppingCart, Sparkles, TriangleAlert, Truck, Users, Zap } from 'lucide-react'

const MODULES: { label: string; to: string; icon: LucideIcon; need?: Permission }[] = [
  { label: 'Inventario', to: '/inventario', icon: Package },
  { label: 'Estadísticas', to: '/estadisticas', icon: ChartLine, need: 'balance' },
  { label: 'Cotizaciones', to: '/cotizaciones', icon: FileText },
  { label: 'Cotizador', to: '/cotizador', icon: Zap },
  { label: 'Obras', to: '/obras', icon: Hammer },
  { label: 'Pagos del taller', to: '/pagos', icon: CalendarClock, need: 'expenses' },
  { label: 'Clientes', to: '/clientes', icon: Users },
  { label: 'Proveedores', to: '/proveedores', icon: Truck, need: 'expenses' },
  { label: 'Compras', to: '/compras', icon: ShoppingCart, need: 'expenses' },
  { label: 'Pedidos', to: '/pedidos', icon: Inbox },
  ...(import.meta.env.VITE_SYNC !== 'off' ? [{ label: 'Asistente', to: '/asistente', icon: Sparkles, need: 'balance' as Permission }] : []),
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
  const jobs = useLiveQuery(() => jobSummary(business, today), [business, today])
  const fixed = useLiveQuery(async () => {
    const m = await fixedMonth(business, today, today)
    return { late: m.rows.filter((r) => r.state === 'vencido').length, pending: m.rows.filter((r) => r.state === 'pendiente').length, remainingCents: m.remainingCents }
  }, [business, today])
  const backup = useLiveQuery(() => backupStatus(), [])
  const restock = useLiveQuery(() => listProducts(business.id, { onlyRestock: true }), [business.id]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)
  return (
    <>
      {!can('balance') && (
        <section className="card today" aria-label="Registrar">
          <h2>{actor.id ? `Hola, ${actor.name}` : 'Hoy'}</h2>
          <Link to="/venta/nueva" className="btn dark"><Plus aria-hidden strokeWidth={2.25} /> Registrar venta</Link>
          {can('expenses') && <Link to="/gasto/nuevo" className="btn ghost"><Minus aria-hidden strokeWidth={2.25} /> Registrar gasto</Link>}
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
                {change.kind === 'new' ? 'Nuevo' : <>{change.pct < 0 ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />}{Math.abs(change.pct).toFixed(1)}%</>}
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
        <Link to="/venta/nueva" className="btn dark"><Plus aria-hidden strokeWidth={2.25} /> Registrar venta</Link>
        <Link to="/gasto/nuevo" className="btn ghost"><Minus aria-hidden strokeWidth={2.25} /> Registrar gasto</Link>
        <small className="muted">Cuenta lo que ya cobraste y pagaste; lo fiado cuenta cuando se cobra.</small>
      </section>
      )}
      <InstallBanner />
      {isOwner && backup?.due && (
        <Link to="/mas" className="alert">
          <HardDriveDownload className="i-inline" aria-hidden /> {backup.ageDays === null ? 'Aún no has hecho una copia de seguridad' : `Hace ${backup.ageDays} días que no haces una copia de seguridad`}
          <span>Hacer copia</span>
        </Link>
      )}
      {jobs && jobs.late > 0 && (
        <Link to="/obras" className="alert">
          <Hammer className="i-inline" aria-hidden /> {jobs.late === 1 ? '1 obra atrasada' : `${jobs.late} obras atrasadas`}
          <span>Ver</span>
        </Link>
      )}
      {can('inventory') && listMaterials(business).some(isLow) && (
        <Link to="/material" className="alert">
          <TriangleAlert className="i-inline" aria-hidden /> {listMaterials(business).filter(isLow).length === 1 ? `Falta material: ${listMaterials(business).filter(isLow)[0].name}` : `${listMaterials(business).filter(isLow).length} materiales del taller por comprar`}
          <span>Ver</span>
        </Link>
      )}
      {jobs && jobs.unpaid > 0 && (
        <Link to="/obras" className="alert">
          <Hammer className="i-inline" aria-hidden /> {jobs.unpaid === 1 ? '1 obra instalada sin liquidar' : `${jobs.unpaid} obras instaladas sin liquidar`}
          <span>Cobrar</span>
        </Link>
      )}
      {jobs && jobs.thisWeek > 0 && (
        <Link to="/obras" className="alert">
          <Hammer className="i-inline" aria-hidden /> {jobs.thisWeek === 1 ? '1 entrega esta semana' : `${jobs.thisWeek} entregas esta semana`}
          <span>Ver</span>
        </Link>
      )}
      {can('expenses') && fixed && fixed.late + fixed.pending > 0 && (
        <Link to="/pagos" className="alert">
          <CalendarClock className="i-inline" aria-hidden /> {fixed.late > 0 ? (fixed.late === 1 ? '1 pago del taller vencido' : `${fixed.late} pagos del taller vencidos`) : fixed.pending === 1 ? '1 pago del taller pendiente este mes' : `${fixed.pending} pagos del taller pendientes este mes`}{can('balance') ? ` · faltan ${money(fixed.remainingCents)}` : ''}
          <span>Ver</span>
        </Link>
      )}
      {openOrders > 0 && (
        <Link to="/pedidos" className="alert">
          <Inbox className="i-inline" aria-hidden /> {openOrders === 1 ? '1 pedido pendiente' : `${openOrders} pedidos pendientes`}
          <span>Ver</span>
        </Link>
      )}
      {dueQuotes > 0 && (
        <Link to="/cotizaciones" className="alert">
          <FileText className="i-inline" aria-hidden /> {dueQuotes === 1 ? '1 cotización por vencer o vencida' : `${dueQuotes} cotizaciones por vencer o vencidas`}
          <span>Ver</span>
        </Link>
      )}
      {restock.length > 0 && (
        <Link to="/inventario?reabastecer=1" className="alert">
          <TriangleAlert className="i-inline" aria-hidden /> {restock.length === 1 ? `Reabastece ${restock[0].name}` : `${restock.length} productos necesitan reabastecerse`}
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
        <ShoppingBag className="banner-icon" aria-hidden strokeWidth={1.75} />
        <span className="grow">
          <strong>Catálogo</strong>
          <small>Comparte tus productos y recibe pedidos</small>
        </span>
        <ChevronRight aria-hidden className="chev" />
      </Link>}
      <div className="tiles">
        {MODULES.filter((m) => !m.need || can(m.need)).map((m) => (
          <Link key={m.label} to={m.to} className="tile">
            <m.icon aria-hidden strokeWidth={1.75} />
            {m.label}
          </Link>
        ))}
      </div>
    </>
  )
}
