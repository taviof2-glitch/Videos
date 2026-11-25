import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, dayKey } from '../data/dates'
import { formatMoney, parseMoney } from '../data/money'
import { findByBarcode, listProducts } from '../data/products'
import { parseQuantity } from '../data/quantity'
import { DEFAULT_UNIT, DEFAULT_VALIDITY_DAYS, createQuote, getQuote, getQuoteItems, quoteTotals, updateQuote } from '../data/quotes'
import { lineTotal } from '../data/transactions'
import type { Business, Quote, QuoteItem } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import { resolveContactId } from '../ui/forms'

type Line = { key: string; productId?: string; name: string; unit: string; qty: string; price: string }
const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')
const UNITS = ['pieza', 'juego', 'servicio', 'metro', 'hora', 'kg', 'litro']

/** S27: nueva cotización (`/cotizaciones/nueva`) o edición (`/cotizaciones/:id/editar`). */
export default function QuoteForm({ business }: { business: Business }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    if (!id) return { quote: undefined, items: [] as QuoteItem[] }
    const quote = await getQuote(id)
    return quote ? { quote, items: await getQuoteItems(id) } : null
  }, [id])

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null) {
    return (
      <section className="card">
        <h1>Cotización no encontrada</h1>
        <Link to="/cotizaciones" className="btn primary">Volver a cotizaciones</Link>
      </section>
    )
  }
  if (data.quote?.status === 'converted') {
    return (
      <section className="card">
        <h1>Ya se convirtió en venta</h1>
        <p className="muted">Una cotización convertida ya no se puede editar.</p>
        <Link to={`/cotizaciones/${data.quote.id}`} className="btn primary">Volver a la cotización</Link>
      </section>
    )
  }
  return <Editor key={id ?? 'nueva'} business={business} quote={data.quote} oldItems={data.items} />
}

