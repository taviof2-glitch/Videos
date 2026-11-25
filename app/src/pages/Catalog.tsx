import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { updateBusiness } from '../data/business'
import { buildCatalog, catalogFileName, catalogIssues } from '../data/catalog'
import { listProducts, updateProduct, matchesSearch } from '../data/products'
import type { Business } from '../data/types'
import { thumbnailDataUri } from '../ui/images'
import { downloadBlob } from '../ui/share'
import { whatsappLink } from '../data/reminder'

/** S17: qué productos salen en el catálogo público y cómo publicarlo. */
export default function Catalog({ business }: { business: Business }) {
  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(business.catalogNote ?? '')
  const [url, setUrl] = useState(business.catalogUrl ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)
  const visible = products?.filter((p) => p.visibleInCatalog) ?? []
  const issues = catalogIssues(business, visible.length)
  const shown = products?.filter((p) => !search.trim() || matchesSearch(p.name, search)) ?? []

  async function saveSettings() {
    await updateBusiness(business.id, { catalogNote: note.trim() || undefined, catalogUrl: url.trim() || undefined })
    setMessage({ ok: true, text: 'Guardado.' })
  }

  async function download() {
    setBusy(true)
    setMessage(undefined)
    try {
      await updateBusiness(business.id, { catalogNote: note.trim() || undefined, catalogUrl: url.trim() || undefined })
      const data = await buildCatalog({ ...business, catalogNote: note.trim() || undefined }, thumbnailDataUri)
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      if (await downloadBlob(blob, catalogFileName(business))) {
        setMessage({ ok: true, text: `Catálogo descargado (${data.products.length} productos, ${Math.max(1, Math.round(blob.size / 1024))} KB). Ahora súbelo a la página de tu catálogo.` })
      }
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudo crear el catálogo' })
    }
    setBusy(false)
  }

  return (
    <>
      <section className="row-between">
        <h1>Catálogo</h1>
        <Link to="/pedidos" className="btn ghost small">Pedidos</Link>
      </section>
      <p className="muted">Una página con tus productos para que los clientes armen su pedido y te lo manden por WhatsApp.</p>

      {issues.map((i) => <p key={i} className="alert static">⚠️ {i}</p>)}

      <section className="card form">
        <h2>Tu página</h2>
        <label>
          Mensaje de bienvenida (opcional)
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ej. Muebles hechos a mano. Entregas en la ciudad." />
        </label>
        <label>
          Enlace de tu catálogo
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="Pégalo aquí cuando lo tengas" />
        </label>
        <button type="button" className="btn ghost small" onClick={() => void saveSettings()}>Guardar</button>
        {url.trim().startsWith('https://') && (
          <a className="btn ghost small" target="_blank" rel="noopener noreferrer" href={whatsappLink(`Mira mi catálogo de ${business.name}: ${url.trim()}`, '', business.country)}>Compartir el enlace por WhatsApp</a>
        )}
      </section>

      <section className="card">
        <h2>Cómo publicarlo o actualizarlo</h2>
        <ol className="steps">
          <li>Marca abajo los productos que quieres mostrar.</li>
          <li>Pulsa <strong>Descargar catálogo</strong>.</li>
          <li>Abre la página de tu catálogo, entra a <strong>Administrar</strong>, elige el archivo y pulsa <strong>Publicar</strong>.</li>
        </ol>
        <p className="muted">Los clientes ven una copia: si cambias precios o existencias, vuelve a descargar y publicar. Nunca se muestran tus costos ni cuántas piezas tienes, solo si un producto está agotado.</p>
        <button type="button" className="btn primary" disabled={busy || visible.length === 0} onClick={() => void download()}>Descargar catálogo ({visible.length})</button>
        {message && <p className={message.ok ? 'muted' : 'error'} role={message.ok ? 'status' : 'alert'}>{message.text}</p>}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>Productos</h2>
          <span className="muted">{visible.length} de {products?.length ?? 0} visibles</span>
        </div>
        {products && products.length === 0 && <p className="muted">Primero crea productos en el <Link to="/inventario">inventario</Link>.</p>}
        {products && products.length > 0 && (
          <>
            <input type="search" placeholder="Buscar producto" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar producto" />
            <div className="quick">
              <button type="button" className="btn ghost small" onClick={() => void Promise.all(products.filter((p) => !p.visibleInCatalog).map((p) => updateProduct(p.id, { visibleInCatalog: true })))}>Mostrar todos</button>
              <button type="button" className="btn ghost small" onClick={() => void Promise.all(products.filter((p) => p.visibleInCatalog).map((p) => updateProduct(p.id, { visibleInCatalog: false })))}>Ocultar todos</button>
            </div>
            <ul className="toggle-list">
              {shown.map((p) => (
                <li key={p.id}>
                  <label className="check">
                    <input type="checkbox" checked={!!p.visibleInCatalog} onChange={(e) => void updateProduct(p.id, { visibleInCatalog: e.target.checked })} aria-label={`Mostrar ${p.name} en el catálogo`} />
                    <span className="grow">{p.name}{p.variants?.length ? <small className="muted"> · {p.variants.length} variantes</small> : null}</span>
                    {!p.photos.length && p.visibleInCatalog && <small className="muted">sin foto</small>}
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  )
}
