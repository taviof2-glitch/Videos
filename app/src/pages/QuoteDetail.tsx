import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { docNumber } from '../data/folio'
import { getContact } from '../data/contacts'
import { dayKey, formatDay } from '../data/dates'
import { formatMoney, parseMoney } from '../data/money'
import { listProducts } from '../data/products'
import { formatQuantity } from '../data/quantity'
import { buildQuoteDoc, quoteFileName, quoteImageName, quoteText } from '../data/quote-document'
import { billedQuantity, convertQuote, deleteQuote, getQuote, getQuoteItems, isAreaItem, quoteLineDiscount, quoteLineGross, quoteLineNet, setQuoteStatus, autoDeletable, deleteOn, keepQuote } from '../data/quotes'
import { whatsappLink } from '../data/reminder'
import type { Business, PaymentMethod } from '../data/types'
import { METHODS } from '../ui/forms'
import QuoteBadge from '../ui/QuoteBadge'
import ShareFiles, { WhatsAppImage } from '../ui/ShareFiles'
import { CutListResults } from '../ui/CutListPanel'
import { projectTitle } from '../data/cutlist'
import { setQuoteSketch } from '../data/quoter'
import { STAGE_LABEL, startJob } from '../data/jobs'
import Sketch from '../ui/Sketch'
import DocPreview from '../ui/DocPreview'
import { quoteDesignedPdf, quoteImage } from '../ui/documents'
import { ChevronLeft, TriangleAlert } from 'lucide-react'

