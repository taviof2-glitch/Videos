import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, PackageSearch, TriangleAlert } from 'lucide-react'
import { formatDay } from '../data/dates'
import { materialNeeds, type NeedLine } from '../data/materialNeeds'
import { adjustMaterial, saveMaterial } from '../data/materials'
import { formatMoney } from '../data/money'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

type Tab = 'material' | 'obras' | 'comprar'

/** Material necesario: cuánto piden las obras, cuánto hay, qué falta comprar y qué obras ya se pueden cortar. */
export default function MaterialNeeds({ business }: { business: Business }) {
  const [tab, setTab] = useState<Tab>('material')
  const [accepted, setAccepted] = useState(false)
  const [msg, setMsg] = useState('')
  const n = useLiveQuery(() => materialNeeds(business, accepted), [business, accepted])
  const money = (c: number) => formatMoney(c, business.currency)
  if (!n) return <p className="loading">Calculando…</p>
  const short = n.lines.filter((l) => l.short > 0)
  const ready = n.jobs.filter((j) => j.ready).length
  const groups = new Map<string, NeedLine[]>()
  for (const l of short) groups.set(l.supplier, [...(groups.get(l.supplier) ?? []), l])

  return (
    <>
      <h1><PackageSearch className="i-inline" aria-hidden /> Material necesario</h1>
      <p className="muted">Lo que piden las obras que faltan por cortar (despiece del Cotizador, muebles de Bases, estimado por metro y lo que agregues a mano) contra lo que hay en Material del taller.</p>
      <label className="check"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>Contar también las cotizaciones aceptadas que aún no son obra</span></label>

      <section className="card">
        <div className="fixed-totals">
          <div><small className="muted">Materiales</small><strong>{n.lines.length}</strong></div>
          <div><small className="muted">Faltan</small><strong className={short.length ? 'amount expense' : ''}>{short.length}</strong></div>
          <div><small className="muted">Obras listas</small><strong>{ready} de {n.jobs.length}</strong></div>
        </div>
        {short.length > 0 ? <p className="note-box bad">Hay que comprar {short.length === 1 ? '1 material' : `${short.length} materiales`}{n.buyCents ? `, unos ${money(n.buyCents)}` : ''}.</p> : n.lines.length ? <p className="note-box">✓ Tienes todo el material para las obras pendientes.</p> : null}
        {n.unknown.length > 0 && <small className="muted">{n.unknown.length} cosas no están dadas de alta en Material del taller; se cuentan como que no hay.</small>}
      </section>

      {n.jobs.some((j) => j.items.length === 0) && <p className="note-box">{n.jobs.filter((j) => j.items.length === 0).length} obra(s) sin material calculado. Agrégalo en cada obra (pestaña «Por obra»).</p>}
      {n.jobs.length === 0 ? <p className="muted">No hay obras por cortar. Las obras en anticipo, material o corte aparecen aquí.</p> : (
        <>
          <div className="tabs" role="tablist">
            {([['material', 'Por material'], ['obras', 'Por obra'], ['comprar', `Comprar (${short.length})`]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab-btn ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'material' && (
            <section className="card">
              <table className="cut-table need-table">
                <thead><tr><th>Material</th><th>Se necesita</th><th>Hay</th><th>Falta</th></tr></thead>
                <tbody>
                  {n.lines.map((l) => (
                    <tr key={l.key} className={l.short > 0 ? 'short' : ''}>
                      <td>{l.name}<br /><small className="muted">{l.jobs.length === 1 ? l.jobs[0] : `${l.jobs.length} obras`}</small></td>
                      <td>{l.need} {l.unit}</td>
                      <td>{l.materialId ? `${l.have}` : <button type="button" className="link" onClick={() => void saveMaterial(business.id, { name: l.name, unit: l.unit, stock: 0 }).then(() => setMsg(`«${l.name}» dado de alta con 0. Anota cuánto tienes en Material del taller.`), (e) => setMsg(e instanceof Error ? e.message : 'No se pudo'))}>Dar de alta</button>}</td>
                      <td>{l.short > 0 ? <strong className="neg">{l.short}</strong> : <CheckCircle2 className="i-inline pos" aria-label="Alcanza" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'obras' && n.jobs.map((j) => (
            <section key={j.id} className="card">
              <div className="row-between">
                <strong>{j.label}</strong>
                {j.items.length === 0 ? <span className="badge muted">Sin material</span> : j.ready ? <span className="badge ok">Lista para cortar</span> : <span className="badge out">Falta material</span>}
              </div>
              {j.due && <small className="muted">Entrega {formatDay(j.due)}</small>}
              {j.items.length === 0 && <p className="muted">Se cotizó sin medidas o a mano. Ábrela en <Link to="/obras">Obras</Link> → Detalles → «Lo que lleva la obra» y agrega su material.</p>}
              <ul className="moves">
                {j.items.map((it, i) => (
                  <li key={i}><span>{it.qty} {it.unit} · {it.name}{it.est && <small className="muted"> (aprox.)</small>}</span>{it.missing > 0 ? <strong className="neg"><TriangleAlert className="i-inline" aria-hidden /> faltan {it.missing}</strong> : <CheckCircle2 className="i-inline pos" aria-label="Hay" />}</li>
                ))}
              </ul>
            </section>
          ))}
          {tab === 'obras' && <small className="muted">El material del taller se reparte primero a la obra que se entrega antes.</small>}

          {tab === 'comprar' && (short.length === 0 ? <p className="success">No hay nada que comprar para las obras pendientes. 🎉</p> : [...groups].map(([supplier, ls]) => {
            const total = ls.reduce((s, l) => s + Math.round(l.short * l.priceCents), 0)
            const text = [`Hola, buen día. Les escribo de ${business.name}. Quiero encargar:`, ...ls.map((l) => `• ${l.short} ${l.unit} de ${l.name}`), '¿Me confirman precio y si lo tienen disponible? Gracias.'].join('\n')
            return (
              <section key={supplier || 'sin'} className="card">
                <div className="row-between"><strong>{supplier || 'Sin proveedor con precio'}</strong>{total > 0 && <strong>{money(total)}</strong>}</div>
                <ul className="moves">{ls.map((l) => <li key={l.key}><span>{l.short} {l.unit} · {l.name}</span>{l.priceCents > 0 && <small className="muted">{money(l.priceCents)} c/u</small>}</li>)}</ul>
                <div className="quick">
                  <a className="btn primary small" href={whatsappLink(text)} target="_blank" rel="noopener noreferrer">Pedir por WhatsApp</a>
                  <button type="button" className="btn ghost small" onClick={() => void Promise.all(ls.filter((l) => l.materialId).map((l) => adjustMaterial(business.id, l.materialId, l.short))).then(() => setMsg(`Listo: se sumó al taller lo de ${supplier || 'este pedido'}.`))}>Ya llegó: sumarlo al taller</button>
                </div>
              </section>
            )
          }))}
        </>
      )}
      {msg && <p className="success" role="status">{msg}</p>}
      <Link to="/material" className="btn ghost small">Ir a Material del taller</Link>
    </>
  )
}
