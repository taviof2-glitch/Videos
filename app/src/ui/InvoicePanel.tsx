import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { FileCheck2 } from 'lucide-react'
import { getContact } from '../data/contacts'
import { invoiceItems, invoicingOf, PAYMENT_FORM, RFC_RE, saveFiscal, setSaleInvoice, TAX_SYSTEMS, USES } from '../data/invoicing'
import { formatMoney } from '../data/money'
import type { Business, Transaction, TransactionItem } from '../data/types'
import { cancelInvoice, createInvoice, downloadInvoice, emailInvoice } from '../sync/factura'
import { canShareFiles, downloadBlob, shareFile } from './share'

/** Factura electrónica de una venta (opcional: solo aparece si se activó en «Datos del negocio»). */
export default function InvoicePanel({ business, sale, items, paidCents }: { business: Business; sale: Transaction; items: TransactionItem[]; paidCents: number }) {
  const settings = invoicingOf(business)
  const contact = useLiveQuery(async () => (sale.contactId ? ((await getContact(sale.contactId)) ?? null) : null), [sale.contactId])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState<{ publicGeneral: boolean; rfc: string; legalName: string; taxSystem: string; zip: string; email: string; use: string; send: boolean }>()
  if (!settings.enabled || contact === undefined) return null
  const money = (c: number) => formatMoney(c, business.currency)
  const inv = sale.invoice
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(''); setMsg('')
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo') } finally { setBusy(false) }
  }
  const name = inv ? `Factura ${inv.series}${inv.folio}`.trim() : ''

  async function file(f: 'pdf' | 'xml') {
    const blob = await downloadInvoice(inv!.id, f)
    const filename = `${name.replace(/\s+/g, '-')}.${f}`
    if (f === 'pdf' && canShareFiles()) await shareFile(new File([blob], filename, { type: blob.type }), name, `${name} de ${business.name}`).catch(() => downloadBlob(blob, filename))
    else await downloadBlob(blob, filename)
  }

  if (inv) {
    return (
      <section className="card form">
        <h2><FileCheck2 className="i-inline" aria-hidden /> {name}{inv.canceled ? ' (cancelada)' : ''}</h2>
        <p className="muted">Folio fiscal: <span className="track-url">{inv.uuid}</span>{inv.test ? ' · de prueba (sin validez)' : ''}</p>
        <div className="quick">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => file('pdf'))}>PDF</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(() => file('xml'))}>XML</button>
        </div>
        {!inv.canceled && contact?.fiscal?.email && <button type="button" className="btn ghost" disabled={busy} onClick={() => void run(async () => { await emailInvoice(inv.id, contact.fiscal!.email); setMsg(`Enviada a ${contact.fiscal!.email}.`) })}>Mandar por correo a {contact.fiscal.email}</button>}
        {!inv.canceled && <button type="button" className="link danger-link" disabled={busy} onClick={() => { if (confirm('¿Cancelar esta factura ante el SAT? (motivo: errores sin relación)')) void run(async () => { const r = await cancelInvoice(inv.id); await setSaleInvoice(sale.id, { ...inv, canceled: r.status === 'canceled' }); setMsg(r.status === 'canceled' ? 'Factura cancelada.' : `Cancelación solicitada (${r.cancellation || 'pendiente'}); el cliente puede tener que aceptarla.`) }) }}>Cancelar factura</button>}
        {msg && <p className="success" role="status">{msg}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    )
  }

  if (!open) return <button type="button" className="btn ghost" onClick={() => { setOpen(true); setForm({ publicGeneral: !contact, rfc: contact?.documentId ?? '', legalName: contact?.fiscal?.legalName ?? contact?.name ?? '', taxSystem: contact?.fiscal?.taxSystem ?? '612', zip: contact?.fiscal?.zip ?? '', email: contact?.fiscal?.email ?? '', use: contact?.fiscal?.use ?? 'G03', send: true }) }}><FileCheck2 aria-hidden /> Hacer factura electrónica</button>
  if (!form) return null
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p })
  const pending = sale.status === 'credit' && paidCents < sale.amountCents

  async function stamp() {
    const f = form!
    const rfc = f.rfc.trim().toUpperCase()
    if (!f.publicGeneral) {
      if (!RFC_RE.test(rfc)) throw new Error('El RFC no es válido (12 o 13 caracteres).')
      if (!/^\d{5}$/.test(f.zip)) throw new Error('El código postal fiscal debe tener 5 números.')
    }
    const fiscal = { legalName: f.legalName, taxSystem: f.taxSystem, zip: f.zip, ...(f.email.trim() && { email: f.email.trim() }), use: f.use }
    const r = await createInvoice({
      publicGeneral: f.publicGeneral,
      customer: f.publicGeneral ? { legalName: 'PUBLICO EN GENERAL', rfc: 'XAXX010101000', taxSystem: '616', zip: settings.zip } : { ...fiscal, rfc },
      use: f.use, paymentForm: PAYMENT_FORM[sale.paymentMethod], paymentMethod: pending ? 'PPD' : 'PUE',
      items: invoiceItems(sale, items), taxIncluded: settings.taxIncluded, productKey: settings.productKey, externalId: sale.id,
      ...(f.send && !f.publicGeneral && f.email.trim() && { sendTo: f.email.trim() }),
    })
    await setSaleInvoice(sale.id, { id: r.id, uuid: r.uuid, series: r.series, folio: r.folio, at: new Date().toISOString(), ...(r.test && { test: true }) })
    if (contact && !f.publicGeneral) await saveFiscal(contact, rfc, fiscal)
    setOpen(false)
  }

  return (
    <section className="card form" aria-label="Factura electrónica">
      <h2><FileCheck2 className="i-inline" aria-hidden /> Factura electrónica · {money(sale.amountCents)}</h2>
      <label className="check"><input type="checkbox" checked={form.publicGeneral} onChange={(e) => set({ publicGeneral: e.target.checked })} /><span>Público en general (el cliente no pidió factura a su nombre)</span></label>
      {!form.publicGeneral && (
        <>
          <div className="two">
            <label>RFC<input value={form.rfc} onChange={(e) => set({ rfc: e.target.value.toUpperCase() })} autoCapitalize="characters" placeholder="XAXX010101000" /></label>
            <label>C.P. fiscal<input value={form.zip} onChange={(e) => set({ zip: e.target.value.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" placeholder="47600" /></label>
          </div>
          <label>Razón social <small className="muted">(exacta, como en su constancia fiscal, sin «S.A. de C.V.»)</small><input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} /></label>
          <label>Régimen fiscal<select value={form.taxSystem} onChange={(e) => set({ taxSystem: e.target.value })}>{TAX_SYSTEMS.map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}</select></label>
          <label>Uso del CFDI<select value={form.use} onChange={(e) => set({ use: e.target.value })}>{USES.map(([k, l]) => <option key={k} value={k}>{k} · {l}</option>)}</select></label>
          <label>Correo <small className="muted">(opcional, para mandarle la factura)</small><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></label>
          {form.email.trim() && <label className="check"><input type="checkbox" checked={form.send} onChange={(e) => set({ send: e.target.checked })} /><span>Mandársela por correo al timbrar</span></label>}
        </>
      )}
      <p className="muted">{pending ? 'Todavía debe: se factura como «pago en parcialidades» (PPD).' : `Pagada (${sale.paymentMethod === 'cash' ? 'efectivo' : sale.paymentMethod === 'transfer' ? 'transferencia' : sale.paymentMethod === 'card' ? 'tarjeta' : 'otro'}): se factura en una sola exhibición (PUE).`} Los conceptos son los de la venta.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => void run(stamp)}>{busy ? 'Timbrando…' : 'Timbrar factura'}</button>
      </div>
    </section>
  )
}
