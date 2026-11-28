import { useState } from 'react'
import { formatMoney } from '../data/money'
import { priceFromCost, type QuoterConfig } from '../data/quoter'
import { whatsappLink } from '../data/reminder'
import { calcService, isOn, materialText, serviceDefaults, serviceOf, serviceTitle, SERVICES, type Part, type ServConfig, type ServResult, type ServState } from '../data/services'
import type { Business } from '../data/types'

/** Servicios extra: drywall, resina, pintura, herrería… con su lista de material, horas y precio. También junta varias partidas en un solo total. */
export default function ServicesPanel({ business, cfg, conf, km, state, onChange, parts, onAdd, onRemove, onClear, onPass, onPassParts, onGoCosts, showCosts }: {
  business: Business
  cfg: QuoterConfig
  conf: ServConfig
  km: number
  state: ServState
  onChange: (s: ServState) => void
  parts: Part[]
  onAdd: (p: Part) => void
  onRemove: (id: string) => void
  onClear: () => void
  onPass: (s: ServState, r: ServResult) => void
  onPassParts: () => void
  onGoCosts?: () => void
  showCosts: boolean
}) {
  const enabled = SERVICES.filter((s) => isOn(s.key, conf))
  const current = enabled.find((s) => s.key === state.key) ?? enabled[0]
  const st: ServState = current && current.key !== state.key ? { key: current.key, values: serviceDefaults(current) } : state
  const [raw, setRaw] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>()
  const r = current ? calcService(st, cfg, conf) : undefined
  const money = (c: number) => formatMoney(c, business.currency)
  const pesos = (p: number) => money(Math.round(p * 100))
  const price = r ? priceFromCost(cfg, r.material, r.hours, km) : undefined
  const partsMat = parts.reduce((a, p) => a + p.material, 0)
  const partsHrs = parts.reduce((a, p) => a + p.hours, 0)
  const partsPrice = parts.length ? priceFromCost(cfg, partsMat, partsHrs, km) : undefined

  function pick(key: string) {
    const s = serviceOf(key)
    setRaw({})
    onChange({ key, values: serviceDefaults(s) })
    setMsg(undefined)
  }
  function setValue(k: string, v: string) {
    setRaw({ ...raw, [k]: v })
    const n = parseFloat(v.replace(',', '.'))
    onChange({ ...st, values: { ...st.values, [k]: Number.isFinite(n) ? n : 0 } })
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMsg({ ok: true, text: 'Copiado.' })
    } catch {
      setMsg({ ok: false, text: 'No se pudo copiar. Usa el botón de WhatsApp.' })
    }
  }
  const partsText = partsPrice
    ? [`Hola, te comparto la cotización de ${business.name}:`, '', ...parts.map((p) => `• ${p.name}`), '', `Total: *${money(partsPrice.priceCents)}*`, 'Incluye material, mano de obra e instalación.'].join('\n')
    : ''

  return (
    <>
      {!current ? (
        <section className="card empty-state">
          <p>Todavía no tienes servicios activados. Enciende en <strong>Mis costos → Servicios</strong> los que sí haces (drywall, resina, pintura, herrería, aluminio…) y pon tus precios.</p>
          {onGoCosts && <button type="button" className="btn primary" onClick={onGoCosts}>Ir a Mis costos</button>}
        </section>
      ) : (
        <>
          <section className="card quoter-price" aria-live="polite">
            <small className="muted">Precio sugerido · {current.name}</small>
            <strong className="quoter-big">{money(price!.priceCents)}</strong>
            <small className="muted">{r!.m2 ? `${money(Math.ceil(price!.priceCents / Math.max(0.01, r!.m2) / 100) * 100)} por m² (${Math.round(r!.m2 * 100) / 100} m²) · ` : ''}{showCosts ? `Material ${pesos(r!.material)} · ` : ''}{Math.round(r!.hours * 10) / 10} h de trabajo{r!.days ? ` · ~${r!.days} días de curado o secado` : ''}</small>
          </section>
          <div className="chips" role="tablist" aria-label="Servicio">
            {enabled.map((s) => <button key={s.key} type="button" role="tab" aria-selected={s.key === current.key} className={`chip ${s.key === current.key ? 'on' : ''}`} onClick={() => pick(s.key)}>{s.name}</button>)}
          </div>
          <section className="card form">
            <p className="muted">{current.desc}</p>
            <div className="two">
              {current.fields.map((fd) => (
                <label key={fd.k}>
                  <span>{fd.label}{fd.unit && <small className="muted"> ({fd.unit})</small>}</span>
                  {fd.choices ? (
                    <select value={st.values[fd.k] ?? fd.def} onChange={(e) => setValue(fd.k, e.target.value)}>
                      {fd.choices.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  ) : (
                    <input value={raw[fd.k] ?? String(st.values[fd.k] ?? fd.def)} onChange={(e) => setValue(fd.k, e.target.value)} inputMode="decimal" />
                  )}
                </label>
              ))}
            </div>
          </section>
          {current.warning && <p className="note-box bad">{current.warning}</p>}
          <section className="card">
            <h2>Material</h2>
            <div className="scroll">
              <table className="cut-table">
                <thead><tr><th>Material</th><th>Cant.</th><th>Unidad</th>{showCosts && <th>Importe</th>}</tr></thead>
                <tbody>
                  {r!.lines.map((l) => <tr key={l.n}><td>{l.n}</td><td>{l.qty}</td><td>{l.unit}</td>{showCosts && <td>{pesos(l.qty * l.price)}</td>}</tr>)}
                </tbody>
              </table>
            </div>
            {r!.notes.length > 0 && <ul className="fixed-paid">{r!.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
          </section>
          <section className="card form">
            <button type="button" className="btn primary" onClick={() => onPass(st, r!)}>Pasar al cotizador</button>
            <button type="button" className="btn ghost" onClick={() => { onAdd({ id: crypto.randomUUID(), name: serviceTitle(st), material: r!.material, hours: r!.hours, serv: st }); setMsg({ ok: true, text: 'Agregado a la cotización (abajo).' }) }}>Agregar a la cotización</button>
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => void copy(materialText(st, r!))}>Copiar lista de material</button>
              <a className="btn sale" href={whatsappLink(materialText(st, r!), '', business.country)} target="_blank" rel="noopener noreferrer">Material por WhatsApp</a>
            </div>
            {msg && <p className={msg.ok ? 'success' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
          </section>
          <p className="muted center">Los precios de material son estimados: cámbialos por los tuyos en Mis costos → Servicios.</p>
        </>
      )}

      {parts.length > 0 && partsPrice && (
        <section className="card form">
          <h2>Cotización con varias partidas</h2>
          <ul className="kitchen-mods">
            {parts.map((p) => (
              <li key={p.id} className="part-row">
                <span className="grow">{p.name}<small className="muted">{showCosts ? ` · material ${pesos(p.material)}` : ''} · {Math.round(p.hours * 10) / 10} h</small></span>
                <button type="button" className="btn small ghost" aria-label={`Quitar ${p.name}`} onClick={() => onRemove(p.id)}>✕</button>
              </li>
            ))}
          </ul>
          <p className="total-line">Total <strong>{money(partsPrice.priceCents)}</strong></p>
          <button type="button" className="btn primary" onClick={onPassParts}>Pasar todo al cotizador</button>
          <div className="quick">
            <a className="btn sale" href={whatsappLink(partsText, '', business.country)} target="_blank" rel="noopener noreferrer">Enviar por WhatsApp</a>
            <button type="button" className="btn ghost" onClick={onClear}>Vaciar</button>
          </div>
        </section>
      )}
    </>
  )
}