/** Detalle de una cotización: compartir, estado y convertir en venta. */
export default function QuoteDetail({ business }: { business: Business }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const fresh = (useLocation().state as { nueva?: boolean } | null)?.nueva === true
  const [today] = useState(() => dayKey(Date.now(), business.timezone))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [converting, setConverting] = useState(false)
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    const quote = await getQuote(id)
    if (!quote) return null
    return { quote, items: await getQuoteItems(id), contact: (await getContact(quote.contactId)) ?? undefined }
  }, [id])
  const products = useLiveQuery(() => listProducts(business.id), [business.id])
  const doc = useMemo(() => (data ? buildQuoteDoc({ business, ...data }) : undefined), [business, data])

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null || !doc) {
    return (
      <section className="card">
        <h1>Cotización no encontrada</h1>
        <p className="muted">Puede que se haya borrado.</p>
        <Link to="/cotizaciones" className="btn primary">Volver a cotizaciones</Link>
      </section>
    )
  }

  const { quote, items, contact } = data
  const money = (c: number) => formatMoney(c, business.currency)
  const open = quote.status === 'pending' || quote.status === 'accepted'
  const advance = quote.advanceCents ?? 0
  const text = quoteText(doc)

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción')
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to="/cotizaciones" className="back" aria-label="Volver a cotizaciones"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">Cotización {docNumber(quote)}</h1>
      </section>
      {fresh && <p className="success">✓ Cotización creada. Ya puedes compartirla.</p>}

      <section className="card detail">
        <div className="row-between">
          <strong>{quote.title || `Cotización ${docNumber(quote)}`}</strong>
          <QuoteBadge quote={quote} today={today} />
        </div>
        <dl>
          <dt>Cliente</dt><dd>{contact?.name ?? '—'}</dd>
          <dt>Vigencia hasta</dt><dd>{formatDay(quote.validUntil)}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Artículos</h2>
        <ul className="moves">
          {items.map((i) => (
            <li key={i.id}>
              <span>
                {isAreaItem(i) ? `${formatQuantity(billedQuantity(i))} m²` : `${formatQuantity(i.quantity)} ${i.unit}`} × {i.name}
                <small className="muted">
                  {isAreaItem(i) ? ` · ${formatQuantity(i.quantity)} pza de ${formatQuantity(i.width!)} × ${formatQuantity(i.height!)} m` : ''} · {money(i.unitPriceCents)} c/{isAreaItem(i) ? 'm²' : 'u'}
                  {quoteLineDiscount(i) ? ` · desc. ${i.discountType === 'percent' ? `${i.discountValue}% ` : ''}−${money(quoteLineDiscount(i))}` : ''}
                </small>
              </span>
              <strong>{money(quoteLineNet(i))}</strong>
            </li>
          ))}
        </ul>
        <div className="totals">
          {(quote.discountCents ?? 0) > 0 && <p className="total-line"><span>Importe</span><span>{money(items.reduce((sum, i) => sum + quoteLineGross(i), 0))}</span></p>}
          {(quote.discountCents ?? 0) > 0 && <p className="total-line"><span>Descuentos</span><span>−{money(quote.discountCents)}</span></p>}
          {quote.taxCents > 0 && <p className="total-line"><span>Subtotal</span><span>{money(quote.subtotalCents)}</span></p>}
          {quote.taxCents > 0 && <p className="total-line"><span>IVA {quote.taxRate}%</span><span>{money(quote.taxCents)}</span></p>}
          <p className="total-line"><span>Total</span><strong>{money(quote.totalCents)}</strong></p>
          {advance > 0 && <p className="total-line"><span>Anticipo</span><span>{money(advance)}</span></p>}
          {advance > 0 && <p className="total-line"><span>Saldo</span><strong>{money(quote.totalCents - advance)}</strong></p>}
          {quote.payBy && <p className="total-line"><span>Fecha estimada de pago</span><span>{formatDay(quote.payBy)}</span></p>}
        </div>
        {quote.notes && <p className="muted notes">{quote.notes}</p>}
      </section>

      <DocPreview render={() => quoteImage(doc, business.logo)} label="Vista previa de la cotización" deps={[doc, business.logo]} />
      <WhatsAppImage title={heading(doc)} text={text} waLink={whatsappLink(text, contact?.phone ?? '', business.country)} image={async () => ({ blob: await quoteImage(doc, business.logo), filename: quoteImageName(doc) })} />
      {contact && !contact.phone && <p className="muted">{contact.name} no tiene teléfono: en WhatsApp elegirás a quién enviarla.</p>}
      <ShareFiles
        title={heading(doc)}
        text={text}
        pdf={async () => ({ blob: new Blob([(await quoteDesignedPdf(doc, business.logo)) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), filename: quoteFileName(doc) })}
        image={async () => ({ blob: await quoteImage(doc, business.logo), filename: quoteImageName(doc) })}
      />

      {quote.status === 'converted' && quote.transactionId && <Link to={`/venta/${quote.transactionId}`} className="btn primary">Ver la venta</Link>}

      {open && (
        <>
          {quote.status === 'pending' ? (
            <div className="quick">
              <button type="button" className="btn ghost" onClick={() => void run(() => setQuoteStatus(quote.id, 'accepted'))}>Marcar aceptada</button>
              <button type="button" className="btn ghost" onClick={() => void run(() => setQuoteStatus(quote.id, 'rejected'))}>Rechazar</button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => void run(() => setQuoteStatus(quote.id, 'pending'))}>Volver a pendiente</button>
          )}
          {converting ? (
            <ConvertPanel
              business={business} total={quote.totalCents} today={today} defaults={{ advanceCents: advance, dueDate: quote.payBy }}
              lowStock={items.flatMap((i) => {
                const p = products?.find((x) => x.id === i.productId)
                return p && !p.madeToOrder && i.quantity > p.stock ? [`${p.name}: pides ${formatQuantity(i.quantity)} y hay ${formatQuantity(Math.max(p.stock, 0))}`] : []
              })}
              onCancel={() => setConverting(false)}
              onConfirm={(opts) => run(async () => {
                const { sale } = await convertQuote(quote.id, opts)
                navigate(`/venta/${sale.id}/comprobante`, { replace: true, state: { nueva: true } })
              })}
            />
          ) : (
            <button type="button" className="btn primary" onClick={() => setConverting(true)}>Convertir en venta</button>
          )}
        </>
      )}
      {quote.status === 'rejected' && (
        <button type="button" className="btn ghost" onClick={() => void run(() => setQuoteStatus(quote.id, 'pending'))}>Reabrir como pendiente</button>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {autoDeletable(quote) && (
        <p className="note-box">Si no se concreta, esta cotización se borra sola el <strong>{formatDay(deleteOn(quote, business.timezone))}</strong>. <button type="button" className="link" onClick={() => void run(() => keepQuote(quote.id, today, business.timezone))}>Conservar 30 días más</button></p>
      )}
      {quote.job ? (
        <Link to="/obras" className="alert">Obra en el taller: {STAGE_LABEL[quote.job.stage]}{quote.job.deliveryDate ? ` · entrega ${formatDay(quote.job.deliveryDate)}` : ''}<span>Ver</span></Link>
      ) : quote.status !== 'rejected' ? (
        <button type="button" className="btn ghost" onClick={() => void run(async () => { await startJob(quote.id); navigate('/obras') })}>Pasar a obra (seguimiento en el taller)</button>
      ) : null}

      {quote.quoter?.cut && (
        <details className="card cut-saved">
          <summary>
            <strong>Despiece</strong> <small className="muted">{projectTitle([quote.quoter.cut.spec, ...(quote.quoter.cut.more ?? [])])} · solo para ti, no se manda al cliente</small>
          </summary>
          <label className="check"><input type="checkbox" checked={!!quote.quoter.sketch} onChange={(e) => void run(() => setQuoteSketch(quote.id, e.target.checked))} /><span>Incluir el boceto en la cotización que recibe el cliente (imagen y PDF)</span></label>
          {[quote.quoter.cut.spec, ...(quote.quoter.cut.more ?? [])].map((sp, i) => <Sketch key={i} spec={sp} />)}
          <CutListResults business={business} specs={[quote.quoter.cut.spec, ...(quote.quoter.cut.more ?? [])]} girar={quote.quoter.cut.girar} pieces={quote.quoter.cut.pieces} />
        </details>
      )}

      {quote.status !== 'converted' && (
        <>
          <Link to={`/cotizaciones/${quote.id}/editar`} className="btn ghost">Editar</Link>
          {confirmDelete ? (
            <section className="card confirm">
              <p>¿Borrar la cotización {docNumber(quote)}?</p>
              <div className="quick">
                <button type="button" className="btn ghost" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button type="button" className="btn expense" onClick={() => void run(async () => { await deleteQuote(quote.id); navigate('/cotizaciones', { replace: true }) })}>Sí, borrar</button>
              </div>
            </section>
          ) : (
            <button type="button" className="btn danger-text" onClick={() => setConfirmDelete(true)}>Borrar cotización</button>
          )}
        </>
      )}
    </>
  )
}

