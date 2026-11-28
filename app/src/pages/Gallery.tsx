import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Images } from 'lucide-react'
import { CATEGORIES, categoryLabel, ensureGalleryToken, galleryJobs, galleryUrl, socialText } from '../data/gallery'
import { updateJob } from '../data/jobs'
import { whatsappLink } from '../data/reminder'
import type { Business } from '../data/types'

/** Galería de trabajos: fotos de las obras por tipo de mueble, para mandar a clientes y publicar en redes. */
export default function Gallery({ business }: { business: Business }) {
  const jobs = useLiveQuery(() => galleryJobs(business.id), [business.id])
  const [cat, setCat] = useState('')
  const [msg, setMsg] = useState('')
  const [textFor, setTextFor] = useState<string>()
  if (!jobs) return <p className="loading">Cargando…</p>
  const present = CATEGORIES.filter(([k]) => jobs.some((j) => j.category === k))
  const shown = cat ? jobs.filter((j) => j.category === cat) : jobs
  const published = jobs.filter((j) => j.job.gallery).length

  async function share() {
    const token = await ensureGalleryToken(business)
    const url = galleryUrl(token, cat || undefined)
    const text = `Le comparto algunos de nuestros trabajos${cat ? ` de ${categoryLabel(cat).toLowerCase()}` : ''}: ${url}`
    if (navigator.share) await navigator.share({ title: `${business.name} · trabajos`, text, url }).catch(() => undefined)
    else window.open(whatsappLink(text, '', business.country), '_blank', 'noopener')
    setMsg(`Enlace: ${url}`)
  }

  return (
    <>
      <h1>Galería de trabajos</h1>
      <p className="muted">Las fotos que subes en cada obra. Marca las que quieras mostrar y comparte el enlace cuando un cliente te pregunte qué has hecho.</p>
      {jobs.length === 0 ? (
        <section className="card empty-state"><Images aria-hidden strokeWidth={1.75} /><h2>Aún no hay fotos</h2><p className="muted">Sube fotos en Obras (abre una obra → Fotos de la obra) y aquí aparecen solas.</p></section>
      ) : (
        <>
          {present.length > 1 && (
            <div className="chips wrap" role="group" aria-label="Tipo de mueble">
              <button type="button" className={`chip ${cat ? '' : 'on'}`} onClick={() => setCat('')}>Todos ({jobs.length})</button>
              {present.map(([k, l]) => <button key={k} type="button" className={`chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(k)}>{l} ({jobs.filter((j) => j.category === k).length})</button>)}
            </div>
          )}
          <section className="card form">
            <p className="muted">{published === 0 ? 'Todavía no marcas ninguna obra para mostrar.' : `${published} ${published === 1 ? 'obra se muestra' : 'obras se muestran'} en tu galería pública.`}</p>
            <button type="button" className="btn primary" disabled={!published} onClick={() => void share()}>Compartir galería{cat ? ` de ${categoryLabel(cat).toLowerCase()}` : ''}</button>
            {msg && <p className="track-url">{msg}</p>}
          </section>
          <div className="gallery-grid">
            {shown.map((j) => (
              <article key={j.id} className="card gallery-item">
                {j.job.before
                  ? <div className="before-after"><figure><img src={j.job.before} alt="Antes" /><figcaption>Antes</figcaption></figure><figure><img src={j.job.photos![j.job.photos!.length - 1]} alt="Después" /><figcaption>Después</figcaption></figure></div>
                  : <img src={j.job.photos![0]} alt={j.title} />}
                {j.job.photos!.length > 1 && <div className="gallery-more">{j.job.photos!.slice(1).map((p, i) => <img key={i} src={p} alt="" />)}</div>}
                <strong>{j.title}</strong>
                <small className="muted">{categoryLabel(j.category)}</small>
                <label className="check"><input type="checkbox" checked={!!j.job.gallery} onChange={(e) => void updateJob(j.id, { gallery: e.target.checked || undefined })} /><span>Mostrar en mi galería</span></label>
                <button type="button" className="link" onClick={() => setTextFor(textFor === j.id ? undefined : j.id)}>{textFor === j.id ? 'Ocultar texto' : 'Texto para redes'}</button>
                {textFor === j.id && (() => {
                  const t = socialText({ title: j.title, category: j.category, business: business.name, phone: business.phone, beforeAfter: !!j.job.before })
                  return (
                    <>
                      <textarea readOnly rows={8} value={t} />
                      <button type="button" className="btn ghost small" onClick={() => void navigator.clipboard.writeText(t).then(() => setMsg('Texto copiado: pégalo con la foto en Facebook, Instagram o Marketplace.'))}>Copiar texto</button>
                    </>
                  )
                })()}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
