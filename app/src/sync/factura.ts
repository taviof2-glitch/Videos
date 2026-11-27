// Factura electrónica: habla con api/factura.ts (que timbra con Facturapi).
import type { FiscalData } from '../data/types'
import { sessionToken } from './runner'

async function token(): Promise<string> {
  if (!navigator.onLine) throw new Error('Sin conexión. Para facturar se necesita internet.')
  const t = await sessionToken().catch(() => undefined)
  if (!t) throw new Error('Entra a tu cuenta en «Cuenta y nube» para facturar.')
  return t
}

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch('/api/factura', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) })
  const out = (await res.json().catch(() => null)) as (T & { message?: string }) | null
  if (!res.ok || !out) throw new Error(out?.message ?? 'No se pudo hacer la factura. Intenta de nuevo.')
  return out
}

export type CreatedInvoice = { id: string; uuid: string; series: string; folio: string; total: number; status: string; test: boolean }

export const createInvoice = (input: {
  customer?: FiscalData & { rfc: string }
  publicGeneral: boolean
  use: string
  paymentForm: string
  paymentMethod: 'PUE' | 'PPD'
  items: { description: string; quantity: number; unitPrice: number }[]
  taxIncluded: boolean
  productKey: string
  externalId: string
  sendTo?: string
}) => post<CreatedInvoice>({ action: 'create', ...input, customer: input.customer && { legalName: input.customer.legalName, rfc: input.customer.rfc, taxSystem: input.customer.taxSystem, zip: input.customer.zip, email: input.customer.email } })

export const emailInvoice = (id: string, email?: string) => post<{ ok: boolean }>({ action: 'email', id, email })
export const cancelInvoice = (id: string, motive = '02') => post<{ status: string; cancellation: string }>({ action: 'cancel', id, motive })

export async function downloadInvoice(id: string, f: 'pdf' | 'xml'): Promise<Blob> {
  const res = await fetch(`/api/factura?id=${encodeURIComponent(id)}&f=${f}`, { headers: { Authorization: `Bearer ${await token()}` } })
  if (!res.ok) {
    const out = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(out?.message ?? 'No se pudo descargar la factura.')
  }
  return res.blob()
}
