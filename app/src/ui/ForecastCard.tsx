import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { formatDay } from '../data/dates'
import { loadForecast } from '../data/forecast'
import { formatMoney } from '../data/money'
import type { Business } from '../data/types'

/** Dinero de las próximas 4 semanas: lo que entra contra lo que sale, semana por semana. */
export default function ForecastCard({ business, today }: { business: Business; today: string }) {
  const f = useLiveQuery(() => loadForecast(business, today), [business, today])
  const [open, setOpen] = useState<number>()
  if (!f) return null
  const money = (c: number) => formatMoney(c, business.currency)
  return (
    <section className="card">
      <h2>Dinero de las próximas 4 semanas</h2>
      <p className="muted">Entra: saldos de obras (en su fecha de entrega) y fiados con fecha. Sale: pagos del taller y proveedores a crédito.</p>
      {f.tight
        ? <p className="note-box bad">⚠️ La semana del {formatDay(f.tight.from)} se ve apretada: lo que sale supera lo que entra en {money(-f.tight.runningCents)}. Conviene cobrar saldos antes o mover un pago.</p>
        : <p className="note-box">✓ Ninguna semana se ve apretada con lo que tienes anotado.</p>}
      <ul className="moves">
        {f.weeks.map((w, i) => (
          <li key={w.from} style={{ display: 'grid', gap: 4 }}>
            <button type="button" className="row-between plain" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }} aria-expanded={open === i} onClick={() => setOpen(open === i ? undefined : i)}>
              <span>{i === 0 ? 'Esta semana' : `${formatDay(w.from)} – ${formatDay(w.to)}`}<small className="muted"> · entra {money(w.inCents)} · sale {money(w.outCents)}</small></span>
              <strong className={w.netCents < 0 ? 'neg' : 'pos'}>{money(w.netCents)}</strong>
            </button>
            {open === i && (
              <small className="muted">
                {w.ins.map((x) => `+ ${x.label} ${money(x.cents)}`).concat(w.outs.map((x) => `− ${x.label} ${money(x.cents)}`)).join(' · ') || 'Nada anotado esta semana.'}
              </small>
            )}
          </li>
        ))}
      </ul>
      {(f.undatedInCents > 0 || f.undatedOutCents > 0) && <small className="muted">Sin fecha (no se cuenta arriba): por cobrar {money(f.undatedInCents)}{f.undatedOutCents ? `, por pagar ${money(f.undatedOutCents)}` : ''}. Pon fecha de entrega a las obras para que salga más exacto.</small>}
    </section>
  )
}
