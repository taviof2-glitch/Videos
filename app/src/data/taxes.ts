// Estimación de impuestos del mes con lo cobrado y lo pagado. Aproximada: solo para saber cuánto apartar.
import { db } from './db'
import { listPayments } from './debts'
import { periodRange } from './dates'
import { listTransactions } from './transactions'
import type { Business } from './types'

export type TaxSettings = NonNullable<Business['tax']>
export const DEFAULT_TAX: TaxSettings = { regime: 'resico', chargesIva: false, invoicedPct: 50 }
export const taxOf = (b: Pick<Business, 'tax'>): TaxSettings => ({ ...DEFAULT_TAX, ...b.tax })

/** RESICO personas físicas: tasa según lo cobrado en el mes (sin IVA). */
export function resicoRate(monthlyIncomeCents: number): number {
  const pesos = monthlyIncomeCents / 100
  if (pesos <= 25_000) return 0.01
  if (pesos <= 50_000) return 0.011
  if (pesos <= 83_333.33) return 0.015
  if (pesos <= 208_333.33) return 0.02
  return 0.025
}

export type TaxEstimate = { incomeCents: number; expenseCents: number; baseCents: number; ivaCents: number; isrCents: number; isrRate?: number; totalCents: number }

export function estimateTaxes(s: TaxSettings, incomeCents: number, expenseCents: number): TaxEstimate {
  const base = s.chargesIva ? Math.round(incomeCents / 1.16) : incomeCents
  const ivaOut = incomeCents - base
  const ivaIn = s.chargesIva ? Math.round(((expenseCents * Math.min(100, Math.max(0, s.invoicedPct))) / 100) * (16 / 116)) : 0
  const iva = Math.max(0, ivaOut - ivaIn)
  let isr = 0
  let rate: number | undefined
  if (s.regime === 'resico') { rate = resicoRate(base); isr = Math.round(base * rate) }
  if (s.regime === 'actividad') {
    // Muy aproximado: ~20 % de la utilidad (lo cobrado sin IVA menos los gastos con factura sin IVA).
    const deductible = Math.round(((expenseCents * Math.min(100, Math.max(0, s.invoicedPct))) / 100) / (s.chargesIva ? 1.16 : 1))
    isr = Math.max(0, Math.round((base - deductible) * 0.2))
  }
  return { incomeCents, expenseCents, baseCents: base, ivaCents: iva, isrCents: isr, ...(rate && { isrRate: rate }), totalCents: iva + isr }
}

/** Lo cobrado y lo pagado de verdad en el mes (contado, abonos, gastos pagados y pagos a proveedores). */
export async function monthMoney(businessId: string, anchor: string, timeZone: string): Promise<{ incomeCents: number; expenseCents: number }> {
  const range = periodRange('month', anchor, timeZone)
  const [rows, payments] = await Promise.all([listTransactions(businessId, range), listPayments(businessId, range)])
  let incomeCents = 0, expenseCents = 0
  for (const t of rows) if (t.status === 'paid') t.type === 'sale' ? (incomeCents += t.amountCents) : (expenseCents += t.amountCents)
  for (const p of payments) p.direction === 'in' ? (incomeCents += p.amountCents) : (expenseCents += p.amountCents)
  return { incomeCents, expenseCents }
}

export async function saveTax(businessId: string, s: TaxSettings): Promise<void> {
  await db.business.update(businessId, { tax: s, updatedAt: new Date().toISOString() })
}
