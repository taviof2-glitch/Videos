import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getContact } from '../data/contacts'
import { contactDebts } from '../data/debts'
import { formatMoney } from '../data/money'
import { buildReceipt, receiptFileName, receiptImageName, receiptPdf, receiptPreview, receiptText } from '../data/receipt'
import { TICKET_COLS } from '../data/pdf'
import { whatsappLink } from '../data/reminder'
import { getItems, getTransaction } from '../data/transactions'
import type { Business } from '../data/types'
import ShareFiles from '../ui/ShareFiles'
import { logoForImage, logoForPdf } from '../ui/logo'
import { renderTicketImage } from '../ui/ticketImage'
import { ChevronLeft } from 'lucide-react'

/** S05: venta registrada y comprobante para compartir por WhatsApp (texto), PDF o imagen. */
export default function Receipt({ business }: { business: Business }) {
  const { id = '' } = useParams()
  const fresh = (useLocation().state as { nueva?: boolean } | null)?.nueva === true
  // undefined = cargando, null = no existe
  const data = useLiveQuery(async () => {
    const sale = await getTransaction(id)
    if (!sale || sale.type !== 'sale') return null
    const contact = sale.contactId ? await getContact(sale.contactId) : undefined
    const debt = sale.status === 'credit' && sale.contactId ? (await contactDebts(sale.contactId)).find((i) => i.txn.id === id) : undefined
    return { sale, items: await getItems(id), contact, paidCents: debt?.paidCents ?? 0 }
  }, [id])
  const receipt = useMemo(() => (data ? buildReceipt({ business, ...data }) : undefined), [business, data])

  if (data === undefined) return <p className="loading">Cargando…</p>
  if (data === null || !receipt) {
    return (
      <section className="card">
        <h1>Venta no encontrada</h1>
        <Link to="/balance" className="btn primary">Volver a movimientos</Link>
      </section>
    )
  }

  const { sale, contact } = data
  const text = receiptText(receipt)

  return (
    <>
      <section className="row-between">
        <Link to={`/venta/${sale.id}`} className="back" aria-label="Ver detalle de la venta"><ChevronLeft size={24} strokeWidth={2} aria-hidden /></Link>
        <h1 className="grow">{fresh ? '¡Venta registrada!' : 'Enviar comprobante'}</h1>
      </section>
      {fresh && <p className="success">✓ {formatMoney(sale.amountCents, business.currency)} {sale.status === 'credit' ? 'fiados' : 'cobrados'}</p>}

      <pre className="card receipt" aria-label="Vista previa del comprobante">
        {business.logo && <img src={business.logo} alt={`Logo de ${business.name}`} className="doc-logo" />}
        {receiptPreview(receipt).map((l, i) => (
          <span key={i} className={l.bold ? 'b' : undefined}>{l.text || ' '}{'\n'}</span>
        ))}
      </pre>

      <a href={whatsappLink(text, contact?.phone ?? '', business.country)} target="_blank" rel="noopener noreferrer" className="btn sale">Enviar por WhatsApp</a>
      {contact && !contact.phone && <p className="muted">{contact.name} no tiene teléfono: en WhatsApp elegirás a quién enviarlo.</p>}
      <ShareFiles
        title={`Comprobante ${receipt.folio}`}
        text={text}
        pdf={async () => ({ blob: new Blob([receiptPdf(receipt, await logoForPdf(business.logo)) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }), filename: receiptFileName(receipt) })}
        image={async () => ({ blob: await renderTicketImage(receiptPreview(receipt), { cols: TICKET_COLS, logo: await logoForImage(business.logo) }), filename: receiptImageName(receipt) })}
      />
      <div className="quick">
        <Link to={`/venta/${sale.id}`} className="btn ghost">Ver detalle</Link>
        <Link to="/venta/nueva" className="btn primary">Nueva venta</Link>
      </div>
    </>
  )
}
