// Buscador general: clientes, proveedores, cotizaciones, obras, ventas, pedidos, productos y citas por nombre,
// teléfono, folio o concepto. Sin acentos ni mayúsculas.
import { db } from './db'
import { docNumber } from './folio'
import { listJobs, STAGE_LABEL } from './jobs'
import { formatMoney } from './money'
import type { Business } from './types'

export type Hit = { kind: 'cliente' | 'proveedor' | 'cotización' | 'obra' | 'venta' | 'gasto' | 'pedido' | 'producto' | 'cita'; title: string; detail: string; to: string; date?: string }

export const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** ¿Coincide? Cada palabra de la búsqueda debe aparecer; los números también se buscan en teléfonos sin espacios. */
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const hay = norm(fields.filter(Boolean).join(' '))
  const digits = hay.replace(/[^\d]/g, '')
  return words.every((w) => hay.includes(w) || (/^\d{3,}$/.test(w) && digits.includes(w)))
}

export async function searchAll(business: Business, query: string, max = 40): Promise<Hit[]> {
  const q = query.trim().replace(/^#/, '')
  if (q.length < 2 && !/^\d$/.test(q)) return []
  const money = (c: number) => formatMoney(c, business.currency)
  const id = business.id
  const [contacts, quotes, txns, orders, products, appts, jobs] = await Promise.all([
    db.contact.where('[businessId+type]').between([id, ''], [id, '￿']).filter((c) => !c.deletedAt).toArray(),
    db.quote.where('[businessId+status]').between([id, ''], [id, '￿']).filter((x) => !x.deletedAt).toArray(),
    db.txn.where('[businessId+date]').between([id, ''], [id, '￿']).filter((t) => !t.deletedAt).toArray(),
    db.order.where('[businessId+status]').between([id, ''], [id, '￿']).filter((o) => !o.deletedAt).toArray(),
    db.product.where('[businessId+name]').between([id, ''], [id, '\uffff']).filter((p) => !p.deletedAt).toArray(),
    db.appointment.where('businessId').equals(id).filter((a) => !a.deletedAt).toArray(),
    listJobs(id),
  ])
  const names = new Map(contacts.map((c) => [c.id, c.name]))
  const who = (cid?: string) => (cid && names.get(cid)) || ''
  const hits: Hit[] = []
  for (const c of contacts) if (matches(q, c.name, c.phone, c.documentId, c.address, c.notes)) hits.push({ kind: c.type === 'supplier' ? 'proveedor' : 'cliente', title: c.name, detail: [c.phone, c.address].filter(Boolean).join(' · '), to: `/${c.type === 'supplier' ? 'proveedores' : 'clientes'}/${c.id}` })
  for (const j of jobs) if (matches(q, j.title, j.folio, who(j.contactId), j.job.note, j.quote?.color)) hits.push({ kind: 'obra', title: `${j.title} · ${who(j.contactId)}`, detail: `${STAGE_LABEL[j.job.stage]}${j.job.deliveryDate ? ` · entrega ${j.job.deliveryDate}` : ''} · ${money(j.totalCents)}`, to: '/obras', date: j.job.startedAt })
  for (const x of quotes) if (!x.job && matches(q, x.title, String(x.number), docNumber(x), who(x.contactId))) hits.push({ kind: 'cotización', title: `${docNumber(x)} ${x.title || 'Cotización'}`, detail: `${who(x.contactId)} · ${money(x.totalCents)}`, to: `/cotizaciones/${x.id}`, date: x.createdAt })
  for (const t of txns) if (matches(q, t.concept, who(t.contactId), String(Math.round(t.amountCents / 100)))) hits.push({ kind: t.type === 'sale' ? 'venta' : 'gasto', title: t.concept || (t.type === 'sale' ? 'Venta' : 'Gasto'), detail: `${who(t.contactId) ? `${who(t.contactId)} · ` : ''}${money(t.amountCents)} · ${t.date.slice(0, 10)}${t.status === 'credit' ? (t.type === 'sale' ? ' · fiado' : ' · a crédito') : ''}`, to: `/${t.type === 'sale' ? 'venta' : 'gasto'}/${t.id}`, date: t.date })
  for (const o of orders) if (matches(q, o.customerName, String(o.number), o.notes)) hits.push({ kind: 'pedido', title: `Pedido #${o.number} · ${o.customerName || 'sin nombre'}`, detail: `${o.status === 'pending' ? 'pendiente' : o.status}${o.totalCents ? ` · ${money(o.totalCents)}` : ''}`, to: `/pedidos/${o.id}`, date: o.createdAt })
  for (const p of products) if (matches(q, p.name, p.description, p.barcode)) hits.push({ kind: 'producto', title: p.name, detail: money(p.priceCents), to: `/inventario/${p.id}` })
  for (const a of appts) if (matches(q, a.title, who(a.contactId), a.address, a.note)) hits.push({ kind: 'cita', title: `${a.title || who(a.contactId)}`, detail: `${a.date}${a.time ? ` ${a.time}` : ''}${a.address ? ` · ${a.address}` : ''}`, to: '/agenda', date: a.date })
  // Primero lo que coincide en el título; luego lo más reciente.
  const inTitle = (h: Hit) => (matches(q, h.title) ? 0 : 1)
  return hits.sort((a, b) => inTitle(a) - inTitle(b) || (b.date ?? '').localeCompare(a.date ?? '')).slice(0, max)
}
