import { Link, NavLink, Outlet } from 'react-router-dom'
import { PHASE_TEXT, useSyncStatus } from '../sync/runner'

const TABS = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/balance', label: 'Balance', icon: '📊' },
  { to: '/deudas', label: 'Deudas', icon: '🧾' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/mas', label: 'Más', icon: '☰' },
]

export default function Layout({ businessName }: { businessName: string }) {
  const sync = useSyncStatus()
  const text = sync.link ? PHASE_TEXT[sync.phase] : undefined
  return (
    <div className="shell">
      <header className="topbar">
        <div className="avatar" aria-hidden>
          {businessName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <strong>{businessName}</strong>
          <small>Propietario</small>
        </div>
        {text && (
          <Link to="/cuenta" className={`sync-pill ${sync.phase}`} title="Cuenta y nube">
            <span aria-hidden className="dot" />
            {text}
            {sync.pending > 0 && sync.phase !== 'syncing' && sync.phase !== 'idle' ? ` · ${sync.pending}` : ''}
          </Link>
        )}
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navegación principal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
