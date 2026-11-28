import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { formatMoney } from '../data/money'
import { estimateTaxes, monthMoney, saveTax, taxOf, type TaxSettings } from '../data/taxes'
import type { Business } from '../data/types'

/** Impuestos aproximados del mes: lo que conviene apartar (no sustituye al contador). */
export default function TaxCard({ business, today }: { business: Business; today: string }) {
  const [s, setS] = useState<TaxSettings>(() => taxOf(business))
  const money = useLiveQuery(() => monthMoney(business.id, today, business.timezone), [business.id, today, business.timezone])
  const fmt = (c: number) => formatMoney(c, business.currency)
  const set = (p: Partial<TaxSettings>) => { const next = { ...s, ...p }; setS(next); void saveTax(business.id, next) }
  const t = money && s.regime !== 'ninguno' ? estimateTaxes(s, money.incomeCents, money.expenseCents) : undefined
  return (
    <section className="card form">
      <h2>Impuestos del mes (aproximado)</h2>
      <div className="two">
        <label>Régimen<select value={s.regime} onChange={(e) => set({ regime: e.target.value as TaxSettings['regime'] })}><option value="resico">RESICO</option><option value="actividad">Actividad empresarial</option><option value="ninguno">No calcular</option></select></label>
        <label>Gastos con factura (%)<input value={s.invoicedPct} onChange={(e) => set({ invoicedPct: Math.min(100, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0)) })} inputMode="numeric" /></label>
      </div>
      <label className="check"><input type="checkbox" checked={s.chargesIva} onChange={(e) => set({ chargesIva: e.target.checked })} /><span>Mis precios incluyen IVA (lo cobro y lo declaro)</span></label>
      {t && (
        <>
          <p className="muted">Cobrado este mes {fmt(t.incomeCents)}{s.chargesIva ? ` (sin IVA ${fmt(t.baseCents)})` : ''} · pagado {fmt(t.expenseCents)}.</p>
          <div className="fixed-totals">
            <div><small className="muted">ISR{t.isrRate ? ` (${(t.isrRate * 100).toFixed(1)} %)` : ''}</small><strong>{fmt(t.isrCents)}</strong></div>
            <div><small className="muted">IVA</small><strong>{fmt(t.ivaCents)}</strong></div>
            <div><small className="muted">Apartar</small><strong className="amount expense">{fmt(t.totalCents)}</strong></div>
          </div>
        </>
      )}
      <small className="muted">Es un cálculo aproximado con lo que registras en la app, para que sepas cuánto apartar. La declaración la hace tu contador.{s.regime === 'actividad' ? ' En actividad empresarial se usa ~20 % de la utilidad como estimado.' : ''}</small>
    </section>
  )
}
