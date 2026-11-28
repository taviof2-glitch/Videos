import { Link, NavLink, Outlet } from 'react-router-dom'
import { lock } from '../data/team'
import { PHASE_TEXT, useSyncStatus } from '../sync/runner'
import { useActor, useCan } from './actor'
import defaultLogo from '../assets/houselite-logo.webp'
import { ChartNoAxesColumn, ChevronDown, House, Calculator, LayoutGrid, Lock, ReceiptText, Search, Sparkles, type LucideIcon } from 'lucide-react'

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Inicio', icon: House },
  { to: '/balance', label: 'Balance', icon: ChartNoAxesColumn },
  { to: '/deudas', label: 'Deudas', icon: ReceiptText },
  { to: '/cotizador', label: 'Cotizador', icon: Calculator },
  { to: '/mas', label: 'Más', icon: LayoutGrid },
]

export default function Layout({ businessName, businessId, logo }: { businessName: string; businessId: string; logo?: string }) {
  const sync = useSyncStatus()
  const actor = useActor()
  const can = useCan()
  const tabs = TABS.filter((t) => t.to !== '/balance' || can('balance'))
  // El asistente va en medio de la barra, resaltado (si se puede usar en esta app y con estos permisos).
  const assistant = can('balance') && import.meta.env.VITE_SYNC !== 'off'
  const half = Math.ceil(tabs.length / 2)
  const tab = (t: (typeof TABS)[number]) => (
    <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
      <t.icon aria-hidden strokeWidth={1.9} />
      <span>{t.label}</span>
    </NavLink>
  )
  const text = sync.link ? PHASE_TEXT[sync.phase] : undefined
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/negocios" className="brand-mark" aria-label={`${businessName}: cambiar de negocio`}>
          <img src={logo || defaultLogo} alt="" />
        </Link>
        <div className="topbar-id">
          <Link to="/negocios" className="biz-switch" tabIndex={-1} aria-hidden>
            <span>{actor.id ? actor.name : 'Propietario'}</span> <ChevronDown size={16} strokeWidth={2.25} />
          </Link>
          {actor.id && <small>{actor.role === 'owner' ? 'Propietario' : 'Empleado'}</small>}
        </div>
        {text && (
          <Link to="/cuenta" className={`sync-pill ${sync.phase}`} title="Cuenta y nube">
            <span aria-hidden className="dot" />
            {text}
            {sync.pending > 0 && sync.phase !== 'syncing' && sync.phase !== 'idle' ? ` · ${sync.pending}` : ''}
          </Link>
        )}
        <Link to="/buscar" className="search-btn" aria-label="Buscar"><Search aria-hidden size={18} strokeWidth={2.25} /></Link>
        {actor.id && (
          <button type="button" className="who" onClick={() => void lock(businessId)} aria-label="Cambiar de usuario">
            <Lock aria-hidden size={14} strokeWidth={2.25} /> Cambiar
          </button>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegación principal" style={{ gridTemplateColumns: `repeat(${tabs.length + (assistant ? 1 : 0)}, 1fr)` }}>
        {assistant ? tabs.slice(0, half).map(tab) : tabs.map(tab)}
        {assistant && (
          <NavLink to="/asistente" className={({ isActive }) => (isActive ? 'tab tab-ai active' : 'tab tab-ai')} aria-label="Asistente">
            <span className="ai-orb" aria-hidden>
              <svg viewBox="184 184 656 656"><g fill="none" stroke="currentColor" strokeWidth="92" strokeLinecap="round" strokeLinejoin="round"><path d="M344 314v396M680 314v396" /><path d="M344 534l168-90 168 90" /></g></svg>
              <Sparkles className="ai-spark" strokeWidth={2.4} />
            </span>
            <span>Asistente</span>
          </NavLink>
        )}
        {assistant && tabs.slice(half).map(tab)}
      </nav>
    </div>
  )
}
