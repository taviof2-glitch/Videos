import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney, parseMoney } from '../data/money'
import { findByBarcode, listProducts } from '../data/products'
import { formatQuantity, parseQuantity } from '../data/quantity'
import { autoConcept, createSale, getItems, getTransaction, lineNet, updateSale, type ItemInput } from '../data/transactions'
import type { Business, PaymentMethod, Transaction, TransactionItem } from '../data/types'
import ContactSelect from '../ui/ContactSelect'
import CreditFields from '../ui/CreditFields'
import { METHODS, fromLocalInput, resolveContactId, toLocalInput } from '../ui/forms'

type Line = { key: string; productId?: string; name: string; qty: string; price: string; unitCostCents?: number; discountCents?: number }

const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')

/** S04: nueva venta (`/venta/nueva`) o edición (`/venta/:id/editar`). */
export default function SaleForm({ business }: { business: Business }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    if (!id) return { sale: undefined, items: [] as TransactionItem[] }
    const sale = await getTransaction(id)
    return sale && sale.type === 'sale' ? { sale, items: await getItems(id) } : null
  }, [id])

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null) {
    return (
      <section className="card">
        <h1>Venta no encontrada</h1>
        <Link to="/balance" className="btn primary">Volver a movimientos</Link>
      </section>
    )
  }
  return <Editor key={id ?? 'nueva'} business={business} sale={data.sale} oldItems={data.items} />
}

