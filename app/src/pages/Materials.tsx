import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adjustMaterial, bestPrice, deleteMaterial, isLow, listMaterials, saveMaterial, stockValueCents, SUGGESTED_MATERIALS, UNITS } from '../data/materials'
import { formatMoney, parseMoney } from '../data/money'
import type { Business, WorkMaterial } from '../data/types'
import TicketReader from '../ui/TicketReader'
import PurchaseOrder from '../ui/PurchaseOrder'
import { addOffcut, groupOffcuts, listOffcuts, removeOffcut } from '../data/offcuts'
import { useCan } from '../ui/actor'

const num = (s: string) => Math.max(0, parseFloat(s) || 0)

/** Material del taller: lo que hay en existencia y a cuánto lo vende cada proveedor. */
export default function Materials({ business }: { business: Business }) {
  const can = useCan()
  const list = [...listMaterials(business)].sort((a, b) => Number(isLow(b)) - Number(isLow(a)) || a.name.localeCompare(b.name, 'es'))
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(false)
  const [ticketMsg, setTicketMsg] = useState('')
  const [ticketExpense, setTicketExpense] = useState<string>()
  const money = (c: number) => formatMoney(c, business.currency)
  const low = list.filter(isLow)
  const run = (p: Promise<unknown>) => void p.then(() => setError(''), (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'))

  return (
    <>
      <section className="row-between">
        <h1>Material del taller</h1>
        <Link to="/mas" className="btn ghost small">Más</Link>
      </section>
      <p className="muted">Hojas, herrajes y retazos que tienes en el taller, y a cuánto los vende cada proveedor. No son los productos que vendes.</p>
      {ticketMsg && <p className="success" role="status">{ticketMsg} {ticketExpense && <Link to={`/gasto/${ticketExpense}`}>Ver el gasto</Link>}</p>}
      <PurchaseOrder business={business} />
      {ticket ? <TicketReader business={business} onClose={() => setTicket(false)} onDone={(m, id) => { setTicket(false); setTicketMsg(m); setTicketExpense(id) }} /> : (
        import.meta.env.VITE_SYNC !== 'off' && <button type="button" className="btn primary" onClick={() => { setTicket(true); setTicketMsg('') }}><Receipt aria-hidden /> Leer ticket de compra</button>
      )}

      {list.length > 0 && (
        <section className="card">
          <div className="fixed-totals">
            <div><small className="muted">Materiales</small><strong>{list.length}</strong></div>
            <div><small className="muted">Por comprar</small><strong className={low.length ? 'amount expense' : ''}>{low.length}</strong></div>
            {can('balance') && <div><small className="muted">Vale</small><strong>{money(stockValueCents(list))}</strong></div>}
          </div>
        </section>
      )}

      {list.length === 0 && editing !== 'new' && (
        <section className="card empty-state">
          <p>Todavía no tienes material registrado. Agrega tus hojas y herrajes para saber qué hay, qué falta y quién lo vende más barato.</p>
        </section>
      )}

      <ul className="fixed-list">
        {list.map((m) => {
          const best = bestPrice(m)
          return (
            <li key={m.id} className="card">
              <div className="row-between">
                <strong>{m.name}</strong>
                {isLow(m) && <span className="badge out">Comprar</span>}
              </div>
              <div className="row-between">
                <small className="muted">{best ? `Mejor precio: ${money(best.priceCents)} en ${best.supplier}` : 'Sin precios de proveedor'}</small>
                <strong>{m.stock} {m.unit}</strong>
              </div>
              <div className="stepper">
                <button type="button" className="btn ghost" aria-label={`Restar uno a ${m.name}`} onClick={() => run(adjustMaterial(business.id, m.id, -1))}>−</button>
                <button type="button" className="btn ghost" onClick={() => setEditing(editing === m.id ? undefined : m.id)}>{editing === m.id ? 'Cerrar' : 'Cambiar'}</button>
                <button type="button" className="btn ghost" aria-label={`Sumar uno a ${m.name}`} onClick={() => run(adjustMaterial(business.id, m.id, 1))}>+</button>
              </div>
              {editing === m.id && <MaterialForm business={business} material={m} onDone={() => setEditing(undefined)} />}
            </li>
          )
        })}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}

      {editing === 'new' ? (
        <section className="card"><MaterialForm business={business} onDone={() => setEditing(undefined)} /></section>
      ) : (
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Agregar material</button>
      )}

      <Offcuts business={business} />
    </>
  )
}

/** Retacera: los sobrantes de cada mueble, agrupados por tipo, grosor y color. Se agregan solos al descontar el material de una obra o guardar los sobrantes de Bases, o a mano. */
function Offcuts({ business }: { business: Business }) {
  const groups = groupOffcuts(listOffcuts(business))
  const total = groups.reduce((s, g) => s + g.items.length, 0)
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'tablero' | 'fondo'>('tablero')
  const [esp, setEsp] = useState('16')
  const [color, setColor] = useState('Blanco')
  const [l, setL] = useState('')
  const [a, setA] = useState('')
  const [err, setErr] = useState('')
  const cm = (mm: number) => Math.round(mm) / 10
  return (
    <section className="card">
      <h2>Retacera <small className="muted">({total} {total === 1 ? 'retazo' : 'retazos'})</small></h2>
      <p className="muted">Lo que sobra de cada hoja al hacer un mueble. En Bases y en el despiece, «¿Sale con retacera?» revisa si un proyecto nuevo se puede hacer con esto.</p>
      {groups.map((g) => (
        <details key={g.key} className="offcut-group" open={groups.length <= 2}>
          <summary><strong>{g.key}</strong> <small className="muted">· {g.items.length} {g.items.length === 1 ? 'pieza' : 'piezas'} · {g.areaM2} m²</small></summary>
          <ul className="moves">
            {g.items.map((o) => (
              <li key={o.id}>
                <span><strong>{cm(o.l)} × {cm(o.a)} cm</strong>{o.from && <small className="muted"> · de {o.from}{o.sheet ? `, hoja ${o.sheet}` : ''}</small>}</span>
                <button type="button" className="btn ghost small" onClick={() => void removeOffcut(business.id, o.id)}>Ya lo usé</button>
              </li>
            ))}
          </ul>
        </details>
      ))}
      {adding ? (
        <div className="form">
          <div className="two">
            <label>Tipo<select value={kind} onChange={(e) => { const k = e.target.value as 'tablero' | 'fondo'; setKind(k); if (k === 'fondo') setEsp('3') }}><option value="tablero">Tablero (melamina / MDF)</option><option value="fondo">Fondo</option></select></label>
            <label>Grosor (mm)<input value={esp} onChange={(e) => setEsp(e.target.value)} inputMode="numeric" /></label>
          </div>
          <label>Color<input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej. Blanco, Nogal Tzalam" /></label>
          <div className="two">
            <label>Largo (cm)<input value={l} onChange={(e) => setL(e.target.value)} inputMode="decimal" /></label>
            <label>Ancho (cm)<input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" /></label>
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancelar</button>
            <button type="button" className="btn primary" onClick={() => void addOffcut(business.id, { kind, esp: parseFloat(esp), color, l: parseFloat(l) * 10, a: parseFloat(a) * 10 }).then(() => { setL(''); setA(''); setErr('') }, (e) => setErr(e instanceof Error ? e.message : 'No se pudo'))}>Guardar retazo</button>
          </div>
        </div>
      ) : <button type="button" className="btn ghost small" onClick={() => setAdding(true)}>Agregar retazo a mano</button>}
    </section>
  )
}

function MaterialForm({ business, material, onDone }: { business: Business; material?: WorkMaterial; onDone: () => void }) {
  const [name, setName] = useState(material?.name ?? '')
  const [unit, setUnit] = useState(material?.unit ?? 'hojas')
  const [stock, setStock] = useState(material ? String(material.stock) : '')
  const [min, setMin] = useState(material?.min ? String(material.min) : '')
  const [prices, setPrices] = useState<{ supplier: string; price: string }[]>(() => (material?.prices ?? []).map((p) => ({ supplier: p.supplier, price: (p.priceCents / 100).toFixed(2) })))
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const used = new Set(listMaterials(business).map((m) => m.name.toLowerCase()))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await saveMaterial(business.id, { id: material?.id, name, unit, stock: num(stock), min: num(min) || undefined, prices: prices.map((p) => ({ supplier: p.supplier, priceCents: parseMoney(p.price) ?? 0 })) })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <form className="form fixed-form" onSubmit={(e) => void submit(e)}>
      <h2>{material ? `Cambiar «${material.name}»` : 'Nuevo material'}</h2>
      {!material && (
        <div className="proj-chips" aria-label="Sugerencias">
          {SUGGESTED_MATERIALS.filter(([n]) => !used.has(n.toLowerCase())).map(([n, u]) => <button key={n} type="button" className={`chip ${name === n ? 'on' : ''}`} onClick={() => { setName(n); setUnit(u) }}>{n}</button>)}
        </div>
      )}
      <div className="two">
        <label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Hoja de melamina nogal" /></label>
        <label>
          Se cuenta en
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {[...new Set([...UNITS, unit])].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        <label>Cuánto tienes<input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" placeholder="0" /></label>
        <label>Avisar cuando queden <small className="muted">(opcional)</small><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Ej. 2" /></label>
      </div>
      <h3>Precios por proveedor</h3>
      {prices.map((p, i) => (
        <div className="mat-row" key={i}>
          <label>Proveedor<input value={p.supplier} onChange={(e) => setPrices(prices.map((x, k) => (k === i ? { ...x, supplier: e.target.value } : x)))} placeholder="Ej. Maderas Tepa" /></label>
          <label>Precio ($)<input value={p.price} onChange={(e) => setPrices(prices.map((x, k) => (k === i ? { ...x, price: e.target.value } : x)))} inputMode="decimal" /></label>
          <button type="button" className="btn ghost" aria-label={`Quitar el precio de ${p.supplier || 'este proveedor'}`} onClick={() => setPrices(prices.filter((_, k) => k !== i))}>Quitar</button>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => setPrices([...prices, { supplier: '', price: '' }])}>Agregar precio de un proveedor</button>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={onDone}>Cancelar</button>
        <button type="submit" className="btn primary">Guardar</button>
      </div>
      {material && (confirm ? (
        <div className="card confirm">
          <p>¿Quitar «{material.name}» de tu material?</p>
          <div className="quick">
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Cancelar</button>
            <button type="button" className="btn expense" onClick={() => void deleteMaterial(business.id, material.id).then(onDone)}>Sí, quitar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn danger-text" onClick={() => setConfirm(true)}>Quitar este material</button>
      ))}
    </form>
  )
}
