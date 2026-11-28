import { useMemo, useState } from 'react'
import Furniture3D from './Furniture3D'
import Plan2D from './Plan2D'
import OffcutTools from './OffcutTools'
import { usableRests } from '../data/offcuts'
import { removeFavorite, saveFavorite } from '../data/favorites'
import { labelsPdf } from '../data/labels'
import { APOYO_LABEL, type Apoyo, sketchCutFile, baseTitle, calcBase, cubPrice, CUBIERTA_LABEL, type CubiertaTipo, cutCsv, cutText, defaultValues, edgeText, GROUPS, hardwareList, templateOf, TEMPLATES, type BaseResult, type BaseState, type Layout, type BPiece } from '../data/bases'
import { DEFAULT_KITCHEN, KIND_NAME, kitchenWarnings, modulesOf, STD, walls, type KitchenState, type KKind, type KModule, type Pared, type Spot } from '../data/kitchen'
import { formatMoney } from '../data/money'
import { priceFromCost, type QuoterConfig } from '../data/quoter'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'
import { downloadBlob } from './share'
import PhotoQuote from './PhotoQuote'

const PALETTE = ['#cfe3d6', '#f4dcb4', '#d9d4ef', '#f3cfcf', '#cde4ef', '#e6e1c9', '#d6ead0', '#efd7e7']

