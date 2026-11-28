import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { searchAll } from '../data/search'
import type { Business } from '../data/types'

/** Buscador general: clientes, obras, cotizaciones, ventas, pedidos, productos y citas. */
export default function Search({ business }: { business: Business }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 180); return () => clearTimeout(t) }, [q])
  const hits = useLiveQuery(() => searchAll(business, debounced), [business, debounced])
  return (
    <>
      <h1>Buscar</h1>
      <label className="search-box">
        <SearchIcon aria-hidden />
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, teléfono, folio, concepto…" aria-label="Buscar" enterKeyHint="search" />
      </label>
      {debounced.trim().length < 2 ? (
        <p className="muted">Escribe al menos 2 letras. Busca en clientes, proveedores, obras, cotizaciones, ventas, gastos, pedidos, productos y citas.</p>
      ) : hits === undefined ? <p className="loading">Buscando…</p> : hits.length === 0 ? (
        <p className="muted">No encontré nada con «{debounced}».</p>
      ) : (
        <ul className="moves search-hits">
          {hits.map((h, i) => (
            <li key={`${h.to}-${i}`}>
              <Link to={h.to} className="grow plain">
                <span className={`badge kind-${h.kind}`}>{h.kind}</span> <strong>{h.title}</strong>
                {h.detail && <small className="muted"><br />{h.detail}</small>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
