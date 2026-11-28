import { useState } from 'react'
import { Palette } from 'lucide-react'
import { whatsappLink } from '../data/reminder'
import { listSwatches, removeSwatch, saveSwatch, swatchText } from '../data/swatches'
import type { Business } from '../data/types'
import { preparePhoto } from './logo'
import { canShareFiles, shareFiles } from './share'

/** Muestrario de colores: foto de cada melamina, proveedor y grosores. Se manda al cliente para que escoja. */
export default function Swatches({ business }: { business: Business }) {
  const list = listSwatches(business)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [esp, setEsp] = useState('15')
  const [photo, setPhoto] = useState<string>()
  const [pick, setPick] = useState<string[]>([])
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const chosen = list.filter((s) => pick.includes(s.id))

  async function save() {
    setErr('')
    try {
      await saveSwatch(business.id, { name, supplier, esp: esp.split(/[,\s/]+/).map(Number), photo })
      setAdding(false); setName(''); setPhoto(undefined); setMsg('Color guardado.')
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar') }
  }

  async function send() {
    const items = chosen.length ? chosen : list
    const text = swatchText(items, business.name)
    const files = await Promise.all(items.filter((s) => s.photo).map(async (s) => new File([await (await fetch(s.photo!)).blob()], `${s.name.replace(/\s+/g, '-')}.jpg`, { type: 'image/jpeg' })))
    if (files.length && canShareFiles()) {
      await shareFiles(files, 'Colores', text).catch(() => undefined)
      setMsg('Muestrario listo para mandar.')
    } else window.open(whatsappLink(text), '_blank', 'noopener')
  }

  return (
    <section className="card form">
      <h2><Palette className="i-inline" aria-hidden /> Muestrario de colores</h2>
      <p className="muted">Fotos de los colores que manejas. Toca los que quieras mandar (o ninguno para mandar todos). El que escoja el cliente lo anotas en su cotización.</p>
      {list.length > 0 && (
        <div className="swatches">
          {list.map((s) => (
            <figure key={s.id} className={pick.includes(s.id) ? 'on' : ''}>
              <button type="button" aria-pressed={pick.includes(s.id)} onClick={() => setPick(pick.includes(s.id) ? pick.filter((x) => x !== s.id) : [...pick, s.id])}>
                {s.photo ? <img src={s.photo} alt="" /> : <span className="swatch-empty">Sin foto</span>}
              </button>
              <figcaption><strong>{s.name}</strong><small className="muted">{[s.supplier, s.esp.length ? `${s.esp.join('/')} mm` : ''].filter(Boolean).join(' · ')}</small>
                <button type="button" className="link danger-link" onClick={() => void removeSwatch(business.id, s.id)}>Quitar</button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {list.length > 0 && <button type="button" className="btn primary" onClick={() => void send()}>Mandar {chosen.length ? `${chosen.length} ${chosen.length === 1 ? 'color' : 'colores'}` : 'todo el muestrario'} al cliente</button>}
      {adding ? (
        <>
          <label>Color<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Nogal Tzalam" /></label>
          <div className="two">
            <label>Proveedor<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej. Maximaderas" /></label>
            <label>Grosores (mm)<input value={esp} onChange={(e) => setEsp(e.target.value)} placeholder="16, 15" /></label>
          </div>
          <label className="btn ghost file-btn">{photo ? 'Cambiar foto' : 'Tomar o elegir foto'}
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void preparePhoto(f, 90_000).then(setPhoto, (x) => setErr(x instanceof Error ? x.message : 'No se pudo leer la foto')) }} />
          </label>
          {photo && <img src={photo} alt="Vista previa" style={{ maxWidth: 140, borderRadius: 10 }} />}
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="button" className="btn primary" onClick={() => void save()}>Guardar color</button>
          </div>
        </>
      ) : <button type="button" className="btn ghost" onClick={() => setAdding(true)}>Agregar color</button>}
      {msg && <p className="success" role="status">{msg}</p>}
      {err && <p className="error" role="alert">{err}</p>}
    </section>
  )
}
