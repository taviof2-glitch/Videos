import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Plus, TriangleAlert, X } from 'lucide-react'
import { updateJob, type JobItem } from '../data/jobs'
import { jobItems } from '../data/materialNeeds'
import { listMaterials, UNITS } from '../data/materials'
import { matchMaterial } from '../data/materialUse'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

/** El material que lleva la obra (de su cotización y agregado a mano), con lo que hay en el taller y lo que falta. */
export default function JobMaterial({ business, item, customer }: { business: Business; item: JobItem; customer: string }) {
  const materials = listMaterials(business)
  const items = jobItems(item, business)
  const extra = item.job.extraMaterial ?? []
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('piezas')
  const [msg, setMsg] = useState('')
  const fromQuote = items.length - extra.filter((m) => m.qty > 0 && m.name.trim()).length
  const anyEst = items.some((i) => i.est)
  const text = [`*Material: ${item.title}${customer ? ` (${customer})` : ''}*`, ...items.map((i) => `${i.qty} ${i.unit} — ${i.name}`)].join('\n')

  function add() {
    const q = parseFloat(qty.replace(',', '.'))
    if (!name.trim() || !(q > 0)) return setMsg('Escribe el material y la cantidad.')
    const m = materials.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
    void updateJob(item.id, { extraMaterial: [...extra, { name: m?.name ?? name.trim(), qty: q, unit: m?.unit ?? unit }] }).then(() => { setName(''); setQty('1'); setMsg('Material agregado.') })
  }

  return (
    <div className="job-material">
      {items.length === 0 ? (
        <p className="muted">Esta obra no tiene material calculado (se cotizó sin medidas o a mano). Agrégalo abajo para que cuente en «Material necesario».</p>
      ) : (
        <ul className="moves">
          {items.map((it, i) => {
            const m = materials.find((x) => x.id === matchMaterial(it.name, materials))
            const ok = !!m && m.stock >= it.qty
            const extraIdx = i - fromQuote
            return (
              <li key={i}>
                <span>{it.qty} {it.unit} · {it.name}{it.est && <small className="muted"> (aprox.)</small>}<br />
                  <small className={ok ? 'muted' : 'neg'}>{m ? `hay ${m.stock} ${m.unit}${ok ? '' : `, faltan ${Math.round((it.qty - m.stock) * 10) / 10}`}` : 'no está en Material del taller'}</small>
                </span>
                <span>
                  {ok ? <CheckCircle2 className="i-inline pos" aria-label="Hay" /> : <TriangleAlert className="i-inline neg" aria-label="Falta" />}
                  {extraIdx >= 0 && <button type="button" className="link danger-link" aria-label={`Quitar ${it.name}`} onClick={() => void updateJob(item.id, { extraMaterial: extra.filter((_, k) => k !== extraIdx) })}><X size={16} aria-hidden /></button>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {anyEst && <small className="muted">«Aprox.»: se cotizó por metro, sin medidas; es un estimado con lo que lleva ese trabajo por metro.</small>}
      <div className="fav-row">
        <input aria-label="Material" list="job-mat-list" value={name} onChange={(e) => { setName(e.target.value); const m = materials.find((x) => x.name === e.target.value); if (m) setUnit(m.unit) }} placeholder="Agregar material (ej. Bisagras)" style={{ flex: 2, minWidth: 0 }} />
        <datalist id="job-mat-list">{materials.map((m) => <option key={m.id} value={m.name} />)}</datalist>
        <input aria-label="Cantidad" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" style={{ width: 56 }} />
        <select aria-label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 90 }}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
        <button type="button" className="btn ghost small" aria-label="Agregar" onClick={add}><Plus size={16} aria-hidden /></button>
      </div>
      {items.length > 0 && (
        <div className="quick">
          <a className="btn sale small" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar lista por WhatsApp</a>
          <Link to="/material-necesario" className="btn ghost small">Ver todo lo que falta</Link>
        </div>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
    </div>
  )
}