function Editor({ business, quote, oldItems }: { business: Business; quote?: Quote; oldItems: QuoteItem[] }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(quote?.title ?? '')
  const [contactId, setContactId] = useState(quote?.contactId ?? '')
  const [newContact, setNewContact] = useState('')
  const [validUntil, setValidUntil] = useState(() => quote?.validUntil ?? addDays(dayKey(Date.now(), business.timezone), DEFAULT_VALIDITY_DAYS))
  const [lines, setLines] = useState<Line[]>(
    oldItems.map((i) => ({ key: i.id, productId: i.productId, name: i.name, unit: i.unit, qty: String(i.quantity), price: centsToInput(i.unitPriceCents) })),
  )
  const [search, setSearch] = useState('')
  const [tax, setTax] = useState(quote ? quote.taxRate > 0 : false)
  const [rate, setRate] = useState(quote && quote.taxRate > 0 ? String(quote.taxRate) : '16')
  const [notes, setNotes] = useState(quote?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const products = useLiveQuery(() => listProducts(business.id), [business.id]) ?? []
  const matches = useLiveQuery(() => listProducts(business.id, { search }), [business.id, search]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)

  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  function addProduct(p: { id: string; name: string; priceCents: number }) {
    setLines((prev) => {
      const same = prev.find((l) => l.productId === p.id)
      if (same) return prev.map((l) => (l === same ? { ...l, qty: String((parseQuantity(l.qty) ?? 0) + 1) } : l))
      return [...prev, { key: crypto.randomUUID(), productId: p.id, name: p.name, unit: DEFAULT_UNIT, qty: '1', price: centsToInput(p.priceCents) }]
    })
    setSearch('')
  }
  const addFree = () => setLines((prev) => [...prev, { key: crypto.randomUUID(), name: '', unit: DEFAULT_UNIT, qty: '1', price: '' }])

  async function onSearchEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const hit = (await findByBarcode(business.id, search)) ?? (matches.length === 1 ? matches[0] : undefined)
    if (hit) addProduct(hit)
  }

  const parsed = lines.map((l) => ({ qty: parseQuantity(l.qty), price: l.price.trim() ? parseMoney(l.price) : 0 }))
  const taxRate = tax ? Number(rate.replace(',', '.')) : 0
  const totals = quoteTotals(
    lines.flatMap((_l, i) => (parsed[i].qty && parsed[i].price !== null ? [{ quantity: parsed[i].qty!, unitPriceCents: parsed[i].price! }] : [])),
    Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100 ? taxRate : 0,
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (lines.length === 0) return setError('Agrega al menos un artículo')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (!l.name.trim()) return setError('Cada artículo necesita un nombre')
      if (!parsed[i].qty) return setError(`La cantidad de "${l.name}" debe ser mayor que cero`)
      if (parsed[i].price === null) return setError(`El precio de "${l.name}" no es válido`)
    }
    if (tax && !(Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100)) return setError('El IVA debe estar entre 0 y 100 %')
    setSaving(true)
    try {
      const customer = await resolveContactId(business.id, 'customer', contactId, newContact)
      const input = {
        title, contactId: customer, validUntil, taxRate, notes,
        items: lines.map((l, i) => ({ productId: l.productId, name: l.name, unit: l.unit, quantity: parsed[i].qty!, unitPriceCents: parsed[i].price! })),
      }
      const saved = quote ? await updateQuote(quote.id, input) : await createQuote(business.id, input)
      navigate(`/cotizaciones/${saved.id}`, { replace: true, state: { nueva: !quote } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={quote ? `/cotizaciones/${quote.id}` : '/cotizaciones'} className="back" aria-label="Volver">←</Link>
        <h1 className="grow">{quote ? `Editar cotización #${quote.number}` : 'Nueva cotización'}</h1>
      </section>

      <form onSubmit={submit} className="card form" noValidate>
        <label>
          Título (opcional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Cocina integral" />
        </label>
        <ContactSelect businessId={business.id} type="customer" value={contactId} onChange={setContactId} newName={newContact} onNewName={setNewContact} />
        <label>
          Vigencia hasta
          <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>

        <h2>Artículos</h2>
        <label>
          Buscar en el inventario
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => void onSearchEnter(e)} placeholder="Nombre o código de barras" />
        </label>
        {search.trim() && (
          <ul className="picker">
            {matches.length === 0 && <li className="muted">Ningún producto coincide.</li>}
            {matches.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => addProduct(p)}>
                  <span>{p.name}</span>
                  <small className="muted">{money(p.priceCents)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn ghost small" onClick={addFree}>+ Artículo sin inventario</button>
        {products.length === 0 && <p className="muted">Tus productos del inventario aparecerán aquí. Mientras, usa «Artículo sin inventario».</p>}

        {lines.length > 0 && (
          <ul className="cart">
            {lines.map((l, i) => (
              <li key={l.key}>
                <div className="row-between">
                  <input className="grow" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Nombre del artículo" aria-label="Nombre del artículo" />
                  <button type="button" className="photo-remove static" aria-label={`Quitar ${l.name || 'artículo'}`} onClick={() => setLines(lines.filter((x) => x !== l))}>×</button>
                </div>
                <div className="three">
                  <label>
                    Cantidad
                    <input value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} inputMode="decimal" aria-label={`Cantidad de ${l.name || 'artículo'}`} />
                  </label>
                  <label>
                    Unidad
                    <input value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} list="units" aria-label={`Unidad de ${l.name || 'artículo'}`} />
                  </label>
                  <label>
                    Precio
                    <input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label={`Precio de ${l.name || 'artículo'}`} />
                  </label>
                </div>
                {parsed[i].qty && parsed[i].price !== null && <p className="muted line-total">Importe {money(lineTotal(parsed[i].qty!, parsed[i].price!))}</p>}
              </li>
            ))}
          </ul>
        )}
        <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>

        <label className="check">
          <input type="checkbox" checked={tax} onChange={(e) => setTax(e.target.checked)} />
          Agregar IVA
        </label>
        {tax && (
          <label>
            Tasa de IVA (%)
            <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" aria-label="Tasa de IVA" />
          </label>
        )}

        <label>
          Notas y condiciones
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ej. Anticipo del 50 %. Entrega en 4 semanas." />
        </label>

        <div className="totals" aria-label="Totales">
          {tax && <p className="total-line"><span>Subtotal</span><span>{money(totals.subtotalCents)}</span></p>}
          {tax && <p className="total-line"><span>IVA {Number.isFinite(taxRate) ? taxRate : 0}%</span><span>{money(totals.taxCents)}</span></p>}
          <p className="total-line"><span>Total</span><strong>{money(totals.totalCents)}</strong></p>
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : quote ? 'Guardar cambios' : 'Crear cotización'}</button>
      </form>
    </>
  )
}
