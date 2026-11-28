import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { formatMoney, parseMoney } from '../data/money'
import { formatQuantity, parseQuantity } from '../data/quantity'
import type { Business, Product, ProductVariant } from '../data/types'
import { ATTR_PRESETS, hasKnownFactors, suggestedPrice, variantFactor, WOODS } from '../data/woods'
import { cleanAttributes, listVariants, removeVariants, setVariantAttributes, updateVariant, variantCombos } from '../data/variants'

type AttrRow = { name: string; values: string }
const toAttrs = (rows: AttrRow[]) => rows.map((r) => ({ name: r.name, values: r.values.split(',') }))
const centsToInput = (c?: number) => (c === undefined ? '' : (c / 100).toFixed(2))

/** Pestaña «Variantes» de un producto: atributos, combinaciones y los datos de cada una. */
export default function ProductVariants({ business, product }: { business: Business; product: Product }) {
  const variants = useLiveQuery(() => listVariants(product.id), [product.id])
  const [rows, setRows] = useState<AttrRow[]>(() => product.variantAttributes?.map((a) => ({ name: a.name, values: a.values.join(', ') })) ?? [{ name: '', values: '' }])
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)

  let preview = ''
  try {
    const n = variantCombos(cleanAttributes(toAttrs(rows))).length
    preview = n === 1 ? '1 variante' : `${n} variantes`
  } catch {
    preview = ''
  }

  async function generate() {
    setBusy(true)
    setMessage(undefined)
    try {
      const r = await setVariantAttributes(product.id, toAttrs(rows))
      const parts = [r.created ? `${r.created} nuevas` : '', r.removed ? `${r.removed} quitadas` : ''].filter(Boolean)
      setMessage({
        ok: true,
        text: `Variantes listas${parts.length ? ` (${parts.join(', ')})` : ''}.${r.movedStock ? ` Las ${formatQuantity(r.movedStock)} piezas que tenía el producto quedaron en la primera variante: repártelas abajo.` : ''}`,
      })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudieron crear las variantes' })
    }
    setBusy(false)
  }

  async function remove() {
    setMessage(undefined)
    try {
      await removeVariants(product.id)
      setRows([{ name: '', values: '' }])
      setMessage({ ok: true, text: 'El producto ya no tiene variantes.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudieron quitar' })
    }
    setConfirmRemove(false)
  }

  return (
    <>
      <section className="card form">
        <h2>Atributos</h2>
        <p className="muted">Por ejemplo <strong>Acabado</strong>: Natural, Nogal y <strong>Tamaño</strong>: Chico, Grande. Se crea una variante por combinación, cada una con su stock.</p>
        {rows.map((r, i) => (
          <div key={i} className="attr-row">
            <label>
              Atributo {i + 1}
              <input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={i === 0 ? 'Ej. Acabado' : 'Ej. Tamaño'} />
            </label>
            <label>
              Valores, separados por coma
              <input value={r.values} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} placeholder={i === 0 ? 'Natural, Nogal' : 'Chico, Grande'} />
            </label>
            {rows.length > 1 && (
              <button type="button" className="btn danger-text small" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Quitar atributo</button>
            )}
          </div>
        ))}
        {rows.length < 2 && <button type="button" className="btn ghost small" onClick={() => setRows([...rows, { name: '', values: '' }])}>+ Otro atributo</button>}
        <div className="chips wrap" aria-label="Atajos">
          {ATTR_PRESETS.filter((p) => !rows.some((r) => r.name.trim().toLowerCase() === p.name.toLowerCase())).map((p) => (
            <button key={p.name} type="button" className="chip" disabled={rows.every((r) => r.name.trim()) && rows.length >= 2} onClick={() => {
              const row = { name: p.name, values: p.values.join(', ') }
              const empty = rows.findIndex((r) => !r.name.trim() && !r.values.trim())
              setRows(empty >= 0 ? rows.map((r, j) => (j === empty ? row : r)) : [...rows, row].slice(0, 2))
            }}>+ {p.label}</button>
          ))}
        </div>
        {rows.some((r) => /madera/i.test(r.name)) && <small className="muted">Maderas que conozco (puedes escribir otras): {WOODS.map(([n]) => n).join(', ')}.</small>}
        <button type="button" className="btn primary" disabled={busy} onClick={() => void generate()}>
          {product.hasVariants ? 'Actualizar variantes' : 'Crear variantes'}{preview ? ` (${preview})` : ''}
        </button>
        {message && <p className={message.ok ? 'success-text' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
      </section>

      {product.hasVariants && variants && (
        <section className="card">
          <h2>Variantes · {formatQuantity(product.stock)} en total</h2>
          {variants.some((v) => hasKnownFactors(v.values)) && product.priceCents > 0 && (
            <div className="note-box">
              <p style={{ margin: 0 }}>Precios sugeridos a partir de {formatMoney(product.priceCents, business.currency)} (pino, mediana): {variants.map((v) => `${v.name} ${formatMoney(suggestedPrice(product.priceCents, v.values), business.currency)}`).join(' · ')}</p>
              <button type="button" className="btn primary small" style={{ marginTop: 8 }} disabled={busy} onClick={() => {
                setBusy(true)
                void Promise.all(variants.map((v) => updateVariant(v.id, { priceCents: variantFactor(v.values) === 1 ? null : suggestedPrice(product.priceCents, v.values) })))
                  .then(() => setMessage({ ok: true, text: 'Precios puestos. Cámbialos abajo si alguno no te cuadra.' }), (e) => setMessage({ ok: false, text: e instanceof Error ? e.message : 'No se pudieron poner' }))
                  .finally(() => setBusy(false))
              }}>Poner estos precios</button>
            </div>
          )}
          <ul className="variant-list">
            {variants.map((v) => (
              <VariantRow key={`${v.id}-${v.updatedAt}`} variant={v} product={product} currency={business.currency} />
            ))}
          </ul>
        </section>
      )}

      {product.hasVariants &&
        (confirmRemove ? (
          <section className="card confirm">
            <p>¿Quitar todas las variantes? Solo se puede si todas están en 0; el producto vuelve a llevar un solo stock.</p>
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => setConfirmRemove(false)}>Cancelar</button>
              <button type="button" className="btn expense" onClick={() => void remove()}>Sí, quitar</button>
            </div>
          </section>
        ) : (
          <button type="button" className="btn danger-text" onClick={() => setConfirmRemove(true)}>Quitar variantes</button>
        ))}
    </>
  )
}

