import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateBusinessProfile } from '../data/business'
import type { Business } from '../data/types'

const CATEGORIES = ['Tienda de abarrotes', 'Ropa y calzado', 'Comida', 'Carpintería y muebles', 'Servicios', 'Otro']

/** Datos del negocio (`/negocio`): nombre, giro, teléfono de WhatsApp, dirección y horario. */
export default function BusinessProfile({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [name, setName] = useState(business.name)
  const [category, setCategory] = useState(business.category)
  const [phone, setPhone] = useState(business.phone)
  const [address, setAddress] = useState(business.address)
  const [hours, setHours] = useState(business.openingHours)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const options = category && !CATEGORIES.includes(category) ? [category, ...CATEGORIES] : CATEGORIES

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateBusinessProfile(business.id, { name, category, phone, address, openingHours: hours })
      navigate('/mas', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/mas" className="back" aria-label="Volver">←</Link>
        <h1 className="grow">Datos del negocio</h1>
      </section>
      <form onSubmit={submit} className="card form">
        <label>
          Nombre del negocio *
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Tipo de negocio
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sin especificar</option>
            {options.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Teléfono de WhatsApp
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="10 dígitos" />
          <span className="hint">Aparece en comprobantes y cotizaciones, y es donde los clientes del catálogo te mandan su pedido.</span>
        </label>
        <label>
          Dirección (opcional)
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Horario (opcional)
          <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Ej. Lunes a sábado de 9 a 18 h" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>Guardar</button>
      </form>
    </>
  )
}
