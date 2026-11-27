import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { updateBusiness, updateBusinessProfile } from '../data/business'
import { invoicingOf, saveInvoicing } from '../data/invoicing'
import type { Business } from '../data/types'
import { prepareLogo } from '../ui/logo'
import { documentLogoSrc } from '../ui/documents'
import { ChevronLeft } from 'lucide-react'

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
            <div className="logo-box"><img src={documentLogoSrc(logo)} alt={logo ? 'Logo del negocio' : 'Logo de Houselite (predeterminado)'} /></div>
            <div className="form">
              <label className="btn ghost small file-btn">
                {logoBusy ? 'Procesando…' : logo ? 'Cambiar logo' : 'Subir logo'}
                <input type="file" accept="image/*" hidden disabled={logoBusy} aria-label="Elegir imagen del logo" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
              </label>
              {logo && <button type="button" className="btn danger-text small" onClick={() => setLogo('')}>Quitar logo</button>}
            </div>
          </div>
          <span className="hint">Va siempre como sello en tus comprobantes y cotizaciones (PDF e imagen). Si no subes uno, se usa el logo de Houselite. Mejor si es PNG con fondo transparente.</span>
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
      <ReviewLinkCard business={business} />
      <InvoicingCard business={business} />
    </>
  )
}

/** Factura electrónica opcional: se activa aquí; la llave de Facturapi va en Vercel, nunca en la app. */
function InvoicingCard({ business }: { business: Business }) {
  const start = invoicingOf(business)
  const [s, setS] = useState(start)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const save = (next: typeof s) => {
    setS(next)
    setMsg('')
    setErr('')
    void saveInvoicing(business.id, next).then(() => setMsg('Guardado.'), (e) => setErr(e instanceof Error ? e.message : 'No se pudo guardar'))
  }
  return (
    <section className="card form">
      <h2>Factura electrónica (opcional)</h2>
      <label className="check"><input type="checkbox" checked={s.enabled} onChange={(e) => save({ ...s, enabled: e.target.checked })} /><span>Poder facturar ventas (CFDI 4.0)</span></label>
      {s.enabled && (
        <>
          <div className="two">
            <label>C.P. fiscal del negocio<input value={s.zip} onChange={(e) => setS({ ...s, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} onBlur={() => save(s)} inputMode="numeric" placeholder="47600" /></label>
            <label>Clave SAT de los conceptos<input value={s.productKey} onChange={(e) => setS({ ...s, productKey: e.target.value.replace(/\D/g, '').slice(0, 8) })} onBlur={() => save(s)} inputMode="numeric" /></label>
          </div>
          <label className="check"><input type="checkbox" checked={s.taxIncluded} onChange={(e) => save({ ...s, taxIncluded: e.target.checked })} /><span>Mis precios ya incluyen IVA</span></label>
          <p className="muted">Para timbrar se usa <strong>Facturapi</strong> (proveedor autorizado por el SAT). Una sola vez: crea tu cuenta en facturapi.io, sube ahí tu certificado de sello digital (CSD) y tus datos fiscales, y guarda tu llave secreta en Vercel como <code>FACTURAPI_KEY</code>. Pregunta a tu contador qué clave SAT usar para tus muebles (01010101 sirve si no hay otra).</p>
          <p className="muted">Después, en el comprobante de cualquier venta aparece «Hacer factura electrónica».</p>
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </section>
  )
}

/** Enlace de reseñas de Google: va en el mensaje de postventa que se manda al entregar. */
function ReviewLinkCard({ business }: { business: Business }) {
  const [url, setUrl] = useState(business.reviewUrl ?? '')
  const [msg, setMsg] = useState('')
  const save = () => {
    const v = url.trim()
    if (v && !/^https:\/\//.test(v)) return setMsg('El enlace debe empezar con https://')
    void updateBusiness(business.id, { reviewUrl: v || undefined }).then(() => setMsg('Guardado.'))
  }
  return (
    <section className="card form">
      <h2>Reseñas de Google</h2>
      <label>Enlace para dejar reseña<input value={url} onChange={(e) => setUrl(e.target.value)} onBlur={save} placeholder="https://g.page/r/..." inputMode="url" /></label>
      <p className="muted">Lo sacas en tu Perfil de Negocio de Google → «Pedir reseñas». Se incluye en el mensaje que mandas a los clientes 2 días después de entregar (Obras → Postventa).</p>
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
