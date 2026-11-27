import { useRef, useState } from 'react'
import { Camera, Receipt } from 'lucide-react'
import { listMaterials, UNITS } from '../data/materials'
import { formatMoney, parseMoney } from '../data/money'
import { applyTicket, matchSupplier } from '../data/ticket'
import { listContacts } from '../data/contacts'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Business, PaymentMethod } from '../data/types'
import { readTicket, type TicketRead } from '../sync/assistant'
import { METHODS } from './forms'
import JobSelect from './JobSelect'
import { shrinkPhoto } from './photoShrink'

type Line = { key: string; include: boolean; materialId: string; name: string; unit: string; qty: string; price: string; text: string }

const toInput = (c: number) => (c > 0 ? (c / 100).toFixed(2) : '')

/**
 * Foto del ticket de compra → material del taller y gasto. El asistente lee el ticket; aquí se revisa cada línea
 * (a qué material corresponde, cantidad y precio) y solo se registra al confirmar.
 */
export default function TicketReader({ business, onDone, onClose }: { business: Business; onDone?: (msg: string, expenseId?: string) => void; onClose?: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const materials = listMaterials(business)
  const suppliers = useLiveQuery(() => listContacts(business.id, 'supplier'), [business.id])
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [read, setRead] = useState<TicketRead>()
  const [lines, setLines] = useState<Line[]>([])
  const [supplier, setSupplier] = useState('')
  const [total, setTotal] = useState('')
  const [withExpense, setWithExpense] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [jobId, setJobId] = useState('')
  const money = (c: number) => formatMoney(c, business.currency)
  const knownSupplier = supplier.trim() ? matchSupplier(supplier, suppliers ?? []) : undefined

  async function pick(file?: File) {
    if (!file) return
    setError('')
    setRead(undefined)
    setBusy(true)
    try {
      // Más resolución que otras fotos: los tickets tienen letra chica.
      const photo = await shrinkPhoto(file, 1800, 0.85)
      setPreview(photo.preview)
      const r = await readTicket({ image: photo.data, materials: materials.map((m) => ({ id: m.id, name: m.name, unit: m.unit })), suppliers: (suppliers ?? []).map((c) => c.name) })
      setRead(r)
      setSupplier(r.supplier)
      setTotal(toInput(r.totalCents))
      setLines(r.lines.map((l, i) => ({ key: String(i), include: l.isMaterial, materialId: l.materialId, name: l.name, unit: UNITS.includes(l.unit) ? l.unit : 'piezas', qty: String(l.quantity || ''), price: toInput(l.unitCents), text: l.text })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el ticket')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const set = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  async function save() {
    setError('')
    const chosen = lines.filter((l) => l.include)
    const parsed = chosen.map((l) => ({ ...l, q: parseFloat(l.qty.replace(',', '.')), c: l.price.trim() ? parseMoney(l.price) : 0 }))
    const bad = parsed.find((l) => !(l.q > 0) || l.c === null)
    if (bad) return setError(`Revisa la cantidad y el precio de «${bad.name || bad.text}»`)
    // Si el ticket no traía total legible, el gasto es la suma de lo marcado.
    const lineSum = parsed.reduce((s, l) => s + Math.round(l.q * (l.c ?? 0)), 0)
    const amount = (total.trim() ? parseMoney(total) : 0) || lineSum
    if (withExpense && !amount) return setError('Escribe el total del ticket para anotar el gasto')
    setBusy(true)
    try {
      const r = await applyTicket(business.id, {
        supplier, date: read?.date || undefined,
        lines: parsed.map((l) => ({ materialId: l.materialId, name: l.name, unit: l.unit, quantity: l.q, unitCents: l.c ?? 0 })),
        ...(withExpense && amount && { expense: { amountCents: amount, method, jobId: jobId || undefined } }),
      })
      const mats = `${r.updated ? `${r.updated} material${r.updated === 1 ? '' : 'es'} sumado${r.updated === 1 ? '' : 's'}` : ''}${r.updated && r.created ? ', ' : ''}${r.created ? `${r.created} nuevo${r.created === 1 ? '' : 's'}` : ''}`
      const msg = `✓ Ticket registrado${mats ? `: ${mats} al material del taller` : ''}.${r.expense ? ` Gasto de ${money(r.expense.amountCents)} anotado en Gastos (categoría Material).` : ''}${r.prices.length ? ` Precios del cotizador al día: ${r.prices.join('; ')}.` : ''}`
      setRead(undefined)
      setLines([])
      setPreview('')
      onDone?.(msg, r.expense?.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar')
    } finally {
      setBusy(false)
    }
  }

  const sum = lines.filter((l) => l.include).reduce((s, l) => s + Math.round((parseFloat(l.qty) || 0) * (parseMoney(l.price) ?? 0)), 0)

  return (
    <section className="card form ticket-reader" aria-label="Leer ticket de compra">
      <div className="row-between">
        <h2><Receipt className="i-inline" aria-hidden /> Ticket de compra</h2>
        {onClose && <button type="button" className="link" onClick={onClose}>Cerrar</button>}
      </div>
      {!read && <p className="muted">Toma la foto del ticket de la maderería o ferretería. El asistente lo lee, suma lo que compraste al material del taller y anota el gasto. Tú revisas antes de guardar.</p>}
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {!read && (
        <button type="button" className="btn primary" disabled={busy} onClick={() => input.current?.click()}>
          <Camera aria-hidden /> {busy ? 'Leyendo el ticket…' : preview ? 'Tomar otra foto' : 'Tomar foto del ticket'}
        </button>
      )}
      {preview && busy && <img src={preview} alt="Ticket" className="ticket-preview" />}

      {read && (
        <>
          <label>Proveedor<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ej. Maximaderas" list="ticket-suppliers" /></label>
          <datalist id="ticket-suppliers">{(suppliers ?? []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
          {supplier.trim() && <small className="muted">{knownSupplier ? `Se anota con tu proveedor «${knownSupplier.name}».` : 'Proveedor nuevo: se dará de alta en Proveedores.'}</small>}
          {read.doubts.length > 0 && <ul className="warn-list">{read.doubts.map((d) => <li key={d}>{d}</li>)}</ul>}
          <h3>Lo que compraste</h3>
          <ul className="ticket-lines">
            {lines.map((l) => (
              <li key={l.key} className={l.include ? '' : 'off'}>
                <label className="check"><input type="checkbox" checked={l.include} onChange={(e) => set(l.key, { include: e.target.checked })} /><span>{l.text}</span></label>
                {l.include && (
                  <>
                    <label>
                      Es el material
                      <select value={l.materialId} onChange={(e) => set(l.key, { materialId: e.target.value })}>
                        <option value="">Nuevo: {l.name}</option>
                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.stock} {m.unit})</option>)}
                      </select>
                    </label>
                    {!l.materialId && (
                      <div className="two">
                        <label>Nombre<input value={l.name} onChange={(e) => set(l.key, { name: e.target.value })} /></label>
                        <label>Unidad<select value={l.unit} onChange={(e) => set(l.key, { unit: e.target.value })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
                      </div>
                    )}
                    <div className="two">
                      <label>Cantidad<input value={l.qty} onChange={(e) => set(l.key, { qty: e.target.value })} inputMode="decimal" /></label>
                      <label>Precio c/u<input value={l.price} onChange={(e) => set(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0.00" /></label>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {lines.length === 0 && <p className="muted">No se encontraron artículos en el ticket.</p>}
          <p className="muted">Suma de lo marcado: {money(sum)}</p>

          <label className="check"><input type="checkbox" checked={withExpense} onChange={(e) => setWithExpense(e.target.checked)} /><span>Anotar el gasto en Gastos (categoría Material)</span></label>
          {withExpense && (
            <>
              <div className="two">
                <label>Total del ticket<input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" /></label>
                <label>Método<select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
              </div>
              <JobSelect businessId={business.id} value={jobId} onChange={setJobId} />
            </>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="quick">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setRead(undefined); setLines([]); setPreview('') }}>Descartar</button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void save()}>{busy ? 'Guardando…' : 'Registrar ticket'}</button>
          </div>
        </>
      )}
      {!read && error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
