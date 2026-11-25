import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatMoney, parseMoney } from '../data/money'
import { createOrder, getOrder, getOrderItems, updateOrder } from '../data/orders'
import { findByCode, listProducts } from '../data/products'
import { formatQuantity, parseQuantity } from '../data/quantity'
import { lineTotal } from '../data/transactions'
import type { Business, Order, OrderItem } from '../data/types'
import { optionKey, productOptions, toOption, type ProductOption } from '../ui/productOptions'

type Line = { key: string; productId: string; variantId?: string; name: string; qty: string; price: string }
const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')

/** Nuevo pedido (`/pedidos/nuevo`) o edición (`/pedidos/:id/editar`). */
export default function OrderForm({ business }: { business: Business }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    if (!id) return { order: undefined, items: [] as OrderItem[] }
    const order = await getOrder(id)
    return order ? { order, items: await getOrderItems(id) } : null
  }, [id])
  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null || (data.order && data.order.status !== 'pending' && data.order.status !== 'processing')) {
    return (
      <section className="card">
        <h1>{data === null ? 'Pedido no encontrado' : 'Este pedido ya no se puede editar'}</h1>
        {data !== null && <p className="muted">Solo se editan los pedidos abiertos. Cancélalo o reábrelo desde su detalle.</p>}
        <Link to={data?.order ? `/pedidos/${data.order.id}` : '/pedidos'} className="btn primary">Volver</Link>
      </section>
    )
  }
  return <Editor key={id ?? 'nuevo'} business={business} order={data.order} oldItems={data.items} />
}

function Editor({ business, order, oldItems }: { business: Business; order?: Order; oldItems: OrderItem[] }) {
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(order?.customerName ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(oldItems.map((i) => ({ key: i.id, productId: i.productId, variantId: i.variantId, name: i.name, qty: String(i.quantity), price: centsToInput(i.unitPriceCents) })))
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const matches = useLiveQuery(() => listProducts(business.id, { search }), [business.id, search]) ?? []
  const money = (c: number) => formatMoney(c, business.currency)

  function addProduct(o: ProductOption) {
    setError('')
    setLines((prev) => {
      const same = prev.find((l) => optionKey(l.productId, l.variantId) === o.key)
      if (same) return prev.map((l) => (l === same ? { ...l, qty: String((parseQuantity(l.qty) ?? 0) + 1) } : l))
      return [...prev, { key: crypto.randomUUID(), productId: o.productId, variantId: o.variantId, name: o.name, qty: '1', price: centsToInput(o.priceCents) }]
    })
    setSearch('')
  }

  async function onSearchEnter(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = await findByCode(business.id, search)
    if (code && (!code.product.hasVariants || code.variant)) return addProduct(toOption(code.product, code.variant))
    if (code) return setSearch(code.product.name)
    const found = productOptions(matches, search)
    if (found.length === 1) addProduct(found[0])
  }

  const parsed = lines.map((l) => ({ qty: parseQuantity(l.qty), price: l.price.trim() ? parseMoney(l.price) : 0 }))
  const total = lines.reduce((s, _l, i) => (parsed[i].qty && parsed[i].price !== null ? s + lineTotal(parsed[i].qty!, parsed[i].price!) : s), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (lines.length === 0) return setError('Agrega al menos un producto')
    for (let i = 0; i < lines.length; i++) {
      if (!parsed[i].qty) return setError(`La cantidad de "${lines[i].name}" debe ser mayor que cero`)
      if (parsed[i].price === null) return setError(`El precio de "${lines[i].name}" no es válido`)
    }
    setSaving(true)
    try {
      const input = { customerName: customer, notes, source: order?.source ?? ('manual' as const), items: lines.map((l, i) => ({ productId: l.productId, variantId: l.variantId, name: l.name, quantity: parsed[i].qty!, unitPriceCents: parsed[i].price! })) }
      const saved = order ? await updateOrder(order.id, input) : await createOrder(business.id, input)
      navigate(`/pedidos/${saved.id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={order ? `/pedidos/${order.id}` : '/pedidos'} className="back" aria-label="Volver">←</Link>
        <h1 className="grow">{order ? `Editar pedido #${order.number}` : 'Nuevo pedido'}</h1>
      </section>
      <form onSubmit={submit} className="card form" noValidate>
        <label>
          Nombre del cliente
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Ej. Olga Acevedo" />
        </label>
        <label>
          Agregar producto
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => void onSearchEnter(e)} placeholder="Nombre o código de barras" />
        </label>
        {search.trim() && (
          <ul className="picker">
            {matches.length === 0 && <li className="muted">Ningún producto coincide.</li>}
            {productOptions(matches, search).slice(0, 8).map((o) => (
              <li key={o.key}>
                <button type="button" onClick={() => addProduct(o)}>
                  <span>{o.label}</span>
                  <small className="muted">{money(o.priceCents)} · {formatQuantity(o.stock)} disp.</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {products?.length === 0 && <p className="muted">Primero crea productos en el <Link to="/inventario/nuevo">inventario</Link>.</p>}
        {lines.length > 0 && (
          <ul className="cart">
            {lines.map((l, i) => (
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
                {parsed[i].qty && parsed[i].price !== null && <p className="muted line-total">Importe {money(lineTotal(parsed[i].qty!, parsed[i].price!))}</p>}
              </li>
            ))}
          </ul>
        )}
        <label>
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Ej. Entregar el sábado en la tarde" />
        </label>
        <p className="total-line">Total <strong>{money(total)}</strong></p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : order ? 'Guardar cambios' : 'Crear pedido'}</button>
      </form>
    </>
  )
}
