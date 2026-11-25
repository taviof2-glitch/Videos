import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateBusinessProfile } from '../data/business'
import type { Business } from '../data/types'
import { prepareLogo } from '../ui/logo'
import { ChevronLeft, Tag } from 'lucide-react'

const CATEGORIES = ['Tienda de abarrotes', 'Ropa y calzado', 'Comida', 'Carpintería y muebles', 'Servicios', 'Otro']

/** Datos del negocio (`/negocio`): nombre, giro, teléfono de WhatsApp, dirección y horario. */
export default function BusinessProfile({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [name, setName] = useState(business.name)
  const [category, setCategory] = useState(business.category)
  const [phone, setPhone] = useState(business.phone)
  const [address, setAddress] = useState(business.address)
  const [hours, setHours] = useState(business.openingHours)
  const [logo, setLogo] = useState(business.logo ?? '')
  const [logoBusy, setLogoBusy] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const options = category && !CATEGORIES.includes(category) ? [category, ...CATEGORIES] : CATEGORIES

  async function pickLogo(file: File | undefined) {
    if (!file) return
    setError('')
    setLogoBusy(true)
    try {
      setLogo(await prepareLogo(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo usar esa imagen')
    }
    setLogoBusy(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await updateBusinessProfile(business.id, { name, category, phone, address, openingHours: hours, logo })
      navigate('/mas', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/mas" className="back" aria-label="Volver"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">Datos del negocio</h1>
      </section>
      <form onSubmit={submit} className="card form">
        <fieldset className="photos">
          <legend>Logo</legend>
          <div className="logo-edit">
            <div className="logo-box">{logo ? <img src={logo} alt="Logo del negocio" /> : <Tag aria-hidden strokeWidth={1.75} />}</div>
            <div className="form">
              <label className="btn ghost small file-btn">
                {logoBusy ? 'Procesando…' : logo ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" hidden disabled={logoBusy} aria-label="Elegir imagen del logo" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {logo && <button type="button" className="btn danger-text small" onClick={() => setLogo('')}>Quitar logo</button>}
            </div>
          </div>
          <span className="hint">Sale arriba de tus comprobantes y cotizaciones (PDF e imagen). Mejor si es PNG con fondo transparente.</span>
        </fieldset>
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
