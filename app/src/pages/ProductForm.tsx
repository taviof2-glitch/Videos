import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ensureCategory, listCategories } from '../data/categories'
import { formatMoney, parseMoney } from '../data/money'
import { MAX_PHOTOS, createProduct, deleteProduct, getProduct, stockHistory, updateProduct } from '../data/products'
import { formatQuantity, parseQuantity } from '../data/quantity'
import type { Business, Product, StockReason } from '../data/types'
import { variantNames } from '../data/variants'
import BarcodeScanner from '../ui/BarcodeScanner'
import ProductVariants from './ProductVariants'
import Thumb from '../ui/Thumb'
import { resizeImage } from '../ui/images'
import { canScan } from '../ui/scanner'

const NEW_CATEGORY = '__nueva__'

/** S12: crear (`/inventario/nuevo`) o editar (`/inventario/:id`) un producto. */
export default function ProductForm({ business }: { business: Business }) {
  const { id } = useParams()
  // undefined = cargando, null = no existe
  const product = useLiveQuery(async () => (id ? ((await getProduct(id)) ?? null) : null), [id])

  if (id && product === undefined) return <p className="loading">Cargando…</p>
  if (id && !product) {
    return (
      <section className="card">
        <h1>Producto no encontrado</h1>
        <p className="muted">Puede que se haya borrado.</p>
        <Link to="/inventario" className="btn primary">Volver al inventario</Link>
      </section>
    )
  }
  // key: al cambiar de producto se reinicia el formulario
  return <Editor key={id ?? 'nuevo'} business={business} product={product ?? undefined} />
}

const centsToInput = (c: number) => (c ? (c / 100).toFixed(2) : '')
const qtyToInput = (q: number) => (q ? String(q) : '')

