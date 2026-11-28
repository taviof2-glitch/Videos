// Campañas de temporada: un mensaje para clientes que ya compraron. No se manda nada solo: el dueño toca
// «WhatsApp» con cada cliente y el mensaje se abre listo para enviar.
import { db } from './db'
import type { Contact } from './types'

export type Campaign = { key: string; name: string; text: string }

export const CAMPAIGNS: Campaign[] = [
  { key: 'navidad', name: 'Navidad y fin de año', text: 'Hola {nombre} 👋, le saluda {negocio}. Se acercan las fiestas: si quiere estrenar cocina, closet o mueble de TV antes de Navidad, todavía hay lugares en el taller. ¿Le preparo una cotización sin compromiso?' },
  { key: 'aguinaldo', name: 'Aguinaldo', text: 'Hola {nombre}, le saluda {negocio}. Aproveche su aguinaldo para el mueble que tiene pendiente: le damos facilidades con anticipo y abonos. ¿Le mando una cotización?' },
  { key: 'madres', name: 'Día de las Madres', text: 'Hola {nombre} 🌷, le saluda {negocio}. Para el 10 de mayo, una cocina o un closet nuevo es el regalo que dura años. Agende su visita para medir sin costo.' },
  { key: 'clases', name: 'Regreso a clases', text: 'Hola {nombre}, le saluda {negocio}. Para el regreso a clases hacemos escritorios, libreros y repisas a la medida del cuarto de los niños. ¿Le cotizo uno?' },
  { key: 'buenfin', name: 'Buen Fin', text: 'Hola {nombre}, le saluda {negocio}. Este Buen Fin tenemos precio especial en muebles a la medida que se aparten con anticipo. ¿Le interesa que le cotice algo?' },
  { key: 'gracias', name: 'Gracias y recomendación', text: 'Hola {nombre}, le saluda {negocio}. Gracias otra vez por su confianza. Si algún familiar o amigo necesita muebles a la medida, con gusto lo atendemos. ¿Todo bien con su mueble?' },
]

export const fillCampaign = (text: string, o: { name: string; business: string }) => text.replaceAll('{nombre}', o.name.split(' ')[0] || '').replaceAll('{negocio}', o.business)

export type CampaignTarget = { contact: Contact; lastBuy: string; total: number }

/** Clientes con teléfono que compraron alguna vez (o en los últimos `months` meses), del más reciente al más viejo. */
export async function campaignTargets(businessId: string, contacts: Contact[], months?: number, today = new Date().toISOString().slice(0, 10)): Promise<CampaignTarget[]> {
  const sales = await db.txn.where('[businessId+type]').equals([businessId, 'sale']).filter((t) => !t.deletedAt && !!t.contactId).toArray()
  const by = new Map<string, { lastBuy: string; total: number }>()
  for (const t of sales) {
    const cur = by.get(t.contactId!) ?? { lastBuy: '', total: 0 }
    by.set(t.contactId!, { lastBuy: t.date > cur.lastBuy ? t.date : cur.lastBuy, total: cur.total + t.amountCents })
  }
  const since = months ? new Date(Date.parse(`${today}T12:00:00Z`) - months * 30.44 * 86_400_000).toISOString().slice(0, 10) : ''
  return contacts
    .filter((c) => !c.deletedAt && (c.phone ?? '').replace(/\D/g, '').length >= 10 && by.has(c.id) && by.get(c.id)!.lastBuy.slice(0, 10) >= since)
    .map((c) => ({ contact: c, ...by.get(c.id)! }))
    .sort((a, b) => b.lastBuy.localeCompare(a.lastBuy))
}

const sentKey = (key: string) => `campaign:${key}:${new Date().getFullYear()}`

/** A quién ya se le mandó esta campaña este año (solo en este aparato). */
export async function campaignSent(key: string): Promise<string[]> {
  const v = (await db.meta.get(sentKey(key)))?.value
  try { return v ? (JSON.parse(v) as string[]) : [] } catch { return [] }
}

export async function markCampaignSent(key: string, contactId: string): Promise<void> {
  const cur = await campaignSent(key)
  if (!cur.includes(contactId)) await db.meta.put({ key: sentKey(key), value: JSON.stringify([...cur, contactId]) })
}
