// Avisos push al equipo: obra nueva, venta registrada, abono recibido (desde cualquier pantalla que los haga).
import { getContact, listContacts } from '../data/contacts'
import { contactBalance, contactDebts } from '../data/debts'
import { formatMoney } from '../data/money'
import { getTransaction } from '../data/transactions'
import type { Business } from '../data/types'
import { METHOD_LABEL } from './forms'
import { listJobs, STAGE_LABEL } from '../data/jobs'
import type { Actor } from '../data/team'
import { jobNotice, notifyTeam } from '../sync/push'

export async function notifyNewJob(businessId: string, jobId: string, actor: Actor): Promise<void> {
  const job = (await listJobs(businessId)).find((j) => j.id === jobId)
  if (!job) return
  const customer = job.contactId ? ((await listContacts(businessId, 'customer')).find((c) => c.id === job.contactId)?.name ?? '') : ''
  notifyTeam(businessId, jobNotice({ customer, title: job.title, stageLabel: STAGE_LABEL[job.job.stage], by: actor.name, isNew: true }), actor.id)
}

// Ventas y abonos: le llegan a todo el equipo, también al teléfono que la registró.
const fmt = (c: number, currency: string) => formatMoney(c, currency)

export async function notifySale(business: Business, saleId: string, actor: Actor): Promise<void> {
  const sale = await getTransaction(saleId)
  if (!sale || sale.type !== 'sale') return
  const contact = sale.contactId ? await getContact(sale.contactId) : undefined
  const debt = sale.status === 'credit' && sale.contactId ? (await contactDebts(sale.contactId)).find((i) => i.txn.id === saleId) : undefined
  const how = sale.status === 'credit' ? `Fiado${debt?.paidCents ? `, anticipo ${fmt(debt.paidCents, business.currency)}` : ''}` : `De contado (${METHOD_LABEL[sale.paymentMethod].toLowerCase()})`
  notifyTeam(business.id, {
    title: `Venta registrada · ${fmt(sale.amountCents, business.currency)}`,
    body: [contact?.name, sale.concept, how, `registró ${actor.name}`].filter(Boolean).join(' · '),
    url: `/venta/${sale.id}`,
  }, actor.id, true)
}

/** Abono o anticipo de un cliente (lo que se le paga a proveedores no avisa). */
export async function notifyPayment(business: Business, contactId: string, cents: number, actor: Actor, advance = false): Promise<void> {
  const contact = await getContact(contactId)
  if (!contact || contact.type !== 'customer') return
  const left = await contactBalance(contactId)
  notifyTeam(business.id, {
    title: `${advance ? 'Anticipo' : 'Abono'} recibido · ${fmt(cents, business.currency)}`,
    body: `${contact.name} · ${left > 0 ? `le falta ${fmt(left, business.currency)}` : 'ya no debe nada'} · registró ${actor.name}`,
    url: `/deudas/${contactId}`,
  }, actor.id, true)
}