function VariantRow({ variant: v, product, currency }: { variant: ProductVariant; product: Product; currency: string }) {
  const [stock, setStock] = useState(String(v.stock))
  const [min, setMin] = useState(v.minStock ? String(v.minStock) : '')
  const [price, setPrice] = useState(centsToInput(v.priceCents))
  const [cost, setCost] = useState(centsToInput(v.costCents))
  const [barcode, setBarcode] = useState(v.barcode)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const label = v.name

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const keepNegative = v.stock < 0 && stock === String(v.stock)
    const stockQty = keepNegative ? v.stock : parseQuantity(stock)
    const minQty = min.trim() ? parseQuantity(min) : 0
    const priceCents = price.trim() ? parseMoney(price) : null
    const costCents = cost.trim() ? parseMoney(cost) : null
    if (stockQty === null) return setError('La cantidad debe ser un número (0 o más)')
    if (minQty === null) return setError('La cantidad mínima debe ser un número (0 o más)')
    if (price.trim() && priceCents === null) return setError('El precio no es válido')
    if (cost.trim() && costCents === null) return setError('El costo no es válido')
    try {
      await updateVariant(v.id, { stock: stockQty, minStock: minQty, priceCents, costCents, barcode })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  return (
    <li>
      <form onSubmit={save} className="form" noValidate aria-label={`Variante ${label}`}>
        <strong>{label}</strong>
        <div className="two">
          <label>
            Existencias
            <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" aria-label={`Existencias de ${label}`} />
          </label>
          <label>
            Mínimo
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="0" aria-label={`Mínimo de ${label}`} />
          </label>
        </div>
        <div className="two">
          <label>
            Precio
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder={`${formatMoney(product.priceCents, currency)} (del producto)`} aria-label={`Precio de ${label}`} />
          </label>
          <label>
            Costo
            <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder={`${formatMoney(product.costCents, currency)} (del producto)`} aria-label={`Costo de ${label}`} />
          </label>
        </div>
        <label>
          Código de barras
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Opcional" aria-label={`Código de ${label}`} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-between">
          <small className={saved ? 'success-text' : 'muted'}>{saved ? '✓ Guardado' : 'Precio y costo vacíos = los del producto'}</small>
          <button type="submit" className="btn ghost small">Guardar</button>
        </div>
      </form>
    </li>
  )
}
