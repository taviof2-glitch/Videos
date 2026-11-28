import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createBusiness, listBusinesses, switchBusiness } from '../data/business'
import type { Business } from '../data/types'
import { useActor } from '../ui/actor'

const BUSINESS_TYPES = ['Tienda de abarrotes', 'Ropa y calzado', 'Comida', 'Carpintería y muebles', 'Servicios', 'Otro']

/** T14: los negocios de este aparato; elegir cuál abrir y agregar otro. */
export default function Businesses({ business }: { business: Business }) {
  const all = useLiveQuery(() => listBusinesses(), [])
  const navigate = useNavigate()
  const isOwner = useActor().role === 'owner'
  const [name, setName] = useState('')
  const [category, setCategory] = useState(BUSINESS_TYPES[0])
  const [error, setError] = useState('')

  async function open(id: string) {
    await switchBusiness(id)
    navigate('/')
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await createBusiness({ name, category })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el negocio')
    }
  }

  return (
    <>
      <section className="row-between">
        <h1>Mis negocios</h1>
        <Link to="/" className="btn ghost small">Inicio</Link>
      </section>
      <p className="muted">Cada negocio tiene sus propios productos, clientes, ventas y equipo. Cambia de uno a otro cuando quieras.</p>
      <section className="card">
        <ul className="biz-list">
          {(all ?? []).map((b) => (
            <li key={b.id}>
              <span className="avatar" aria-hidden>{b.name.slice(0, 1).toUpperCase()}</span>
              <span className="grow">
                <strong>{b.name}</strong>
                <small className="muted">{b.category || 'Negocio'}</small>
              </span>
              {b.id === business.id ? <span className="badge yes">Abierto</span> : <button type="button" className="btn ghost small" onClick={() => void open(b.id)}>Abrir</button>}
            </li>
          ))}
        </ul>
      </section>
      {isOwner && (
        <form onSubmit={add} className="card form">
          <h2>Agregar un negocio</h2>
          <label>
            Nombre del negocio *
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Muebles del Centro" />
          </label>
          <label>
            Tipo de negocio
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {BUSINESS_TYPES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn primary" type="submit" disabled={!name.trim()}>Crear y abrir</button>
          <p className="muted">¿Ya tienes otro negocio en tu cuenta? Entra a <Link to="/cuenta">Cuenta y nube</Link> para descargarlo en este aparato.</p>
        </form>
      )}
    </>
  )
}
