import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { updateBusiness } from '../data/business'
import { buildCatalog, catalogFileName, catalogIssues } from '../data/catalog'
import { listProducts, updateProduct, matchesSearch } from '../data/products'
import type { Business } from '../data/types'
import { thumbnailDataUri } from '../ui/images'
import { downloadBlob } from '../ui/share'
import { whatsappLink } from '../data/reminder'
import { accountError, type CatalogPage } from '../sync/backend'
import { getCatalogPage, setCatalogPage, useSyncStatus } from '../sync/runner'

/** Dónde vive la página pública del catálogo en vivo (la app desplegada la sirve en /catalogo/). */
const CATALOG_BASE: string = import.meta.env.VITE_CATALOG_URL ?? `${location.origin}/catalogo/`
const liveCatalogLink = (slug: string) => `${CATALOG_BASE}?c=${encodeURIComponent(slug)}`

const SLUG_HINT = (name: string) => name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

/** S17: qué productos salen en el catálogo público y cómo publicarlo. */
export default function Catalog({ business }: { business: Business }) {
  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const [search, setSearch] = useState('')
  const [note, setNote] = useState(business.catalogNote ?? '')
  const [url, setUrl] = useState(business.catalogUrl ?? '')
  const [message, setMessage] = useState<{ ok: boolean; text: string }>()
  const [busy, setBusy] = useState(false)
  const sync = useSyncStatus()
  const linked = sync.link?.businessId === business.id
  const [page, setPage] = useState<CatalogPage | null | undefined>()
  const [slug, setSlug] = useState('')
  const [liveMsg, setLiveMsg] = useState<{ ok: boolean; text: string }>()
  useEffect(() => {
    if (!linked) return
    let cancelled = false
    getCatalogPage(business.id)
      .then((p) => {
        if (cancelled) return
        setPage(p)
        setSlug((s) => s || p?.slug || SLUG_HINT(business.name))
      })
      .catch(() => !cancelled && setPage(undefined))
    return () => {
      cancelled = true
    }
  }, [linked, business.id, business.name])

  async function saveLive(enabled: boolean) {
    setLiveMsg(undefined)
    try {
      const saved = await setCatalogPage(business.id, slug, enabled)
      setPage(saved)
      setSlug(saved.slug)
      setLiveMsg({ ok: true, text: enabled ? 'Tu catálogo en vivo está encendido.' : 'Tu catálogo en vivo está apagado: nadie lo ve ni puede pedir.' })
    } catch (err) {
      setLiveMsg({ ok: false, text: accountError(err) })
    }
  }

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

      {sync.phase !== 'off' && (
        <section className="card form">
          <h2>Catálogo en vivo</h2>
          {!linked ? (
            <p className="muted">Conecta tu cuenta en <Link to="/cuenta">Cuenta y nube</Link> para tener un catálogo que se actualiza solo y recibe pedidos directo en Houselite.</p>
          ) : (
            <>
              <p className="muted">Siempre muestra tus precios y existencias de hoy (nunca tus costos ni cuántas piezas tienes). Los pedidos llegan solos a <Link to="/pedidos">Pedidos</Link> en menos de un minuto.</p>
              <label>
                Nombre de tu página
                <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} placeholder="mi-negocio" />
              </label>
              <div className="quick">
                <button type="button" className="btn primary small" disabled={page === undefined && !slug} onClick={() => void saveLive(true)}>{page?.enabled ? 'Guardar nombre' : 'Encender catálogo en vivo'}</button>
                {page?.enabled && <button type="button" className="btn ghost small" onClick={() => void saveLive(false)}>Apagar</button>}
              </div>
              {page?.enabled && (
                <>
                  <p>
                    <a href={liveCatalogLink(page.slug)} target="_blank" rel="noopener noreferrer">{liveCatalogLink(page.slug)}</a>
                  </p>
                  <a className="btn ghost small" target="_blank" rel="noopener noreferrer" href={whatsappLink(`Mira mi catálogo de ${business.name}: ${liveCatalogLink(page.slug)}`, '', business.country)}>Compartir el enlace por WhatsApp</a>
                </>
              )}
              {liveMsg && <p className={liveMsg.ok ? 'muted' : 'error'} role={liveMsg.ok ? 'status' : 'alert'}>{liveMsg.text}</p>}
            </>
          )}
        </section>
      )}

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
