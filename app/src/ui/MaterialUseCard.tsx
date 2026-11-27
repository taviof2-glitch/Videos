import { useState } from 'react'
import type { JobItem } from '../data/jobs'
import { listMaterials } from '../data/materials'
import { applyMaterialUse, planMaterialUse, undoMaterialUse, materialUseCost, type OffcutDraft, type UseLine } from '../data/materialUse'
import { formatMoney } from '../data/money'
import type { Business } from '../data/types'

/** Material de la obra: con su despiece se descuenta del taller y los sobrantes quedan como retazos. */
export default function MaterialUseCard({ business, item }: { business: Business; item: JobItem }) {
  const use = item.job.materialUse
  const plan = item.quote ? planMaterialUse(business, item.quote) : undefined
  const materials = listMaterials(business)
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<(UseLine & { qtyText: string })[]>([])
  const [offcuts, setOffcuts] = useState<(OffcutDraft & { keep: boolean })[]>([])
  const [busy, setBusy] = useState(false)
  const [color, setColor] = useState('Blanco')
  const [colorFondo, setColorFondo] = useState('Blanco')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const money = (c: number) => formatMoney(c, business.currency)

  if (use) {
    return (
      <section className="note-box">
        <strong>Material descontado del taller</strong>
        <ul className="plain-list">{use.lines.map((l, i) => <li key={i}>{l.qty} {l.unit} · {l.name}</li>)}</ul>
        {materialUseCost(use) > 0 && <p className="muted">Vale aprox. {money(materialUseCost(use))} (al mejor precio de tus proveedores).</p>}
        {use.offcutIds.length > 0 && <p className="muted">Dejó {use.offcutIds.length === 1 ? '1 retazo' : `${use.offcutIds.length} retazos`} en Material del taller.</p>}
        <button type="button" className="link" disabled={busy} onClick={() => { setBusy(true); void undoMaterialUse(business.id, item.id).then(() => setMsg('Listo: el material regresó al taller.'), (e) => setError(e instanceof Error ? e.message : 'No se pudo')).finally(() => setBusy(false)) }}>Deshacer (regresar al taller)</button>
        {msg && <p className="success" role="status">{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    )
  }
  if (!plan) return <p className="muted">Esta obra no tiene despiece guardado: el material se descuenta a mano en «Material del taller».</p>

  if (!open) {
    return (
      <button type="button" className="btn ghost" onClick={() => {
        setLines(plan.lines.map((l) => ({ ...l, qtyText: String(l.qty) })))
        setOffcuts(plan.offcuts.map((o) => ({ ...o, keep: true })))
        setOpen(true)
        setMsg('')
      }}>Descontar material del taller (según el despiece)</button>
    )
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      const chosen = lines.map((l) => ({ ...l, qty: parseFloat(l.qtyText.replace(',', '.')) || 0 })).filter((l) => l.materialId && l.qty > 0)
      await applyMaterialUse(business.id, item.id, chosen, offcuts.filter((o) => o.keep).map(({ keep: _k, ...o }) => ({ ...o, color: (o.kind === 'fondo' ? colorFondo : color).trim() || 'Sin color' })))
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descontar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card form">
      <h3>Material que lleva esta obra</h3>
      <p className="muted">Sale del despiece. Revisa a qué material del taller corresponde cada cosa; lo que no tengas registrado no se descuenta.</p>
      <ul className="ticket-lines">
        {lines.map((l, i) => (
          <li key={l.name}>
            <strong>{l.name}</strong>
            <div className="two">
              <label>Del taller
                <select value={l.materialId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, materialId: e.target.value } : x)))}>
                  <option value="">No descontar</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name} (hay {m.stock} {m.unit})</option>)}
                </select>
              </label>
              <label>Cantidad ({l.unit})<input value={l.qtyText} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qtyText: e.target.value } : x)))} inputMode="decimal" /></label>
            </div>
          </li>
        ))}
      </ul>
      {offcuts.length > 0 && (
        <>
          <h3>Retazos que sobran</h3>
          <p className="muted">Lo que queda de cada hoja según el acomodo del corte (aproximado). Se guardan en la retacera con su color y grosor; desmarca los que no vayas a guardar.</p>
          <div className="two">
            <label>Color del tablero<input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej. Blanco, Nogal Tzalam" /></label>
            {offcuts.some((o) => o.kind === 'fondo') && <label>Color del fondo<input value={colorFondo} onChange={(e) => setColorFondo(e.target.value)} /></label>}
          </div>
          <ul className="plain-list">
            {offcuts.map((o, i) => (
              <li key={i}><label className="check"><input type="checkbox" checked={o.keep} onChange={(e) => setOffcuts(offcuts.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))} /><span>Hoja {o.sheet} · {o.kind === 'fondo' ? 'Fondo' : 'Tablero'} {o.esp} mm: <strong>{o.l / 10} × {o.a / 10} cm</strong></span></label></li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Descontar del taller'}</button>
      </div>
    </section>
  )
}
