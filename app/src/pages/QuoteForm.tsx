import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { docNumber } from '../data/folio'
import { addDays, dayKey } from '../data/dates'
import { formatMoney, parseMoney } from '../data/money'
import { findByCode, listProducts } from '../data/products'
import { optionKey, productOptions, toOption, type ProductOption } from '../ui/productOptions'
import { formatQuantity, parseQuantity } from '../data/quantity'
import { DEFAULT_UNIT, DEFAULT_VALIDITY_DAYS, billedQuantity, createQuote, getQuote, getQuoteItems, quoteLineNet, quoteTotals, updateQuote } from '../data/quotes'
import type { Business, Quote, QuoteItem } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import { resolveContactId } from '../ui/forms'
import { ChevronLeft } from 'lucide-react'

type Line = {
  key: string
  productId?: string
  variantId?: string
  name: string
  unit: string
  qty: string
  price: string
  /** 'area': ancho × alto × piezas, precio por m². Solo en artículos sin inventario. */
  mode: 'unit' | 'area'
  width: string
  height: string
  discType: 'percent' | 'amount'
  disc: string
}
const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')
const UNITS = ['pieza', 'juego', 'servicio', 'metro', 'hora', 'kg', 'litro']
const newLine = (patch: Partial<Line>): Line => ({
  key: crypto.randomUUID(), name: '', unit: DEFAULT_UNIT, qty: '1', price: '', mode: 'unit', width: '', height: '', discType: 'percent', disc: '', ...patch,
})