function Editor({ business, sale, oldItems }: { business: Business; sale?: Transaction; oldItems: TransactionItem[] }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'quick' | 'cart'>(oldItems.length > 0 ? 'cart' : 'quick')
  const [amount, setAmount] = useState(sale && oldItems.length === 0 ? centsToInput(sale.amountCents) : '')
  // En ventas con productos solo se rellena si el concepto lo escribió el usuario (no el automático),
  // para que el automático siga a los productos al editar.
  const [concept, setConcept] = useState(sale && sale.concept !== autoConcept(oldItems) ? sale.concept : '')
  const [lines, setLines] = useState<Line[]>(
    oldItems.map((i) => ({
      key: i.id,
      productId: i.productId,
      name: i.name,
      qty: String(i.quantity),
      price: centsToInput(i.unitPriceCents),
      unitCostCents: i.unitCostCents,
      discountCents: i.discountCents,
    })),
  )
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<PaymentMethod>(sale?.paymentMethod ?? 'cash')
  const [contactId, setContactId] = useState(sale?.contactId ?? '')
  const [newContact, setNewContact] = useState('')
  const [credit, setCredit] = useState(sale?.status === 'credit')
  const [due, setDue] = useState(sale?.dueDate ?? '')
  const [date, setDate] = useState(() => toLocalInput(sale?.date ?? new Date().toISOString()))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const products = useLiveQuery(() => listProducts(business.id), [business.id]) ?? []
  const matches = useLiveQuery(() => listProducts(business.id, { search }), [business.id, search]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)

  // Al editar, lo que ya se había descontado de cada producto vuelve a estar disponible.
  const returned = new Map<string, number>()
  for (const i of oldItems) if (i.productId) returned.set(i.productId, (returned.get(i.productId) ?? 0) + i.quantity)
  const stockOf = (productId?: string) => {
    const p = products.find((x) => x.id === productId)
    return p ? p.stock + (returned.get(p.id) ?? 0) : undefined
  }

  function addProduct(p: { id: string; name: string; priceCents: number }) {
    setLines((prev) => {
      const same = prev.find((l) => l.productId === p.id)
      if (same) return prev.map((l) => (l === same ? { ...l, qty: String((parseQuantity(l.qty) ?? 0) + 1) } : l))
      return [...prev, { key: crypto.randomUUID(), productId: p.id, name: p.name, qty: '1', price: centsToInput(p.priceCents) }]
    })
    setSearch('')
  }

  // Enter en el buscador: un lector de código de barras "teclea" el código y pulsa Enter.
  async function onSearchEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const hit = (await findByBarcode(business.id, search)) ?? (matches.length === 1 ? matches[0] : undefined)
    if (hit) addProduct(hit)
  }

  const parsed = lines.map((l) => ({ qty: parseQuantity(l.qty), price: l.price.trim() ? parseMoney(l.price) : 0 }))
  const total = lines.reduce((sum, _l, i) => {
    const { qty, price } = parsed[i]
    return qty && price !== null ? sum + lineNet({ quantity: qty, unitPriceCents: price, discountCents: lines[i].discountCents }) : sum
  }, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let input
    if (mode === 'quick') {
      const cents = parseMoney(amount)
      if (!cents) return setError('Escribe el monto de la venta')
      input = { amountCents: cents, concept }
    } else {
      if (lines.length === 0) return setError('Agrega al menos un producto')
      const items: ItemInput[] = []
      for (let i = 0; i < lines.length; i++) {
        const { qty, price } = parsed[i]
        if (!qty) return setError(`La cantidad de "${lines[i].name}" debe ser mayor que cero`)
        if (price === null) return setError(`El precio de "${lines[i].name}" no es válido`)
        items.push({ productId: lines[i].productId, name: lines[i].name, quantity: qty, unitPriceCents: price, unitCostCents: lines[i].unitCostCents, discountCents: lines[i].discountCents })
      }
      input = { items, concept }
    }
    const when = fromLocalInput(date)
    if (!when) return setError('La fecha no es válida')

    setSaving(true)
    try {
      const customer = await resolveContactId(business.id, 'customer', contactId, newContact)
      const full = { ...input, paymentMethod: method, date: when, contactId: customer, credit, dueDate: credit ? due : undefined }
      const saved = sale ? await updateSale(sale.id, full) : await createSale(business.id, full)
      // Una venta nueva abre el comprobante (S05); al editar se vuelve al detalle.
      if (sale) navigate(`/venta/${saved.id}`, { replace: true })
      else navigate(`/venta/${saved.id}/comprobante`, { replace: true, state: { nueva: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={sale ? `/venta/${sale.id}` : '/balance'} className="back" aria-label="Volver">←</Link>
        <h1 className="grow">{sale ? 'Editar venta' : 'Nueva venta'}</h1>
      </section>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'quick'} className={`tab-btn ${mode === 'quick' ? 'on' : ''}`} onClick={() => setMode('quick')}>
          Venta rápida
        </button>
        <button type="button" role="tab" aria-selected={mode === 'cart'} className={`tab-btn ${mode === 'cart' ? 'on' : ''}`} onClick={() => setMode('cart')}>
          Con productos
        </button>
      </div>

      <form onSubmit={submit} className="card form" noValidate>
        {mode === 'quick' ? (
          <>
            <label>
              Monto *
              <input className="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" autoFocus={!sale} />
            </label>
            <label>
              Concepto
              <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Reparación de puerta" />
            </label>
          </>
        ) : (
          <>
            <label>
              Agregar producto
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => void onSearchEnter(e)}
                placeholder="Buscar por nombre o código"
                autoFocus={!sale}
              />
            </label>
            {products.length === 0 && (
              <p className="muted">Aún no tienes productos. <Link to="/inventario/nuevo">Crea uno</Link> o usa la venta rápida.</p>
            )}
            {search.trim() && (
              <ul className="picker">
                {matches.length === 0 && <li className="muted">Ningún producto coincide.</li>}
                {matches.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => addProduct(p)}>
                      <span>{p.name}</span>
                      <small className="muted">{money(p.priceCents)} · {formatQuantity(p.stock)} disp.</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {lines.length > 0 && (
              <ul className="cart">
                {lines.map((l, i) => {
                  const available = stockOf(l.productId)
                  const qty = parsed[i].qty
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
                          Precio
                          <input value={l.price} onChange={(e) => setLines(lines.map((x) => (x === l ? { ...x, price: e.target.value } : x)))} inputMode="decimal" aria-label={`Precio de ${l.name}`} />
                        </label>
                      </div>
                      {l.discountCents ? (
                        <p className="warn">
                          Descuento de {money(l.discountCents)} (venía de una cotización).{' '}
                          <button type="button" className="link" onClick={() => setLines(lines.map((x) => (x === l ? { ...x, discountCents: undefined } : x)))}>Quitar</button>
                        </p>
                      ) : null}
                      {available !== undefined && qty !== null && qty > available && (
                        <p className="warn">⚠️ Solo hay {formatQuantity(Math.max(available, 0))} en inventario. Puedes guardar igual.</p>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            <label>
              Concepto (opcional)
              <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Si lo dejas vacío se usan los productos" />
            </label>
            <p className="total-line">Total <strong>{money(total)}</strong></p>
          </>
        )}

        <CreditFields credit={credit} onCredit={setCredit} due={due} onDue={setDue} creditLabel="Fiado" contactWord="un cliente" />
        {!credit && (
          <label>
            Método de pago
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        )}
        <ContactSelect businessId={business.id} type="customer" value={contactId} onChange={setContactId} newName={newContact} onNewName={setNewContact} />
        <label>
          Fecha y hora
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn sale" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : sale ? 'Guardar cambios' : credit ? 'Registrar fiado' : mode === 'cart' ? `Cobrar ${money(total)}` : 'Registrar venta'}
        </button>
      </form>
    </>
  )
}
