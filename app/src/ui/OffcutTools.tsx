import { useMemo, useState } from 'react'
import { formatMoney } from '../data/money'
import { Recycle } from 'lucide-react'
import { listOffcuts, offcutColors, planWithOffcuts, saveOffcuts, applyOffcutPlan, type NeedPiece, type OffcutDraft, type OffcutPlan } from '../data/offcuts'
import type { Business } from '../data/types'

const cm = (mm: number) => Math.round(mm) / 10

/**
 * Retacera desde un despiece: «¿Sale con retacera?» revisa si las piezas caben en los retazos guardados (mismo tipo,
 * grosor y color) y «Guardar sobrantes» manda a la retacera lo que dejará cada hoja de este mueble.
 */
export default function OffcutTools({ business, board, fondo, esp, fixed, title, rests, sheetPrice, sheetArea = 2440 * 1220 }: {
  business: Business
  /** Piezas de tablero y de fondo en mm. */
  board: NeedPiece[]
  fondo: NeedPiece[]
  esp: number
  /** Con veta: las piezas no se giran. */
  fixed: boolean
  title: string
  /** Sobrantes aprovechables de cada hoja de este mueble (para guardarlos). */
  rests: Omit<OffcutDraft, 'color'>[]
  /** Precio de la hoja (pesos) y su área (mm²), para decir cuánto material se ahorra con la retacera. */
  sheetPrice?: number
  sheetArea?: number
}) {
  const stock = listOffcuts(business)
  const colors = offcutColors(stock, 'tablero', esp)
  const [open, setOpen] = useState<'check' | 'save'>()
  const [color, setColor] = useState(colors[0] ?? '')
  const [colorFondo, setColorFondo] = useState('Blanco')
  const [plan, setPlan] = useState<{ board: OffcutPlan; fondo?: OffcutPlan }>()
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  // Sugerencia automática: cuántas piezas de este mueble saldrían de la retacera (de cualquier color) y cuánto se ahorra.
  const hint = useMemo(() => {
    if (!stock.some((o) => o.kind === 'tablero' && o.esp === esp) || !board.length) return undefined
    const p = planWithOffcuts(board, stock, { kind: 'tablero', esp }, { fixed })
    const pieces = p.used.flatMap((u) => u.pieces)
    if (!pieces.length) return undefined
    const area = pieces.reduce((s, x) => s + x.l * x.a, 0)
    return { count: pieces.length, all: p.fits, savedCents: sheetPrice ? Math.round((area / sheetArea) * sheetPrice * 100) : 0 }
  }, [stock, board, esp, fixed, sheetPrice, sheetArea])

  function check() {
    setMsg('')
    setPlan({
      board: planWithOffcuts(board, stock, { kind: 'tablero', esp, color: color || undefined }, { fixed }),
      ...(fondo.length > 0 && { fondo: planWithOffcuts(fondo, stock, { kind: 'fondo', esp: 3 }) }),
    })
  }

  async function use() {
    if (!plan) return
    setBusy(true)
    await applyOffcutPlan(business.id, plan.board, title)
    if (plan.fondo?.used.length) await applyOffcutPlan(business.id, plan.fondo, title)
    setBusy(false)
    setPlan(undefined)
    setMsg('Listo: se quitaron de la retacera los retazos usados y se guardó lo que les sobra.')
  }

  async function save() {
    setBusy(true)
    const saved = await saveOffcuts(business.id, rests.map((r) => ({ ...r, color: (r.kind === 'fondo' ? colorFondo : color).trim() || 'Sin color', from: title })))
    setBusy(false)
    setOpen(undefined)
    setMsg(`✓ ${saved.length} ${saved.length === 1 ? 'sobrante guardado' : 'sobrantes guardados'} en la retacera (Material del taller).`)
  }

  const result = plan && (
    <div className="offcut-result">
      {[['Tablero', plan.board] as const, ...(plan.fondo ? [['Fondo', plan.fondo] as const] : [])].map(([label, p]) => (
        <div key={label}>
          {p.candidates === 0 ? (
            <p className="note-box bad">{label}: no tienes retazos de {label === 'Fondo' ? 'fondo de 3 mm' : `${esp} mm${color ? ` color ${color}` : ''}`} en la retacera.</p>
          ) : p.fits ? (
            <p className="note-box">✓ <strong>{label}: sí sale con retacera.</strong> Usa {p.used.length} {p.used.length === 1 ? 'retazo' : 'retazos'}.</p>
          ) : (
            <p className="note-box bad"><strong>{label}: no sale todo.</strong> Salen {p.used.reduce((a, u) => a + u.pieces.length, 0)} piezas de retazos; faltan {p.missing.length}: {p.missing.slice(0, 6).map((m) => `${m.n} ${cm(m.l)}×${cm(m.a)}`).join(', ')}{p.missing.length > 6 ? '…' : ''}.</p>
          )}
          {p.used.length > 0 && (
            <ul className="plain-list">
              {p.used.map((u) => (
                <li key={u.offcut.id}><strong>Retazo {cm(u.offcut.l)} × {cm(u.offcut.a)} cm</strong>{u.offcut.from ? <small className="muted"> (de {u.offcut.from})</small> : ''}: {u.pieces.map((x) => `${x.n} ${cm(x.l)}×${cm(x.a)}`).join(', ')}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {(plan.board.used.length > 0 || (plan.fondo?.used.length ?? 0) > 0) && (
        <button type="button" className="btn primary" disabled={busy} onClick={() => void use()}>
          {plan.board.fits && (!plan.fondo || plan.fondo.fits) ? 'Hacerlo con retacera (quitar los retazos usados)' : 'Usar estos retazos (el resto, de hoja nueva)'}
        </button>
      )}
    </div>
  )

  return (
    <section className="card form offcut-tools">
      <h2><Recycle className="i-inline" aria-hidden /> Retacera</h2>
      {hint && <p className="note-box">💡 {hint.all ? 'Todo el tablero de este mueble' : `${hint.count} ${hint.count === 1 ? 'pieza' : 'piezas'} de este mueble`} {hint.all ? 'sale' : 'salen'} de tu retacera de {esp} mm{hint.savedCents ? ` (≈ ${formatMoney(hint.savedCents, business.currency)} de material)` : ''}. Revisa el color con «¿Sale con retacera?».</p>}
      <div className="quick">
        <button type="button" className={`btn ${open === 'check' ? 'primary' : 'ghost'}`} onClick={() => { setOpen(open === 'check' ? undefined : 'check'); setPlan(undefined) }}>¿Sale con retacera?</button>
        <button type="button" className={`btn ${open === 'save' ? 'primary' : 'ghost'}`} disabled={!rests.length} onClick={() => setOpen(open === 'save' ? undefined : 'save')}>Guardar sobrantes</button>
      </div>
      {open === 'check' && (
        <>
          <p className="muted">Revisa si las piezas de este mueble salen de los retazos guardados de {esp} mm.</p>
          <label>Color
            <select value={color} onChange={(e) => { setColor(e.target.value); setPlan(undefined) }}>
              <option value="">Cualquier color</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" className="btn ghost" onClick={check}>Revisar</button>
          {result}
        </>
      )}
      {open === 'save' && (
        <>
          <p className="muted">Cuando cortes este mueble te sobrarán {rests.length} {rests.length === 1 ? 'pedazo aprovechable' : 'pedazos aprovechables'}:</p>
          <ul className="plain-list">{rests.map((r, i) => <li key={i}>Hoja {r.sheet} · {r.kind === 'fondo' ? 'Fondo 3 mm' : `Tablero ${r.esp} mm`}: <strong>{cm(r.l)} × {cm(r.a)} cm</strong></li>)}</ul>
          <div className="two">
            <label>Color del tablero<input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej. Blanco, Nogal Tzalam" /></label>
            {rests.some((r) => r.kind === 'fondo') && <label>Color del fondo<input value={colorFondo} onChange={(e) => setColorFondo(e.target.value)} /></label>}
          </div>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>Guardar en la retacera</button>
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
