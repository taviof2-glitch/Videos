import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatMoney, parseMoney } from '../data/money'
import { findByBarcode, listProducts } from '../data/products'
import { createPurchase, weightedCost } from '../data/purchases'
import { formatQuantity, parseQuantity } from '../data/quantity'
import { lineTotal } from '../data/transactions'
import type { Business, PaymentMethod } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import CreditFields from '../ui/CreditFields'
import { METHODS, fromLocalInput, resolveContactId, toLocalInput } from '../ui/forms'

type Line = { key: string; productId: string; name: string; qty: string; cost: string }
const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')

/** S28: registrar la entrada de mercancía de un proveedor. */
export default function PurchaseForm({ business }: { business: Business }) {
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>([])
  const [search, setSearch] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [newSupplier, setNewSupplier] = useState('')
  const [credit, setCredit] = useState(false)
  const [due, setDue] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(() => toLocalInput(new Date().toISOString()))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const matches = useLiveQuery(() => listProducts(business.id, { search }), [business.id, search]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)
  const productOf = (id: string) => products?.find((p) => p.id === id)

  function addProduct(p: { id: string; name: string; costCents: number }) {
    setError('')
    setLines((prev) => {
      const same = prev.find((l) => l.productId === p.id)
      if (same) return prev.map((l) => (l === same ? { ...l, qty: String((parseQuantity(l.qty) ?? 0) + 1) } : l))
      return [...prev, { key: crypto.randomUUID(), productId: p.id, name: p.name, qty: '1', cost: centsToInput(p.costCents) }]
    })
    setSearch('')
  }

  async function onSearchEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const hit = (await findByBarcode(business.id, search)) ?? (matches.length === 1 ? matches[0] : undefined)
    if (hit) addProduct(hit)
  }

  const parsed = lines.map((l) => ({ qty: parseQuantity(l.qty), cost: l.cost.trim() ? parseMoney(l.cost) : 0 }))
  const total = lines.reduce((sum, _l, i) => (parsed[i].qty && parsed[i].cost !== null ? sum + lineTotal(parsed[i].qty!, parsed[i].cost!) : sum), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (lines.length === 0) return setError('Agrega al menos un producto')
    for (let i = 0; i < lines.length; i++) {
      if (!parsed[i].qty) return setError(`La cantidad de "${lines[i].name}" debe ser mayor que cero`)
      if (parsed[i].cost === null) return setError(`El costo de "${lines[i].name}" no es válido`)
    }
    const when = fromLocalInput(date)
    if (!when) return setError('La fecha no es válida')
    setSaving(true)
    try {
      const supplier = await resolveContactId(business.id, 'supplier', supplierId, newSupplier)
      const purchase = await createPurchase(business.id, {
        supplierId: supplier || undefined, date: when, paymentMethod: method, credit, dueDate: credit ? due : undefined, notes,
        items: lines.map((l, i) => ({ productId: l.productId, quantity: parsed[i].qty!, unitCostCents: parsed[i].cost! })),
      })
      navigate(`/compras/${purchase.id}`, { replace: true, state: { nueva: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/compras" className="back" aria-label="Volver a compras">←</Link>
        <h1 className="grow">Registrar compra</h1>
      </section>

      <form onSubmit={submit} className="card form" noValidate>
        <ContactSelect businessId={business.id} type="supplier" value={supplierId} onChange={setSupplierId} newName={newSupplier} onNewName={setNewSupplier} />

        <label>
          Agregar producto
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => void onSearchEnter(e)} placeholder="Nombre o código de barras" autoFocus />
        </label>
        {search.trim() && (
          <ul className="picker">
            {matches.length === 0 && <li className="muted">Ningún producto coincide.</li>}
            {matches.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addProduct(p)}>
                  <span>{p.name}</span>
                  <small className="muted">costo {money(p.costCents)} · {formatQuantity(p.stock)} disp.</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {products?.length === 0 && <p className="muted">Primero crea el producto en el inventario. <Link to="/inventario/nuevo">Crear producto</Link></p>}

        {lines.length > 0 && (
          <ul className="cart">
            {lines.map((l, i) => {
              const p = productOf(l.productId)
              const { qty, cost } = parsed[i]
              const newCost = p && qty && cost !== null ? weightedCost(p.stock, p.costCents, qty, cost) : undefined
              return (
                <li key={l.key}>
                  <div className="row-between">
                    <strong>{l.name}</strong>
                    <button type="button" className="photo-remove static" aria-label={`Quitar ${l.name}`} onClick={() => setLines(lines.filter((x) => x !== l))}>×</button>
                  </div>
                  <div className="two">
                    <label>
                      Cantidad
                      <input value={l.qty} onChange={(e) => setLines(lines.map((x) => (x === l ? { ...x, qty: e.target.value } : x)))} inputMode="decimal" aria-label={`Cantidad de ${l.name}`} />
                    </label>
                    <label>
                      Costo por unidad
                      <input value={l.cost} onChange={(e) => setLines(lines.map((x) => (x === l ? { ...x, cost: e.target.value } : x)))} inputMode="decimal" placeholder="0.00" aria-label={`Costo de ${l.name}`} />
                    </label>
                  </div>
                  {p && qty ? (
                    <p className="muted line-total">
                      Inventario: {formatQuantity(p.stock)} → {formatQuantity(p.stock + qty)}
                      {newCost !== undefined && newCost !== p.costCents ? ` · costo ${money(p.costCents)} → ${money(newCost)}` : ''}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <p className="total-line">Total <strong>{money(total)}</strong></p>

        <CreditFields credit={credit} onCredit={setCredit} due={due} onDue={setDue} creditLabel="A crédito" contactWord="un proveedor" />
        {!credit && (
          <label>
            Método de pago
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
        )}
        <label>
          Fecha y hora
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Notas (opcional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej. factura 1234" />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn expense" type="submit" disabled={saving}>{saving ? 'Guardando…' : credit ? 'Registrar compra a crédito' : 'Registrar compra'}</button>
      </form>
    </>
  )
}