const heading = (d: { numberLabel: string; title: string }) => `Cotización ${d.numberLabel}${d.title ? ` · ${d.title}` : ''}`

type Opts = { credit: boolean; dueDate?: string; method: PaymentMethod; advanceCents?: number }

function ConvertPanel(props: {
  business: Business
  total: number
  today: string
  /** Lo que la cotización ya pedía: anticipo y fecha estimada de pago. */
  defaults: { advanceCents: number; dueDate?: string }
  lowStock: string[]
  onCancel: () => void
  onConfirm: (o: Opts) => Promise<void>
}) {
  const [credit, setCredit] = useState(props.defaults.advanceCents > 0 || !!props.defaults.dueDate)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [due, setDue] = useState(props.defaults.dueDate ?? '')
  const [advance, setAdvance] = useState(props.defaults.advanceCents ? (props.defaults.advanceCents / 100).toFixed(2) : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const money = (c: number) => formatMoney(c, props.business.currency)

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const advanceCents = credit && advance.trim() ? parseMoney(advance) : undefined
    if (advanceCents === null) return setError('El anticipo no es válido')
    if (advanceCents !== undefined && advanceCents > props.total) return setError(`El anticipo no puede superar el total (${money(props.total)})`)
    setBusy(true)
    await props.onConfirm({ credit, dueDate: credit ? due || undefined : undefined, method, advanceCents: advanceCents || undefined })
    setBusy(false)
  }

  return (
    <form onSubmit={confirm} className="card form" aria-label="Convertir en venta">
      <h2>Convertir en venta · {money(props.total)}</h2>
      <div className="tabs" role="tablist" aria-label="Forma de pago">
        <button type="button" role="tab" aria-selected={!credit} className={`tab-btn ${!credit ? 'on' : ''}`} onClick={() => setCredit(false)}>Contado</button>
        <button type="button" role="tab" aria-selected={credit} className={`tab-btn ${credit ? 'on' : ''}`} onClick={() => setCredit(true)}>Fiado</button>
      </div>
      {credit ? (
        <>
          <label>
            Anticipo recibido ahora (opcional)
            <input value={advance} onChange={(e) => setAdvance(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </label>
          <label>
            Fecha límite para el resto (opcional)
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </>
      ) : null}
      <label>
        {credit ? 'Método del anticipo' : 'Método de pago'}
        <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </label>
      {props.lowStock.map((w) => <p key={w} className="warn"><TriangleAlert className="i-inline" aria-hidden /> {w}. Puedes convertir igual: el stock quedará en negativo.</p>)}
      <p className="muted">Se crea una venta con estos mismos artículos y precios, y se descuenta el inventario.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={props.onCancel}>Cancelar</button>
        <button type="submit" className="btn sale" disabled={busy}>{busy ? 'Convirtiendo…' : 'Convertir'}</button>
      </div>
    </form>
  )
}