/** Bases: elige un mueble, ajusta medidas y sale el despiece, el acomodo en hojas y el precio. */
export default function BasesPanel({ business, cfg, km, state, onChange, onPass, onAdd, showCosts }: {
  business: Business
  cfg: QuoterConfig
  km: number
  state: BaseState
  onChange: (s: BaseState) => void
  onPass: (s: BaseState, r: BaseResult) => void
  /** Junta este mueble con otros trabajos en una sola cotización (pestaña Servicios). */
  onAdd?: (s: BaseState, r: BaseResult) => void
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
    onChange({ key, values, opts: { ...state.opts, fondo: nt.fondo, cubierta: key === 'cocina' }, ...(key === 'cocina' && { kitchen: structuredClone(DEFAULT_KITCHEN) }) })
    setMsg(undefined)
  }
  const [favName, setFavName] = useState<string>()
  const [favMsg, setFavMsg] = useState<{ ok: boolean; text: string }>()
  function loadFavorite(st: unknown) {
    const ns = structuredClone(st) as BaseState
    if (!ns?.key || !ns.values) return
    setRaw(Object.fromEntries(Object.entries(ns.values).map(([k, v]) => [k, String(v)])))
    onChange(ns)
    setFavMsg({ ok: true, text: 'Favorito cargado: ajusta lo que cambie.' })
  }
  async function keepFavorite() {
    try {
      await saveFavorite(business, favName ?? baseTitle(state), state)
      setFavName(undefined)
      setFavMsg({ ok: true, text: '⭐ Guardado en favoritos.' })
    } catch (e) { setFavMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo guardar' }) }
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

  async function labels() {
    const name = `etiquetas-${state.key}.pdf`
    const ok = await downloadBlob(new Blob([labelsPdf(r.built.pieces, baseTitle(state)) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), name)
    setMsg(ok ? { ok: true, text: `Se descargó ${name}: imprímelo, recorta y pega cada etiqueta en su pieza.` } : { ok: false, text: 'No se pudo descargar el archivo.' })
  }

  async function sct(which: 'board' | 'mdf') {
    const name = `${state.key}${which === 'mdf' ? '-fondos' : ''}.sct`
    const ok = await downloadBlob(new Blob([sketchCutFile(r, cfg, which, state.opts.veta)], { type: 'application/octet-stream' }), name)
    setMsg(ok ? { ok: true, text: `Se descargó ${name}: ábrelo en SketchCut PRO.` } : { ok: false, text: 'No se pudo descargar el archivo.' })
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
        <h2>⭐ Favoritos</h2>
        {business.favorites?.length ? (
          <div className="fav-row">
            {business.favorites.map((f) => (
              <span key={f.name} className="chip">
                <button type="button" className="link" onClick={() => loadFavorite(f.state)}>{f.name}</button>
                <button type="button" className="link danger-link" aria-label={`Quitar ${f.name}`} onClick={() => void removeFavorite(business, f.name)}>×</button>
              </span>
            ))}
          </div>
        ) : <p className="muted">Guarda aquí los muebles que cotizas seguido para abrirlos con un toque.</p>}
        {favName === undefined
          ? <button type="button" className="btn ghost small" onClick={() => setFavName(baseTitle(state))}>Guardar este mueble en favoritos</button>
          : (
            <div className="fav-row">
              <input aria-label="Nombre del favorito" value={favName} onChange={(e) => setFavName(e.target.value)} style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="btn primary small" onClick={() => void keepFavorite()}>Guardar</button>
              <button type="button" className="btn ghost small" onClick={() => setFavName(undefined)}>Cancelar</button>
            </div>
          )}
        {favMsg && <p className={favMsg.ok ? 'success' : 'error'} role="status">{favMsg.text}</p>}
      </section>

      <PhotoQuote key={`foto`} state={state} onApply={(ns) => { setRaw(Object.fromEntries(Object.entries(ns.values).map(([k, v]) => [k, String(v)]))); onChange(ns) }} />
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
        {state.key === 'cocina' ? <KitchenForm k={state.kitchen ?? DEFAULT_KITCHEN} onChange={(kitchen) => onChange({ ...state, kitchen })} /> : (
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
        )}
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
        <label className="check"><input type="checkbox" checked={!!state.opts.pushOpen} onChange={(e) => setOpt('pushOpen', e.target.checked)} /><span>Sin jaladeras (push-open)</span></label>
        <label>
          Apoyo en el piso
          <select value={state.opts.apoyo ?? 'normal'} onChange={(e) => setOpt('apoyo', e.target.value as Apoyo)}>
            {(Object.keys(APOYO_LABEL) as Apoyo[]).map((k) => <option key={k} value={k}>{APOYO_LABEL[k]}</option>)}
          </select>
        </label>
        {t.cubierta && <label className="check"><input type="checkbox" checked={state.opts.cubierta} onChange={(e) => setOpt('cubierta', e.target.checked)} /><span>Incluir cubierta ({pesos(cubPrice(cfg, state.opts.cubiertaTipo))} por metro)</span></label>}
        {t.cubierta && state.opts.cubierta && (
          <label>
            Tipo de cubierta
            <select value={state.opts.cubiertaTipo ?? 'post'} onChange={(e) => setOpt('cubiertaTipo', e.target.value as CubiertaTipo)}>
              {(Object.keys(CUBIERTA_LABEL) as CubiertaTipo[]).map((k) => <option key={k} value={k}>{CUBIERTA_LABEL[k]}</option>)}
            </select>
          </label>
        )}
      </section>

      {t.tips.length > 0 && <p className="note-box">{t.tips.join(' ')}</p>}

      <section className="card">
        <h2>Lo que lleva</h2>
        <ul className="fixed-paid">
          <li>{r.board.sheets.length} hoja{r.board.sheets.length === 1 ? '' : 's'} de {cfg.hojaL}×{cfg.hojaA}{r.board.sheets.length ? ` · aprovechamiento ${Math.round(r.board.sheets.reduce((a, s) => a + s.usedPct, 0) / r.board.sheets.length)} %` : ''}</li>
          {r.mdf.sheets.length > 0 && <li>{r.mdf.sheets.length} hoja{r.mdf.sheets.length === 1 ? '' : 's'} de fondo de 3 mm</li>}
          <li>Canto delgado: {r.edge.d.toFixed(1)} m · canto grueso: {r.edge.g.toFixed(1)} m <small className="muted">(con 10 % de desperdicio)</small></li>
          {hardwareList(r.built.hw, r.tornillos, state.opts.suave, r, state.opts.pushOpen).map((h) => <li key={h}>{h}</li>)}
          {r.tapas > 0 && <li>{r.tapas} tapa tornillos{r.clavos ? ` · ${r.clavos} clavos de 1" para fondos` : ''}{r.deslizadores ? ` · ${r.deslizadores} deslizadores` : ''}</li>}
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

      {(() => {
        const [W, H, D] = t.dims({ ...defaultValues(t), ...state.values })
        return W > 0 && H > 0 ? <><Plan2D width={W} height={H} depth={D || 400} doors={r.built.puertas} drawers={r.built.cajones} title={baseTitle(state)} business={business.name} /><Furniture3D width={W} height={H} depth={D || 400} doors={r.built.puertas} drawers={r.built.cajones} title={baseTitle(state)} business={business.name} /></> : null
      })()}

      <section className="card">
        <h2>Acomodo en hojas</h2>
        <small className="muted">Meta: más de 90 % de uso por hoja. {state.opts.veta ? 'Con veta: ninguna pieza se gira.' : ''}</small>
        <Sheets layout={r.board} pieces={r.built.pieces} l={cfg.hojaL} a={cfg.hojaA} label="Tablero" />
        <Sheets layout={r.mdf} pieces={r.built.pieces} l={2440} a={1220} label="Fondo 3 mm" />
      </section>

      <OffcutTools business={business} esp={state.opts.esp} fixed={state.opts.veta} title={baseTitle(state)} sheetPrice={cfg.hoja} sheetArea={cfg.hojaL * cfg.hojaA}
        board={r.built.pieces.filter((p) => !p.mdf).map((p) => ({ n: p.n, l: p.l, a: p.a, q: p.q }))}
        fondo={r.built.pieces.filter((p) => p.mdf).map((p) => ({ n: p.n, l: p.l, a: p.a, q: p.q }))}
        rests={[
          ...r.board.sheets.flatMap((s, i) => usableRests(s.free).map((x) => ({ ...x, esp: state.opts.esp, kind: 'tablero' as const, sheet: i + 1 }))),
          ...r.mdf.sheets.flatMap((s, i) => usableRests(s.free).map((x) => ({ ...x, esp: 3, kind: 'fondo' as const, sheet: i + 1 }))),
        ]} />

      <section className="card form">
        <button type="button" className="btn primary" onClick={() => onPass(state, r)}>Pasar al cotizador</button>
        {onAdd && <button type="button" className="btn ghost" onClick={() => { onAdd(state, r); setMsg({ ok: true, text: 'Agregado a la cotización con varias partidas (pestaña Servicios).' }) }}>Agregar a la cotización</button>}
        <div className="quick">
          <button type="button" className="btn ghost" onClick={() => void copy()}>Copiar despiece</button>
          <a className="btn sale" href={whatsappLink(text, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar despiece por WhatsApp</a>
        </div>
        <button type="button" className="btn ghost" onClick={() => void sct('board')}>Descargar para SketchCut PRO (.sct)</button>
        {r.mdf.sheets.length > 0 && <button type="button" className="btn ghost" onClick={() => void sct('mdf')}>Fondos de 3 mm para SketchCut (.sct)</button>}
        <button type="button" className="btn ghost" onClick={() => void csv()}>Descargar CSV (para optimizador o maderería)</button>
        <button type="button" className="btn ghost" onClick={() => void labels()}>Etiquetas para las piezas (PDF)</button>
        {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </section>
      <Guide />
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

const KINDS: KKind[] = ['bajo', 'cajonera', 'fregadero', 'estufa', 'alacena', 'torre', 'esquinero', 'refri', 'ajuste']

/** Asistente de cocinas: forma, paredes y aparatos; luego la lista de módulos se puede cambiar a mano. */
function KitchenForm({ k, onChange }: { k: KitchenState; onChange: (k: KitchenState) => void }) {
  // Cambiar la forma, las paredes o los aparatos vuelve a repartir los módulos.
  const set = (patch: Partial<KitchenState>) => onChange({ ...k, ...patch, modules: undefined })
  const mods = modulesOf(k)
  const ws = walls(k)
  const editMods = (next: KModule[]) => onChange({ ...k, modules: next })
  const warn = kitchenWarnings(k)
  const spot = (name: 'fregadero' | 'estufa' | 'refri', label: string, widths: number[]) => {
    const sp: Spot = k[name]
    return (
      <fieldset className="kitchen-spot">
        <legend>{label}</legend>
        <div className="three">
          <label>Pared<select value={sp.pared} onChange={(e) => set({ [name]: { ...sp, pared: e.target.value as Pared } })}>{ws.map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
          <label><span>Desde el inicio <small className="muted">(mm)</small></span><input value={sp.pos} inputMode="numeric" onChange={(e) => set({ [name]: { ...sp, pos: parseInt(e.target.value) || 0 } })} /></label>
          <label><span>Ancho <small className="muted">(mm)</small></span><select value={sp.ancho} onChange={(e) => set({ [name]: { ...sp, ancho: Number(e.target.value) } })}>{widths.map((w) => <option key={w} value={w}>{w}</option>)}</select></label>
        </div>
      </fieldset>
    )
  }
  return (
    <>
      <div className="seg three-seg" role="group" aria-label="Forma de la cocina">
        {(['lineal', 'L', 'U', 'paralela'] as const).map((f) => <button key={f} type="button" className={k.forma === f ? 'on' : ''} onClick={() => set({ forma: f })}>{f === 'lineal' ? 'Lineal' : f === 'paralela' ? 'Paralela' : `En ${f}`}</button>)}
      </div>
      <div className="three">
        {ws.map((w) => (
          <label key={w}><span>Pared {w} <small className="muted">(mm)</small></span><input value={k.paredes[w] || ''} inputMode="numeric" onChange={(e) => set({ paredes: { ...k.paredes, [w]: parseInt(e.target.value) || 0 } })} /></label>
        ))}
      </div>
      <small className="muted">{k.forma === 'paralela' ? 'Dos filas frente a frente con pasillo de 1.20 m: A y B no se tocan.' : k.forma === 'L' ? 'A y B se juntan en la esquina (el final de A con el inicio de B).' : k.forma === 'U' ? 'B es la pared del fondo; A y C son los lados (A termina y C empieza en las esquinas con B).' : 'Todo en una sola pared.'}</small>
      {spot('fregadero', 'Fregadero', [600, 800, 900, 1000])}
      {spot('estufa', 'Estufa o parrilla', [600, 900])}
      {spot('refri', 'Refri (hueco)', [700, 750, 800, 900, 1000])}
      <label className="check"><input type="checkbox" checked={k.alacenas} onChange={(e) => set({ alacenas: e.target.checked })} /><span>Lleva alacenas</span></label>
      <label className="check"><input type="checkbox" checked={k.torre} onChange={(e) => set({ torre: e.target.checked })} /><span>Lleva torre / despensa de 60</span></label>
      {warn.length > 0 && <ul className="warn-list">{warn.map((w) => <li key={w} className="warn">{w}</li>)}</ul>}
      <h3>Módulos <small className="muted">({mods.filter((m) => m.kind !== 'refri' && m.kind !== 'ajuste').length})</small></h3>
      <ul className="kitchen-mods">
        {mods.map((m, i) => (
          <li key={m.id}>
            <span className="badge muted">{m.pared}</span>
            <select aria-label={`Tipo del módulo ${i + 1}`} value={m.kind} onChange={(e) => editMods(mods.map((x) => (x.id === m.id ? { ...x, kind: e.target.value as KKind } : x)))}>
              {KINDS.map((kd) => <option key={kd} value={kd}>{KIND_NAME[kd]}</option>)}
            </select>
            <select aria-label={`Ancho del módulo ${i + 1}`} value={m.ancho} onChange={(e) => editMods(mods.map((x) => (x.id === m.id ? { ...x, ancho: Number(e.target.value) } : x)))}>
              {[...new Set([...STD, m.ancho])].sort((a, b) => a - b).map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
            <button type="button" className="btn small ghost" aria-label={`Quitar el módulo ${i + 1}`} onClick={() => editMods(mods.filter((x) => x.id !== m.id))}>✕</button>
          </li>
        ))}
      </ul>
      <div className="quick">
        <button type="button" className="btn ghost" onClick={() => editMods([...mods, { id: `n${Date.now()}`, pared: ws[0], kind: 'bajo', ancho: 600 }])}>Agregar módulo</button>
        {k.modules && <button type="button" className="btn ghost" onClick={() => onChange({ ...k, modules: undefined })}>Volver a repartir</button>}
      </div>
    </>
  )
}

/** Guía rápida de taller: reglas de diseño en corto. */
function Guide() {
  return (
    <details className="card guide">
      <summary><strong>Guía rápida de taller</strong></summary>
      <ul>
        <li><strong>Alturas:</strong> el bajo de cocina termina en 90 cm (caja de 78, zoclo y cubierta). El zoclo mide de 10 a 15 cm y va al menos 7.5 cm hacia adentro de la puerta. La alacena va de 1.40 a 1.50 m del piso; si el bajo tiene poco fondo, súbela.</li>
        <li><strong>Fondos:</strong> bajo de 55 a 60 cm, alacena de 30 a 35, torre de 60 (con horno, 60 exactos y salida de calor atrás) y closet de 58 a 60.</li>
        <li><strong>Anchos de módulo:</strong> 30, 45, 50, 60, 75, 80, 90 y 100 cm. Horno, estufa y campana: 60 o 90.</li>
        <li><strong>Materiales:</strong> la estructura aguanta en 15–16 mm; las puertas mejor en 18 para que la bisagra muerda. El zoclo, de un material que aguante la humedad.</li>
        <li><strong>Bisagra de cazoleta:</strong> barreno de 35 mm a 14 de profundidad, con la orilla a 5 mm del canto (el centro queda a 22.5).</li>
        <li><strong>Correderas:</strong> ocupan 12.7–13 mm por lado; sepáralas 2 mm del lateral y deja 16 mm libres arriba de cada cajón.</li>
        <li><strong>Tornillos:</strong> 4×50 para estructura; 4×30 o 3.5×17 para herrajes. Siempre con barreno guía y nunca a menos de 50 mm de una esquina.</li>
        <li><strong>Tornillo y broca guía según el espesor:</strong> 9 mm → tornillo #5 con broca de 2 mm · 12 mm → #6 con broca de 2.5 · 15 mm → #8 con broca de 3 · 18 mm → #10 con broca de 4. Mínimo 25 mm del borde.</li>
        <li><strong>Vidrio:</strong> incoloro, pavonado o templado. El templado no se corta después: pídelo a la medida exacta.</li>
        <li><strong>Puertas que abren hacia arriba:</strong> pistón de 50 a 120 N según el peso; deja 130 mm libres al frente.</li>
        <li><strong>Muros chuecos:</strong> deja holgura y tápala con piezas de ajuste de 5 a 10 cm.</li>
        <li><strong>Sin jaladeras:</strong> usa puertas dobles; si queda un módulo de una puerta, ponlo en la orilla.</li>
        <li><strong>Errores comunes:</strong> zoclo de melamina común, herrajes baratos, módulos que no coinciden con los aparatos y poco espacio entre la cubierta y la alacena (mínimo 30 cm).</li>
      </ul>
    </details>
  )
}
