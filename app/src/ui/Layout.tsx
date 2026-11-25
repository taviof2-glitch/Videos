import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/balance', label: 'Balance', icon: '📊' },
  { to: '/deudas', label: 'Deudas', icon: '🧾' },
  { to: '/inventario', label: 'Inventario', icon: '📦' },
  { to: '/mas', label: 'Más', icon: '☰' },
]

export default function Layout({ businessName }: { businessName: string }) {
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
