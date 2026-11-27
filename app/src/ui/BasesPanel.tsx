import { useMemo, useState } from 'react'
import { baseTitle, calcBase, cutCsv, cutText, defaultValues, edgeText, GROUPS, hardwareList, templateOf, TEMPLATES, type BaseResult, type BaseState, type Layout, type BPiece } from '../data/bases'
import { formatMoney } from '../data/money'
import { priceFromCost, type QuoterConfig } from '../data/quoter'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import { downloadBlob } from './share'

const PALETTE = ['#cfe3d6', '#f4dcb4', '#d9d4ef', '#f3cfcf', '#cde4ef', '#e6e1c9', '#d6ead0', '#efd7e7']

/** Bases: elige un mueble, ajusta medidas y sale el despiece, el acomodo en hojas y el precio. */
export default function BasesPanel({ business, cfg, km, state, onChange, onPass, showCosts }: {
  business: Business
  cfg: QuoterConfig
  km: number
  state: BaseState
  onChange: (s: BaseState) => void
  onPass: (s: BaseState, r: BaseResult) => void
  showCosts: boolean
}) {
  const t = templateOf(state.key)
  const [raw, setRaw] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(state.values).map(([k, v]) => [k, String(v)])))
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const r = useMemo(() => calcBase(state, cfg), [state, cfg])
  const price = priceFromCost(cfg, r.material, r.hours, km, state.opts.suave)
  const money = (c: number) => formatMoney(c, business.currency)
  const pesos = (p: number) => money(Math.round(p * 100))
  const text = cutText(state, r, cfg)

  function pick(key: string) {
    const nt = templateOf(key)
    const values = defaultValues(nt)
    setRaw(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])))
    onChange({ key, values, opts: { ...state.opts, fondo: nt.fondo, cubierta: false } })
    setMsg(undefined)
  }
  function preset(i: number) {
    const p = t.presets?.[i]
    if (!p) return
    const values = { ...state.values, ...p.v }
    setRaw(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)])))
    onChange({ ...state, values })
  }
  function setValue(k: string, v: string) {
    setRaw({ ...raw, [k]: v })
    const n = parseFloat(v.replace(',', '.'))
    onChange({ ...state, values: { ...state.values, [k]: Number.isFinite(n) ? n : 0 } })
  }
  const setOpt = <K extends keyof BaseState['opts']>(k: K, v: BaseState['opts'][K]) => onChange({ ...state, opts: { ...state.opts, [k]: v } })

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setMsg({ ok: true, text: 'Despiece copiado.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudo copiar. Usa el botón de WhatsApp.' })
    }
  }
  async function csv() {
    const name = `despiece-${state.key}.csv`
    // El BOM hace que Excel lea bien los acentos.
    const ok = await downloadBlob(new Blob(['﻿' + cutCsv(r, state.opts.veta)], { type: 'text/csv;charset=utf-8' }), name)
    setMsg(ok ? { ok: true, text: `Se descargó ${name}.` } : { ok: false, text: 'No se pudo descargar el archivo.' })
  }

  const listDiff = t.lista ? Math.round(t.lista * 100 * Math.max(1, state.opts.iguales)) - price.costCents : undefined

  return (
    <>
      <section className="card quoter-price" aria-live="polite">
        <small className="muted">Precio sugerido · {baseTitle(state)}</small>
        <strong className="quoter-big">{money(price.priceCents)}</strong>
        <small className="muted">
          {showCosts ? `Material ${pesos(r.material)} · ` : ''}{Math.round(r.hours * 10) / 10} h · {r.board.sheets.length} hoja{r.board.sheets.length === 1 ? '' : 's'} de tablero{r.mdf.sheets.length ? ` + ${r.mdf.sheets.length} de fondo` : ''}
        </small>
      </section>

      <section className="card form">
        <label>
          Mueble
          <select value={state.key} onChange={(e) => pick(e.target.value)}>
            {GROUPS.map((g) => {
              const list = TEMPLATES.filter((x) => x.group === g)
              return list.length ? <optgroup key={g} label={g}>{list.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</optgroup> : null
            })}
          </select>
        </label>
        {t.presets && (
          <label>
            <span>Modelo de referencia <small className="muted">(rellena las medidas; luego puedes cambiarlas)</small></span>
            <select value="" onChange={(e) => preset(Number(e.target.value))}>
              <option value="">Elige un modelo…</option>
              {t.presets.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
            </select>
          </label>
        )}
        <div className="two">
          {t.fields.map((fd) => (
            <label key={fd.k}>
              <span>{fd.label}{!fd.choices && !/^(puertas|repisas|cajones|torres|secciones|niveles|columnas|porColumna|divisiones|tubos|cantidad)/.test(fd.k) && <small className="muted"> (mm)</small>}</span>
              {fd.choices ? (
                <select value={state.values[fd.k] ?? fd.def} onChange={(e) => setValue(fd.k, e.target.value)}>
                  {fd.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : (
                <input value={raw[fd.k] ?? String(fd.def)} onChange={(e) => setValue(fd.k, e.target.value)} inputMode="numeric" />
              )}
            </label>
          ))}
        </div>
        <div className="two">
          <label>
            Espesor del tablero
            <select value={state.opts.esp} onChange={(e) => setOpt('esp', Number(e.target.value))}>
              {[...new Set([15, 16, 18, cfg.esp])].sort((a, b) => a - b).map((x) => <option key={x} value={x}>{x} mm</option>)}
            </select>
          </label>
          <label>
            ¿Cuántos iguales?
            <input value={state.opts.iguales || ''} onChange={(e) => setOpt('iguales', Math.max(1, parseInt(e.target.value) || 1))} inputMode="numeric" />
          </label>
          <label>
            Fondo de 3 mm
            <select value={state.opts.fondo} onChange={(e) => setOpt('fondo', e.target.value as BaseState['opts']['fondo'])}>
              <option value="embutido">Embutido en ranura</option>
              <option value="sobrepuesto">Sobrepuesto por detrás</option>
            </select>
          </label>
          {t.estilo && (
            <label>
              Estructura
              <select value={state.opts.estilo} onChange={(e) => setOpt('estilo', e.target.value as BaseState['opts']['estilo'])}>
                <option value="A">A · laterales completos</option>
                <option value="B">B · techo encima</option>
              </select>
            </label>
          )}
        </div>
        <label className="check"><input type="checkbox" checked={state.opts.veta} onChange={(e) => setOpt('veta', e.target.checked)} /><span>Color con veta (no girar piezas)</span></label>
        <label className="check"><input type="checkbox" checked={state.opts.suave} onChange={(e) => setOpt('suave', e.target.checked)} /><span>Cierre suave</span></label>
        {t.cubierta && <label className="check"><input type="checkbox" checked={state.opts.cubierta} onChange={(e) => setOpt('cubierta', e.target.checked)} /><span>Incluir cubierta ({pesos(cfg.cubML)} por metro)</span></label>}
      </section>

      {t.tips.length > 0 && <p className="note-box">{t.tips.join(' ')}</p>}

      <section className="card">
        <h2>Lo que lleva</h2>
        <ul className="fixed-paid">
          <li>{r.board.sheets.length} hoja{r.board.sheets.length === 1 ? '' : 's'} de {cfg.hojaL}×{cfg.hojaA}{r.board.sheets.length ? ` · aprovechamiento ${Math.round(r.board.sheets.reduce((a, s) => a + s.usedPct, 0) / r.board.sheets.length)} %` : ''}</li>
          {r.mdf.sheets.length > 0 && <li>{r.mdf.sheets.length} hoja{r.mdf.sheets.length === 1 ? '' : 's'} de fondo de 3 mm</li>}
          <li>Canto delgado: {r.edge.d.toFixed(1)} m · canto grueso: {r.edge.g.toFixed(1)} m <small className="muted">(con 10 % de desperdicio)</small></li>
          {hardwareList(r.built.hw, r.tornillos, state.opts.suave).map((h) => <li key={h}>{h}</li>)}
          <li>{Math.round(r.hours * 10) / 10} horas de trabajo (con instalación)</li>
        </ul>
        {r.board.tooBig.length + r.mdf.tooBig.length > 0 && (
          <p className="error" role="alert">No caben en la hoja: {[...r.board.tooBig, ...r.mdf.tooBig].map((i) => `${i + 1}. ${r.built.pieces[i].n} (${r.built.pieces[i].l}×${r.built.pieces[i].a})`).join(', ')}. Pártelas o usa una hoja más grande.</p>
        )}
        {showCosts && (
          <>
            <h3>Material: {pesos(r.material)}</h3>
            <ul className="fixed-paid">{r.parts.map(([n, v]) => <li key={n}>{n}: {pesos(v)}</li>)}</ul>
            {listDiff !== undefined && (
              <p className={`note-box ${listDiff < 0 ? 'bad' : ''}`}>
                A tu precio de {pesos(t.lista! * Math.max(1, state.opts.iguales))} {listDiff >= 0 ? 'te quedan' : 'pierdes'} <strong>{money(Math.abs(listDiff))}</strong> después de material, tu sueldo y el taller.
              </p>
            )}
          </>
        )}
      </section>

      <section className="card">
        <h2>Despiece</h2>
        <div className="scroll">
          <table className="cut-table">
            <thead><tr><th>#</th><th>Pieza</th><th>Largo</th><th>Ancho</th><th>Cant.</th><th>Cantos</th></tr></thead>
            <tbody>
              {r.built.pieces.map((p, i) => (
                <tr key={i}><td>{i + 1}</td><td>{p.n}{p.mdf ? ' · MDF 3 mm' : ''}</td><td>{p.l}</td><td>{p.a}</td><td>{p.q}</td><td>{p.mdf ? '—' : edgeText(p.e)}{p.ranura ? ' · R' : ''}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.built.pieces.some((p) => p.ranura) && <small className="muted">R = ranura para el fondo del cajón (4 mm de ancho, 8 de profundo, a 18 mm del borde).</small>}
        {r.built.notes.map((n) => <p key={n} className="muted">{n}</p>)}
      </section>

      <section className="card">
        <h2>Acomodo en hojas</h2>
        <small className="muted">Meta: más de 90 % de uso por hoja. {state.opts.veta ? 'Con veta: ninguna pieza se gira.' : ''}</small>
        <Sheets layout={r.board} pieces={r.built.pieces} l={cfg.hojaL} a={cfg.hojaA} label="Tablero" />
        <Sheets layout={r.mdf} pieces={r.built.pieces} l={2440} a={1220} label="Fondo 3 mm" />
      </section>

      <section className="card form">
        <button type="button" className="btn primary" onClick={() => onPass(state, r)}>Pasar al cotizador</button>
        <div className="quick">
          <button type="button" className="btn ghost" onClick={() => void copy()}>Copiar despiece</button>
          <a className="btn sale" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar despiece por WhatsApp</a>
        </div>
        <button type="button" className="btn ghost" onClick={() => void csv()}>Descargar CSV (para optimizador o maderería)</button>
        {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </section>
      <p className="muted center">Las medidas de los planos son guía; verifica en obra.</p>
    </>
  )
}

function Sheets({ layout, pieces, l, a, label }: { layout: Layout; pieces: BPiece[]; l: number; a: number; label: string }) {
  return (
    <>
      {layout.sheets.map((s, si) => (
        <figure key={si} className="cut-sheet">
          <figcaption>{label} · hoja {si + 1} de {layout.sheets.length} · {s.usedPct} % de uso</figcaption>
          <svg viewBox={`-4 -4 ${l + 8} ${a + 8}`} role="img" aria-label={`${label}, hoja ${si + 1}: ${s.placed.length} piezas, ${s.usedPct} % de uso`}>
            <rect x="0" y="0" width={l} height={a} className="cut-board" />
            {s.placed.map((p, k) => {
              const big = Math.min(p.w, p.h) > 90 && Math.max(p.w, p.h) > 260
              const fs = Math.max(26, Math.min(48, Math.min(p.w, p.h) / 3))
              const pc = pieces[p.i]
              return (
                <g key={k}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} fill={PALETTE[p.i % PALETTE.length]} stroke="#4a5a50" strokeWidth={3} />
                  <text x={p.x + p.w / 2} y={p.y + p.h / 2} fontSize={fs} fontWeight={700} fill="#1d1d1f" textAnchor="middle" dominantBaseline="central">
                    {big ? `${p.i + 1} · ${pc.l}×${pc.a}` : p.i + 1}
                  </text>
                </g>
              )
            })}
          </svg>
        </figure>
      ))}
    </>
  )
}
