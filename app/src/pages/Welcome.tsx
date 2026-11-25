import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createBusiness } from '../data/business'

const CATEGORIES = ['Tienda de abarrotes', 'Ropa y calzado', 'Comida', 'Carpintería y muebles', 'Servicios', 'Otro']

export default function Welcome() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await createBusiness({ name, category, phone: phone.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el negocio')
    }
  }

  return (
    <main className="welcome">
      <h1>Bienvenido a Houselite</h1>
      <p className="muted">Registra ventas, gastos, deudas e inventario de tu negocio. Funciona sin internet.</p>
      <form onSubmit={submit} className="card form">
        <label>
          Nombre del negocio *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carpintería López" autoFocus />
        </label>
        <label>
          Tipo de negocio
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Teléfono (opcional)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="10 dígitos" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit">Empezar</button>
      </form>
      {import.meta.env.VITE_SYNC !== 'off' && (
        <p className="muted center">
          ¿Ya usas Houselite en otro aparato? <Link to="/cuenta">Entra con tu cuenta</Link> y descarga tus datos.
        </p>
      )}
    </main>
  )
}
