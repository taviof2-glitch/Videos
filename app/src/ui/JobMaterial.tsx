import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Pencil, Plus, TriangleAlert, X } from 'lucide-react'
import { updateJob, type JobItem } from '../data/jobs'
import { autoItems, itemMaterialId, jobItems } from '../data/materialNeeds'
import { listMaterials, UNITS } from '../data/materials'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

type Row = { name: string; qty: string; unit: string; materialId: string }

/**
 * El material que lleva la obra, con lo que hay en el taller y lo que falta. Se puede editar: cambiar cantidades,
 * elegir el material exacto del taller (color, grosor…), quitar y agregar renglones. La lista editada manda sobre el cálculo.
 */
export default function JobMaterial({ business, item, customer }: { business: Business; item: JobItem; customer: string }) {
  const materials = listMaterials(business)
  const items = jobItems(item, business)
  const edited = !!item.job.materialList
  const [rows, setRows] = useState<Row[]>()
  const [msg, setMsg] = useState('')
  const anyEst = items.some((i) => i.est)
  const text = [`*Material: ${item.title}${customer ? ` (${customer})` : ''}*`, ...items.map((i) => {
    const m = materials.find((x) => x.id === itemMaterialId(i, materials))
    return `${i.qty} ${m?.unit ?? i.unit} — ${m?.name ?? i.name}`
  })].join('\n')

  function startEdit() {
    setMsg('')
    setRows(items.map((it) => {
      const id = itemMaterialId(it, materials)
      const m = materials.find((x) => x.id === id)
      return { name: m?.name ?? it.name, qty: String(it.qty), unit: m?.unit ?? it.unit, materialId: id }
    }))
  }
  const set = (i: number, patch: Partial<Row>) => setRows(rows!.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  function pick(i: number, value: string) {
    if (value === '__libre') return set(i, { materialId: '' })
    const m = materials.find((x) => x.id === value)
    if (m) set(i, { materialId: m.id, name: m.name, unit: m.unit })
  }
  async function save() {
    const list = rows!.map((r) => ({ name: r.name.trim(), qty: parseFloat(r.qty.replace(',', '.')) || 0, unit: r.unit, ...(r.materialId && { materialId: r.materialId }) })).filter((r) => r.name && r.qty > 0)
    await updateJob(item.id, { materialList: list, extraMaterial: undefined })
    setRows(undefined)
    setMsg('Material de la obra guardado.')
  }
  async function reset() {
    await updateJob(item.id, { materialList: undefined })
    setRows(undefined)
    setMsg('Se volvió al cálculo automático.')
  }

  if (rows) {
    return (
      <div className="job-material form">
        {rows.length === 0 && <p className="muted">Sin renglones. Agrega el material de la obra.</p>}
        {rows.map((r, i) => (
          <div key={i} className="mat-row">
            <select aria-label="Material del taller" value={r.materialId || '__libre'} onChange={(e) => pick(i, e.target.value)}>
              <option value="__libre">{r.materialId ? 'Escribir otro…' : `${r.name || 'Escribe abajo'} (no está en el taller)`}</option>
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name} · hay {m.stock} {m.unit}</option>)}
            </select>
            {!r.materialId && <input aria-label="Nombre del material" value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Nombre del material" />}
            <div className="fav-row">
              <input aria-label="Cantidad" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" style={{ width: 70 }} />
              <select aria-label="Unidad" value={r.unit} onChange={(e) => set(i, { unit: e.target.value })} disabled={!!r.materialId}>{[...new Set([...UNITS, r.unit])].map((u) => <option key={u}>{u}</option>)}</select>
              <button type="button" className="btn ghost small" aria-label="Quitar renglón" onClick={() => setRows(rows.filter((_, k) => k !== i))}><X size={16} aria-hidden /></button>
            </div>
          </div>
        ))}
        <button type="button" className="btn ghost small" onClick={() => setRows([...rows, { name: '', qty: '1', unit: 'piezas', materialId: '' }])}><Plus size={16} aria-hidden /> Agregar renglón</button>
        <div className="quick">
          <button type="button" className="btn ghost" onClick={() => setRows(undefined)}>Cancelar</button>
          <button type="button" className="btn primary" onClick={() => void save()}>Guardar material</button>
        </div>
        <small className="muted">Elige el material exacto de tu taller (color, grosor) para que se descuente bien al cortar y cuente en «Material necesario».</small>
      </div>
    )
  }

  return (
    <div className="job-material">
      {items.length === 0 ? (
        <p className="muted">Esta obra no tiene material calculado (se cotizó sin medidas o a mano). Toca «Editar material» para agregarlo.</p>
      ) : (
        <ul className="moves">
          {items.map((it, i) => {
            const m = materials.find((x) => x.id === itemMaterialId(it, materials))
            const ok = !!m && m.stock >= it.qty
            return (
              <li key={i}>
                <span>{it.qty} {m?.unit ?? it.unit} · {m?.name ?? it.name}{it.est && <small className="muted"> (aprox.)</small>}<br />
                  <small className={ok ? 'muted' : 'neg'}>{m ? `hay ${m.stock} ${m.unit}${ok ? '' : `, faltan ${Math.round((it.qty - m.stock) * 10) / 10}`}` : 'no está en Material del taller'}</small>
                </span>
                {ok ? <CheckCircle2 className="i-inline pos" aria-label="Hay" /> : <TriangleAlert className="i-inline neg" aria-label="Falta" />}
              </li>
            )
          })}
        </ul>
      )}
      {anyEst && <small className="muted">«Aprox.»: se cotizó por metro, sin medidas. Toca «Editar material» para poner lo exacto.</small>}
      {edited && <small className="muted">Lista editada a mano. {autoItems(item, business).length > 0 && <button type="button" className="link" onClick={() => void reset()}>Volver al cálculo automático</button>}</small>}
      <div className="quick">
        <button type="button" className="btn primary small" onClick={startEdit}><Pencil size={16} aria-hidden /> Editar material</button>
        {items.length > 0 && <a className="btn sale small" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar lista</a>}
        <Link to="/material-necesario" className="btn ghost small">Ver todo lo que falta</Link>
      </div>
      {msg && <p className="success" role="status">{msg}</p>}
    </div>
  )
}
