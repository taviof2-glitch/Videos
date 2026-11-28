// Factura electrónica (CFDI 4.0): lo que la app guarda. El timbrado lo hace api/factura.ts con Facturapi.
import { db } from './db'
import { lineNet } from './transactions'
import type { Contact, FiscalData, InvoicingSettings, SaleInvoice, Transaction, TransactionItem } from './types'

export const TAX_SYSTEMS: [string, string][] = [
  ['612', 'Persona física con actividad empresarial'], ['626', 'RESICO (Régimen Simplificado de Confianza)'], ['605', 'Sueldos y salarios'],
  ['606', 'Arrendamiento'], ['616', 'Sin obligaciones fiscales'], ['621', 'Incorporación fiscal'], ['601', 'Persona moral (general de ley)'],
  ['603', 'Persona moral sin fines de lucro'], ['625', 'Plataformas tecnológicas'], ['608', 'Demás ingresos'],
]
export const USES: [string, string][] = [['G03', 'Gastos en general'], ['G01', 'Adquisición de mercancías'], ['I02', 'Mobiliario y equipo de oficina'], ['S01', 'Sin efectos fiscales'], ['CP01', 'Pagos']]
export const PAYMENT_FORM: Record<Transaction['paymentMethod'], string> = { cash: '01', transfer: '03', card: '04', other: '99' }
export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

export const DEFAULT_INVOICING: InvoicingSettings = { enabled: false, zip: '', productKey: '01010101', taxIncluded: true }
export const invoicingOf = (b: { invoicing?: InvoicingSettings }): InvoicingSettings => ({ ...DEFAULT_INVOICING, ...b.invoicing })

export async function saveInvoicing(businessId: string, s: InvoicingSettings): Promise<void> {
  if (s.enabled && !/^\d{5}$/.test(s.zip)) throw new Error('Escribe el código postal fiscal del negocio (5 números)')
  if (!/^\d{8}$/.test(s.productKey)) throw new Error('La clave del SAT debe tener 8 números')
  await db.business.update(businessId, { invoicing: s, updatedAt: new Date().toISOString() })
}

/** Guarda en el cliente su RFC y datos fiscales para la próxima vez. */
export async function saveFiscal(contact: Contact, rfc: string, fiscal: FiscalData): Promise<void> {
  await db.contact.update(contact.id, { documentId: rfc.trim().toUpperCase(), fiscal: { ...fiscal, legalName: fiscal.legalName.trim() }, updatedAt: new Date().toISOString() })
}

export async function setSaleInvoice(saleId: string, invoice: SaleInvoice): Promise<void> {
  await db.txn.update(saleId, { invoice, updatedAt: new Date().toISOString() })
}

/** Conceptos de la factura: las líneas de la venta (con descuento repartido) o el concepto si fue venta rápida. */
export function invoiceItems(sale: Transaction, items: TransactionItem[]): { description: string; quantity: number; unitPrice: number }[] {
  if (!items.length) return [{ description: sale.concept || 'Venta', quantity: 1, unitPrice: sale.amountCents / 100 }]
  return items.map((i) => {
    const net = lineNet(i)
    return { description: i.name, quantity: i.quantity, unitPrice: Math.round(net / i.quantity) / 100 }
  })
}
