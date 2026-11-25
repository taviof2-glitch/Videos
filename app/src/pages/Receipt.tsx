import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getContact } from '../data/contacts'
import { contactDebts } from '../data/debts'
import { formatMoney } from '../data/money'
import { buildReceipt, receiptFileName, receiptPdf, receiptPreview, receiptText } from '../data/receipt'
import { whatsappLink } from '../data/reminder'
import { getItems, getTransaction } from '../data/transactions'
import type { Business } from '../data/types'
import { canShareFiles, downloadBlob, pdfFile, shareFile } from '../ui/share'

/** S05: venta registrada y comprobante para compartir por WhatsApp o en PDF. */
export default function Receipt({ business }: { business: Business }) {
  const { id = '' } = useParams()
  const fresh = (useLocation().state as { nueva?: boolean } | null)?.nueva === true
  const [error, setError] = useState('')
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
  const file = () => pdfFile(receiptPdf(receipt) as Uint8Array<ArrayBuffer>, receiptFileName(receipt))
  const text = receiptText(receipt)

  async function share() {
    setError('')
    try {
      await shareFile(file(), `Comprobante ${receipt!.folio}`, text)
    } catch {
      setError('No se pudo abrir el menú de compartir. Usa WhatsApp o descarga el PDF.')
    }
  }

  return (
    <>
      <section className="row-between">
        <Link to={`/venta/${sale.id}`} className="back" aria-label="Ver detalle de la venta">←</Link>
        <h1 className="grow">{fresh ? '¡Venta registrada!' : 'Comprobante'}</h1>
      </section>
      {fresh && <p className="success">✓ {formatMoney(sale.amountCents, business.currency)} {sale.status === 'credit' ? 'fiados' : 'cobrados'}</p>}

      <pre className="card receipt" aria-label="Vista previa del comprobante">
        {receiptPreview(receipt).map((l, i) => (
          <span key={i} className={l.bold ? 'b' : undefined}>{l.text || ' '}{'\n'}</span>
        ))}
      </pre>

      <a href={whatsappLink(text, contact?.phone ?? '', business.country)} target="_blank" rel="noopener noreferrer" className="btn sale">Enviar por WhatsApp</a>
      {contact && !contact.phone && <p className="muted">{contact.name} no tiene teléfono: en WhatsApp elegirás a quién enviarlo.</p>}
      <div className="quick">
        <button type="button" className="btn ghost" onClick={() => downloadBlob(new Blob([file()], { type: 'application/pdf' }), receiptFileName(receipt))}>Descargar PDF</button>
        {canShareFiles() ? (
          <button type="button" className="btn ghost" onClick={() => void share()}>Compartir…</button>
        ) : (
          <Link to={`/venta/${sale.id}`} className="btn ghost">Ver detalle</Link>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <Link to="/venta/nueva" className="btn primary">Nueva venta</Link>
    </>
  )
}
