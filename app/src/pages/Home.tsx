import { Link } from 'react-router-dom'
import type { Business } from '../data/types'

const MODULES = [
  { label: 'Inventario', to: '/inventario', icon: '📦' },
  { label: 'Estadísticas', to: '/balance', icon: '📈' },
  { label: 'Cotizaciones', to: '/mas', icon: '📝' },
  { label: 'Clientes', to: '/mas', icon: '👥' },
  { label: 'Proveedores', to: '/mas', icon: '🚚' },
  { label: 'Catálogo', to: '/mas', icon: '🛍️' },
]

export default function Home({ business }: { business: Business }) {
  return (
    <>
      <section className="card">
        <h2>Accesos rápidos</h2>
        <div className="quick">
          <Link to="/balance" className="btn sale">+ Nueva venta</Link>
          <Link to="/balance" className="btn expense">− Nuevo gasto</Link>
        </div>
        <p className="muted">Las ventas y gastos se activan en la tarea T4.</p>
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