function Editor({ business, product }: { business: Business; product?: Product }) {
  const navigate = useNavigate()
  const categories = useLiveQuery(() => listCategories(business.id, 'product'), [business.id]) ?? []

  const [photos, setPhotos] = useState<Blob[]>(product?.photos ?? [])
  const [barcode, setBarcode] = useState(product?.barcode ?? '')
  const [name, setName] = useState(product?.name ?? '')
  const [stock, setStock] = useState(product ? String(product.stock) : '')
  const [minStock, setMinStock] = useState(qtyToInput(product?.minStock ?? 0))
  const [price, setPrice] = useState(centsToInput(product?.priceCents ?? 0))
  const [cost, setCost] = useState(centsToInput(product?.costCents ?? 0))
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [inCatalog, setInCatalog] = useState(product?.visibleInCatalog ?? false)
  const [newCategory, setNewCategory] = useState('')
  const [scanning, setScanning] = useState(false)
  const [tab, setTab] = useState<'info' | 'variants'>('info')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const onDetected = useCallback((code: string) => {
    setBarcode(code)
    setScanning(false)
  }, [])

  async function addPhotos(files: FileList | null) {
    if (!files) return
    setError('')
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).slice(0, room)
    try {
      const resized = await Promise.all(picked.map((f) => resizeImage(f)))
      setPhotos((prev) => [...prev, ...resized].slice(0, MAX_PHOTOS))
      if (files.length > room) setError(`Solo caben ${MAX_PHOTOS} imágenes por producto`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar la imagen')
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    // Con variantes, el stock y el mínimo se llevan por variante (pestaña Variantes).
    const variants = !!product?.hasVariants
    const stockQty = variants ? 0 : parseQuantity(stock)
    const minQty = variants ? 0 : minStock.trim() ? parseQuantity(minStock) : 0
    // En edición, una cantidad negativa (vendida sin stock) se deja como está si no se toca.
    const keepNegative = variants || (product && product.stock < 0 && stock === String(product.stock))
    const priceCents = price.trim() ? parseMoney(price) : 0
    const costCents = cost.trim() ? parseMoney(cost) : 0
    if (!name.trim()) return setError('Escribe el nombre del producto')
    if (stockQty === null && !keepNegative) return setError('La cantidad disponible debe ser un número (0 o más)')
    if (minQty === null) return setError('La cantidad mínima debe ser un número (0 o más)')
    if (priceCents === null) return setError('El precio no es válido')
    if (costCents === null) return setError('El costo no es válido')

    setSaving(true)
    try {
      let catId = categoryId
      if (categoryId === NEW_CATEGORY) {
        catId = newCategory.trim() ? (await ensureCategory(business.id, 'product', newCategory)).id : ''
      }
      const input = {
        name,
        barcode,
        categoryId: catId,
        priceCents,
        costCents,
        ...(!keepNegative && { stock: stockQty ?? 0 }),
        ...(!variants && { minStock: minQty }),
        photos,
        description,
        visibleInCatalog: inCatalog,
      }
      if (product) await updateProduct(product.id, input)
      else await createProduct(business.id, input)
      navigate('/inventario')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  async function remove() {
    if (!product) return
    await deleteProduct(product.id)
    navigate('/inventario', { replace: true })
  }

  const priceC = parseMoney(price) ?? 0
  const costC = parseMoney(cost) ?? 0

  return (
    <>
      <section className="row-between">
        <Link to="/inventario" className="back" aria-label="Volver al inventario">←</Link>
        <h1 className="grow">{product ? 'Editar producto' : 'Nuevo producto'}</h1>
      </section>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'info'} className={`tab-btn ${tab === 'info' ? 'on' : ''}`} onClick={() => setTab('info')}>Información general</button>
        <button type="button" role="tab" aria-selected={tab === 'variants'} className={`tab-btn ${tab === 'variants' ? 'on' : ''}`} onClick={() => setTab('variants')}>
          Variantes{product?.hasVariants ? ` (${product.variantAttributes?.reduce((n, a) => n * a.values.length, 1) ?? ''})` : ''}
        </button>
      </div>

      {tab === 'variants' && !product && (
        <section className="card">
          <p className="muted">Primero guarda el producto con su información general; después podrás agregarle variantes como color, acabado o tamaño.</p>
        </section>
      )}
      {tab === 'variants' && product && <ProductVariants business={business} product={product} />}

      <form onSubmit={submit} className="card form" noValidate hidden={tab !== 'info'}>
        <fieldset className="photos">
          <legend>Imágenes (hasta {MAX_PHOTOS})</legend>
          <div className="photo-row">
            {photos.map((b, i) => (
              <div key={i} className="photo">
                <Thumb blob={b} alt={`Imagen ${i + 1}`} className="photo-img" />
                <button
                  type="button"
                  className="photo-remove"
                  aria-label={`Quitar imagen ${i + 1}`}
                  onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="photo add">
                <span aria-hidden>📷</span>
                <small>Agregar</small>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void addPhotos(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </fieldset>

        <label>
          Código de barras
          <div className="input-row">
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} inputMode="numeric" placeholder="Opcional" />
            {canScan && (
              <button type="button" className="btn ghost small" onClick={() => setScanning(true)} aria-label="Escanear con la cámara">
                📷 Escanear
              </button>
            )}
          </div>
        </label>

        <label>
          Nombre *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Silla de pino" autoFocus={!product} />
        </label>

        {product?.hasVariants ? (
          <p className="muted">
            Existencias: <strong>{formatQuantity(product.stock)}</strong> en total. Con variantes, el stock y el mínimo se cambian en cada variante.{' '}
            <button type="button" className="link" onClick={() => setTab('variants')}>Ver variantes</button>
          </p>
        ) : (
          <div className="two">
            <label>
              Cantidad disponible *
              <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="decimal" placeholder="0" />
            </label>
            <label>
              Cantidad mínima
              <input value={minStock} onChange={(e) => setMinStock(e.target.value)} inputMode="decimal" placeholder="0" />
              <small className="hint">Te avisamos cuando quede esta cantidad o menos.</small>
            </label>
          </div>
        )}

        <div className="two">
          <label>
            Precio de venta
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label>
            Costo
            <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
        </div>
        {priceC > 0 && costC > 0 && (
          <p className="muted">
            Ganancia por unidad: <strong>{formatMoney(priceC - costC, business.currency)}</strong>
          </p>
        )}

        <label>
          Categoría
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            <option value={NEW_CATEGORY}>+ Nueva categoría…</option>
          </select>
        </label>
        {categoryId === NEW_CATEGORY && (
          <label>
            Nombre de la nueva categoría
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ej. Muebles" autoFocus />
          </label>
        )}

        <label>
          Descripción para el catálogo
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Ej. Pino macizo, acabado natural, 1.80 m" />
        </label>
        <label className="check">
          <input type="checkbox" checked={inCatalog} onChange={(e) => setInCatalog(e.target.checked)} />
          Mostrar en el catálogo
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit" disabled={saving}>
          {saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </form>

      {product && (
        <>
          <StockHistory productId={product.id} />
          {confirmDelete ? (
            <section className="card confirm">
              <p>¿Borrar <strong>{product.name}</strong>? Desaparece del inventario; su historial se conserva.</p>
              <div className="quick">
                <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button type="button" className="btn expense" onClick={() => void remove()}>Sí, borrar</button>
              </div>
            </section>
          ) : (
            <button type="button" className="btn danger-text" onClick={() => setConfirmDelete(true)}>
              Borrar producto
            </button>
          )}
        </>
      )}

      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}
    </>
  )
}

const REASON_LABEL: Record<StockReason, string> = {
  adjust: 'Ajuste manual',
  sale: 'Venta',
  purchase: 'Compra',
  order: 'Pedido',
  void: 'Anulación',
}

function StockHistory({ productId }: { productId: string }) {
  const moves = useLiveQuery(() => stockHistory(productId), [productId])
  const names = useLiveQuery(() => variantNames(productId), [productId])
  if (!moves?.length) return null
  return (
    <section className="card">
      <h2>Movimientos de stock</h2>
      <ul className="moves">
        {moves.map((m) => (
          <li key={m.id}>
            <span>
              {REASON_LABEL[m.reason]}
              {m.variantId && names?.get(m.variantId) ? ` · ${names.get(m.variantId)}` : ''}
              <small className="muted"> · {new Date(m.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</small>
            </span>
            <strong className={m.delta > 0 ? 'pos' : 'neg'}>
              {m.delta > 0 ? '+' : '−'}
              {formatQuantity(Math.abs(m.delta))}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  )
}
