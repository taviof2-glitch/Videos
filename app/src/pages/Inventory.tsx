import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listCategories } from '../data/categories'
import { formatMoney } from '../data/money'
import { listProducts, stockStatus, summarize } from '../data/products'
import { formatQuantity } from '../data/quantity'
import type { Business, Product } from '../data/types'
import Thumb from '../ui/Thumb'

const STATUS_LABEL = { ok: 'Disponible', low: 'Stock bajo', out: 'Agotado' } as const

export default function Inventory({ business }: { business: Business }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const categoryId = params.get('categoria') ?? ''
  const onlyRestock = params.get('reabastecer') === '1'

  const categories = useLiveQuery(() => listCategories(business.id, 'product'), [business.id]) ?? []
  const all = useLiveQuery(() => listProducts(business.id), [business.id])
  const products = useLiveQuery(
    () => listProducts(business.id, { search, categoryId, onlyRestock }),
    [business.id, search, categoryId, onlyRestock],
  )

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  if (!all || !products) return <p className="loading">Cargando…</p>
  const summary = summarize(all)

  return (
    <>
      <section className="row-between">
        <h1>Inventario</h1>
        <Link to="/inventario/nuevo" className="btn primary small">+ Producto</Link>
      </section>

      {all.length === 0 ? (
        <section className="card empty-state">
          <span aria-hidden>📦</span>
          <h2>Aún no tienes productos</h2>
          <p className="muted">Registra lo que vendes con su precio y cantidad para saber cuándo reabastecer.</p>
          <Link to="/inventario/nuevo" className="btn primary">Crear mi primer producto</Link>
        </section>
      ) : (
        <>
          <section className="stats">
            <div className="card stat">
              <small>Productos</small>
              <strong>{summary.count}</strong>
            </div>
            <div className="card stat">
              <small>Valor a costo</small>
              <strong>{formatMoney(summary.costValueCents, business.currency)}</strong>
            </div>
          </section>

          {summary.restock > 0 && (
            <button
              type="button"
              className={`alert ${onlyRestock ? 'on' : ''}`}
              onClick={() => setFilter('reabastecer', onlyRestock ? '' : '1')}
              aria-pressed={onlyRestock}
            >
              ⚠️ {summary.restock === 1 ? '1 producto necesita' : `${summary.restock} productos necesitan`} reabastecerse
              <span>{onlyRestock ? 'Ver todos' : 'Ver'}</span>
            </button>
          )}

          <input
            type="search"
            placeholder="Buscar por nombre o código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar producto"
          />

          {categories.length > 0 && (
            <div className="chips" role="group" aria-label="Categorías">
              <button type="button" className={`chip ${categoryId ? '' : 'on'}`} onClick={() => setFilter('categoria', '')}>
                Todas
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${categoryId === c.id ? 'on' : ''}`}
                  onClick={() => setFilter('categoria', c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <section className="card list">
            {products.length === 0 ? (
              <p className="muted">Ningún producto coincide con la búsqueda.</p>
            ) : (
              products.map((p) => <ProductRow key={p.id} product={p} currency={business.currency} />)
            )}
          </section>

          <div className="quick">
            <Link to="/compras/nueva" className="btn primary">Registrar compra</Link>
            <Link to="/compras" className="btn ghost">Ver compras</Link>
          </div>
        </>
      )}
    </>
  )
}

function ProductRow({ product: p, currency }: { product: Product; currency: string }) {
  const status = stockStatus(p)
  return (
    <Link to={`/inventario/${p.id}`} className="product-row">
      <Thumb blob={p.photos[0]} alt="" />
      <div className="grow">
        <strong>{p.name}</strong>
        <small className="muted">{formatMoney(p.priceCents, currency)}</small>
      </div>
      <div className="stock">
        <strong>{formatQuantity(p.stock)}</strong>
        <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
      </div>
    </Link>
  )
}
