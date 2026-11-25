import { Link, NavLink, Outlet } from 'react-router-dom'
import { lock } from '../data/team'
import { PHASE_TEXT, useSyncStatus } from '../sync/runner'
import { useActor, useCan } from './actor'

const TABS = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/balance', label: 'Balance', icon: '📊' },
  { to: '/deudas', label: 'Deudas', icon: '🧾' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/mas', label: 'Más', icon: '☰' },
]

export default function Layout({ businessName, businessId }: { businessName: string; businessId: string }) {
  const sync = useSyncStatus()
  const actor = useActor()
  const can = useCan()
  const tabs = TABS.filter((t) => t.to !== '/balance' || can('balance'))
  const text = sync.link ? PHASE_TEXT[sync.phase] : undefined
  return (
    <div className="shell">
      <header className="topbar">
        <div className="avatar" aria-hidden>
          {businessName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <Link to="/negocios" className="biz-switch" aria-label={`${businessName}: cambiar de negocio`}>
            <strong>{businessName}</strong> <span aria-hidden>▾</span>
          </Link>
          <small>{actor.id ? `${actor.name} · ${actor.role === 'owner' ? 'Propietario' : 'Empleado'}` : 'Propietario'}</small>
        </div>
        {text && (
          <Link to="/cuenta" className={`sync-pill ${sync.phase}`} title="Cuenta y nube">
            <span aria-hidden className="dot" />
            {text}
            {sync.pending > 0 && sync.phase !== 'syncing' && sync.phase !== 'idle' ? ` · ${sync.pending}` : ''}
          </Link>
        )}
        {actor.id && (
          <button type="button" className="who" onClick={() => void lock(businessId)} aria-label="Cambiar de usuario">
            🔒 Cambiar
          </button>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegación principal">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