/** Lo que se ha escrito en una línea, ya interpretado (null = hay un campo inválido). */
function readLine(l: Line) {
  const qty = parseQuantity(l.qty)
  const price = l.price.trim() ? parseMoney(l.price) : 0
  const width = l.mode === 'area' ? parseQuantity(l.width) : undefined
  const height = l.mode === 'area' ? parseQuantity(l.height) : undefined
  let discount: { type: 'percent' | 'amount'; value: number } | undefined
  let discountOk = true
  if (l.disc.trim()) {
    const value = l.discType === 'percent' ? parseQuantity(l.disc) : parseMoney(l.disc)
    if (value === null) discountOk = false
    else if (value > 0) discount = { type: l.discType, value }
  }
  return { qty, price, width, height, discount, discountOk }
}

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
    oldItems.map((i) =>
      newLine({
        key: i.id, productId: i.productId, variantId: i.variantId, name: i.name, unit: i.unit, qty: String(i.quantity), price: centsToInput(i.unitPriceCents),
        mode: i.width && i.height ? 'area' : 'unit', width: i.width ? String(i.width) : '', height: i.height ? String(i.height) : '',
        discType: i.discountType ?? 'percent',
        disc: i.discountValue ? (i.discountType === 'amount' ? centsToInput(i.discountValue) : String(i.discountValue)) : '',
      }),
    ),
  )
  const [search, setSearch] = useState('')
  const [tax, setTax] = useState(quote ? quote.taxRate > 0 : false)
  const [rate, setRate] = useState(quote && quote.taxRate > 0 ? String(quote.taxRate) : '16')
  const [advance, setAdvance] = useState(quote?.advanceCents ? centsToInput(quote.advanceCents) : '')
  const [payBy, setPayBy] = useState(quote?.payBy ?? '')
  const [notes, setNotes] = useState(quote?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const products = useLiveQuery(() => listProducts(business.id), [business.id]) ?? []
  const matches = useLiveQuery(() => listProducts(business.id, { search }), [business.id, search]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)

  const update = (key: string, patch: Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  function addProduct(o: ProductOption) {
    setLines((prev) => {
      const same = prev.find((l) => l.productId && optionKey(l.productId, l.variantId) === o.key)
      if (same) return prev.map((l) => (l === same ? { ...l, qty: String((parseQuantity(l.qty) ?? 0) + 1) } : l))
      return [...prev, newLine({ productId: o.productId, variantId: o.variantId, name: o.name, price: centsToInput(o.priceCents) })]
    })
    setSearch('')
  }
  const addFree = () => setLines((prev) => [...prev, newLine({})])

  async function onSearchEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = await findByCode(business.id, search)
    if (code && (!code.product.hasVariants || code.variant)) return addProduct(toOption(code.product, code.variant))
    if (code) return setSearch(code.product.name)
    const found = productOptions(matches, search)
    if (found.length === 1) addProduct(found[0])
  }

  const read = lines.map(readLine)
  const taxRate = tax ? Number(rate.replace(',', '.')) : 0
  const taxOk = Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100
  const priced = lines.flatMap((_l, i) => {
    const r = read[i]
    if (!r.qty || r.price === null || !r.discountOk) return []
    return [{ quantity: r.qty, unitPriceCents: r.price, width: r.width ?? undefined, height: r.height ?? undefined, discountType: r.discount?.type, discountValue: r.discount?.value }]
  })
  const totals = quoteTotals(priced, taxOk ? taxRate : 0)
  const advanceCents = advance.trim() ? parseMoney(advance) : 0
  const lineNetOf = (i: number) => {
    const r = read[i]
    if (!r.qty || r.price === null || !r.discountOk) return undefined
    return quoteLineNet({ quantity: r.qty, unitPriceCents: r.price, width: r.width ?? undefined, height: r.height ?? undefined, discountType: r.discount?.type, discountValue: r.discount?.value })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (lines.length === 0) return setError('Agrega al menos un artículo')
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const r = read[i]
      if (!l.name.trim()) return setError('Cada artículo necesita un nombre')
      if (!r.qty) return setError(`La cantidad de "${l.name}" debe ser mayor que cero`)
      if (l.mode === 'area' && (!r.width || !r.height)) return setError(`Escribe el ancho y el alto de "${l.name}" en metros`)
      if (r.price === null) return setError(`El precio de "${l.name}" no es válido`)
      if (!r.discountOk) return setError(`El descuento de "${l.name}" no es válido`)
    }
    if (tax && !taxOk) return setError('El IVA debe estar entre 0 y 100 %')
    if (advanceCents === null) return setError('El anticipo no es válido')
    setSaving(true)
    try {
      const customer = await resolveContactId(business.id, 'customer', contactId, newContact, setContactId)
      const input = {
        title, contactId: customer, validUntil, taxRate, notes, advanceCents, payBy,
        items: lines.map((l, i) => ({
          productId: l.productId, variantId: l.variantId, name: l.name, unit: l.unit, quantity: read[i].qty!, unitPriceCents: read[i].price!,
          discount: read[i].discount, width: read[i].width ?? undefined, height: read[i].height ?? undefined,
        })),
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
        <Link to={quote ? `/cotizaciones/${quote.id}` : '/cotizaciones'} className="back" aria-label="Volver"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">{quote ? `Editar cotización ${docNumber(quote)}` : 'Nueva cotización'}</h1>
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
            {productOptions(matches, search).slice(0, 8).map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => addProduct(o)}>
                  <span>{o.label}</span>
                  <small className="muted">{money(o.priceCents)}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn ghost small" onClick={addFree}>+ Artículo sin inventario</button>
        {products.length === 0 && <p className="muted">Tus productos del inventario aparecerán aquí. Mientras, usa «Artículo sin inventario».</p>}

        {lines.length > 0 && (
          <ul className="cart">
            {lines.map((l, i) => {
              const net = lineNetOf(i)
              const label = l.name || 'artículo'
              return (
                <li key={l.key}>
                  <div className="row-between">
                    <input className="grow" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Nombre del artículo" aria-label="Nombre del artículo" />
                    <button type="button" className="photo-remove static" aria-label={`Quitar ${label}`} onClick={() => setLines(lines.filter((x) => x !== l))}>×</button>
                  </div>
                  {!l.productId && (
                    <div className="chips" role="group" aria-label={`Cómo se cobra ${label}`}>
                      <button type="button" className={`chip ${l.mode === 'unit' ? 'on' : ''}`} onClick={() => update(l.key, { mode: 'unit' })}>Por pieza</button>
                      <button type="button" className={`chip ${l.mode === 'area' ? 'on' : ''}`} onClick={() => update(l.key, { mode: 'area' })}>Por área (m²)</button>
                    </div>
                  )}
                  {l.mode === 'area' ? (
                    <>
                      <div className="three">
                        <label>
                          Ancho (m)
                          <input value={l.width} onChange={(e) => update(l.key, { width: e.target.value })} inputMode="decimal" aria-label={`Ancho de ${label}`} />
                        </label>
                        <label>
                          Alto (m)
                          <input value={l.height} onChange={(e) => update(l.key, { height: e.target.value })} inputMode="decimal" aria-label={`Alto de ${label}`} />
                        </label>
                        <label>
                          Piezas
                          <input value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} inputMode="decimal" aria-label={`Piezas de ${label}`} />
                        </label>
                      </div>
                      <label>
                        Precio por m²
                        <input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label={`Precio de ${label}`} />
                      </label>
                      {read[i].width && read[i].height && read[i].qty ? (
                        <p className="muted line-total">{formatQuantity(billedQuantity({ quantity: read[i].qty!, unitPriceCents: 0, width: read[i].width!, height: read[i].height! }))} m² en total</p>
                      ) : null}
                    </>
                  ) : (
                    <div className="three">
                      <label>
                        Cantidad
                        <input value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} inputMode="decimal" aria-label={`Cantidad de ${label}`} />
                      </label>
                      <label>
                        Unidad
                        <input value={l.unit} onChange={(e) => update(l.key, { unit: e.target.value })} list="units" aria-label={`Unidad de ${label}`} />
                      </label>
                      <label>
                        Precio
                        <input value={l.price} onChange={(e) => update(l.key, { price: e.target.value })} inputMode="decimal" placeholder="0.00" aria-label={`Precio de ${label}`} />
                      </label>
                    </div>
                  )}
                  <div className="discount">
                    <label>
                      Descuento
                      <select value={l.discType} onChange={(e) => update(l.key, { discType: e.target.value as Line['discType'] })} aria-label={`Tipo de descuento de ${label}`}>
                        <option value="percent">%</option>
                        <option value="amount">{business.currency === 'MXN' ? '$' : 'monto'}</option>
                      </select>
                    </label>
                    <input value={l.disc} onChange={(e) => update(l.key, { disc: e.target.value })} inputMode="decimal" placeholder="0" aria-label={`Descuento de ${label}`} />
                  </div>
                  {net !== undefined && <p className="muted line-total">Importe {money(net)}</p>}
                </li>
              )
            })}
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

        <h2>Condiciones de pago</h2>
        <label>
          Anticipo (opcional)
          <input value={advance} onChange={(e) => setAdvance(e.target.value)} inputMode="decimal" placeholder="0.00" aria-label="Anticipo" />
        </label>
        <div className="chips" role="group" aria-label="Anticipo rápido">
          {[30, 50].map((pct) => (
            <button key={pct} type="button" className="chip" onClick={() => setAdvance(centsToInput(Math.round((totals.totalCents * pct) / 100)))}>
              {pct} % del total
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setAdvance('')}>Sin anticipo</button>
        </div>
        <label>
          Fecha estimada de pago (opcional)
          <input type="date" value={payBy} onChange={(e) => setPayBy(e.target.value)} />
        </label>

        <label>
          Notas y condiciones
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Ej. Entrega en 4 semanas." />
        </label>

        <div className="totals" aria-label="Totales">
          {totals.discountCents > 0 && <p className="total-line"><span>Importe</span><span>{money(totals.grossCents)}</span></p>}
          {totals.discountCents > 0 && <p className="total-line"><span>Descuentos</span><span>−{money(totals.discountCents)}</span></p>}
          {tax && <p className="total-line"><span>Subtotal</span><span>{money(totals.subtotalCents)}</span></p>}
          {tax && <p className="total-line"><span>IVA {taxOk ? taxRate : 0}%</span><span>{money(totals.taxCents)}</span></p>}
          <p className="total-line"><span>Total</span><strong>{money(totals.totalCents)}</strong></p>
          {!!advanceCents && advanceCents <= totals.totalCents && <p className="total-line"><span>Saldo tras el anticipo</span><span>{money(totals.totalCents - advanceCents)}</span></p>}
        </div>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : quote ? 'Guardar cambios' : 'Crear cotización'}</button>
      </form>
    </>
  )
}
