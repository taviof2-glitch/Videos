import { useState } from 'react'
import type { SalePlan } from '../data/assistant'
import { formatMoney } from '../data/money'

/** La venta que preparó el asistente: se revisa y solo se guarda al confirmar. */
export default function SaleCard({ plan, currency, onConfirm, onCancel }: { plan: SalePlan; currency: string; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const money = (c: number) => formatMoney(c, currency)
  return (
    <section className="card form sale-card" aria-label="Venta por confirmar">
      <h2>Venta por confirmar</h2>
      <p><strong>Cliente:</strong> {plan.contact ? plan.contact.name : plan.newContact ? <>{plan.newContact} <span className="badge muted">nuevo</span></> : 'Sin cliente'}</p>
      <ul className="fixed-paid">
        {plan.lines.map((l, i) => (
          <li key={i}>
            {l.quantity} × {l.product ? l.product.name : l.newProduct!.name} {!l.product && <span className="badge muted">producto nuevo, sobre pedido</span>}
            {l.newProduct?.description && <small className="muted"> · {l.newProduct.description}</small>} — {money(Math.round(l.quantity * l.priceCents))}
          </li>
        ))}
      </ul>
      <p className="total-line">Total <strong>{money(plan.totalCents)}</strong></p>
      <p className="muted">{plan.credit ? `Fiado${plan.advanceCents ? `, con anticipo de ${money(plan.advanceCents)}` : ''}` : 'De contado'}{plan.asJob ? ' · se sigue en Obras' : ''}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="quick">
        <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn primary" disabled={busy} onClick={() => { setBusy(true); setError(''); void onConfirm().catch((e: unknown) => { setError(e instanceof Error ? e.message : 'No se pudo registrar'); setBusy(false) }) }}>{busy ? 'Guardando…' : 'Confirmar venta'}</button>
      </div>
    </section>
  )
}
