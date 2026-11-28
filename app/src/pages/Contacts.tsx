import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { listContacts } from '../data/contacts'
import type { Business, ContactType } from '../data/types'
import { KINDS } from './contactKinds'

/** S13 / S14: agenda de clientes o proveedores. */
export default function Contacts({ business, type }: { business: Business; type: ContactType }) {
  const kind = KINDS[type]
  const [search, setSearch] = useState('')
  const all = useLiveQuery(() => listContacts(business.id, type), [business.id, type])
  const found = useLiveQuery(() => listContacts(business.id, type, search), [business.id, type, search])

  if (!all || !found) return <p className="loading">Cargando…</p>

  return (
    <>
      <section className="row-between">
        <h1>{kind.title}</h1>
        <Link to={`${kind.base}/nuevo`} className="btn primary small">{kind.newLabel}</Link>
      </section>

      {all.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>{kind.icon}</span>
          <h2>Aún no tienes {kind.title.toLowerCase()}</h2>
          <p className="muted">{kind.empty}</p>
          <Link to={`${kind.base}/nuevo`} className="btn primary">Agregar mi primer {kind.one}</Link>
        </section>
      ) : (
        <>
          <input
            type="search"
            placeholder="Buscar por nombre o teléfono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={`Buscar ${kind.one}`}
          />
          <section className="card list">
            {found.length === 0 ? (
              <p className="muted">Ningún {kind.one} coincide con la búsqueda.</p>
            ) : (
              found.map((c) => (
                <Link key={c.id} to={`${kind.base}/${c.id}`} className="product-row">
                  <div className="avatar-sm" aria-hidden>{c.name.slice(0, 1).toUpperCase()}</div>
                  <div className="grow">
                    <strong>{c.name}</strong>
                    <small className="muted">{c.phone || 'Sin teléfono'}</small>
                  </div>
                </Link>
              ))
            )}
          </section>
        </>
      )}
    </>
  )
}
