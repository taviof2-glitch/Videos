// Registrar lo que se leyó de un ticket de compra: suma al «Material del taller» (o lo da de alta),
// guarda el precio de ese proveedor y, si se quiere, anota el gasto (con proveedor y obra).
import { ensureCategory } from './categories'
import { createContact, listContacts } from './contacts'
import { db } from './db'
import { listMaterials } from './materials'
import { createExpense } from './transactions'
import type { PaymentMethod, Transaction, WorkMaterial } from './types'

export type TicketApplyLine = {
  /** Material que ya existe; vacío para darlo de alta con `name` y `unit`. */
  materialId: string
  name: string
  unit: string
  quantity: number
  unitCents: number
}

export type TicketApply = {
  supplier: string
  date?: string
  lines: TicketApplyLine[]
  /** Anotar el gasto (lo normal). */
  expense?: { amountCents: number; method: PaymentMethod; jobId?: string }
}

export type TicketResult = { updated: number; created: number; expense?: Transaction }

/** «MAXIMADERAS, S.A. DE C.V.» → «maximaderas» (para reconocer al mismo proveedor escrito distinto). */
export function supplierKey(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    .replace(/\b(s\.?\s?a\.?|de|c\.?\s?v\.?|s\.?\s?de\s?r\.?\s?l\.?|sapi|sab|y|cia|hnos?|hermanos)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
}

/** El proveedor guardado que es el mismo (igual o uno contiene al otro), si existe. */
export function matchSupplier<T extends { name: string }>(name: string, list: T[]): T | undefined {
  const k = supplierKey(name)
  if (k.length < 3) return undefined
  return list.find((c) => supplierKey(c.name) === k) ?? list.find((c) => { const o = supplierKey(c.name); return o.length >= 4 && (k.includes(o) || o.includes(k)) })
}

export async function applyTicket(businessId: string, input: TicketApply): Promise<TicketResult> {
  // Si ya existe el proveedor (aunque el ticket lo escriba distinto), se usa su nombre guardado.
  const known = input.supplier.trim() ? matchSupplier(input.supplier, await listContacts(businessId, 'supplier')) : undefined
  const supplier = known?.name ?? input.supplier.trim()
  const lines = input.lines.filter((l) => l.quantity > 0)
  if (!lines.length && !input.expense) throw new Error('No hay nada que registrar')
  let updated = 0
  let created = 0
  await db.transaction('rw', db.business, async () => {
    const business = await db.business.get(businessId)
    if (!business) throw new Error('Negocio no encontrado')
    const list: WorkMaterial[] = listMaterials(business).map((m) => ({ ...m, prices: [...m.prices] }))
    for (const l of lines) {
      const price = Math.round(l.unitCents)
      let m = l.materialId ? list.find((x) => x.id === l.materialId) : list.find((x) => x.name.localeCompare(l.name.trim(), 'es', { sensitivity: 'base' }) === 0)
      if (!m) {
        const name = l.name.trim()
        if (!name) throw new Error('A un artículo le falta el nombre')
        m = { id: crypto.randomUUID(), name, unit: l.unit || 'piezas', stock: 0, prices: [] }
        list.push(m)
        created++
      } else updated++
      m.stock = Math.round((m.stock + l.quantity) * 100) / 100
      if (supplier && price > 0) m.prices = [...m.prices.filter((p) => p.supplier.localeCompare(supplier, 'es', { sensitivity: 'base' }) !== 0), { supplier, priceCents: price }]
    }
    await db.business.update(businessId, { materials: list, updatedAt: new Date().toISOString() })
  })

  let expense: Transaction | undefined
  if (input.expense && input.expense.amountCents > 0) {
    const category = await ensureCategory(businessId, 'expense', 'Material')
    let contactId: string | undefined
    if (supplier) {
      contactId = known?.id ?? (await createContact(businessId, 'supplier', { name: supplier })).id
    }
    const what = lines.map((l) => l.name.trim()).filter(Boolean).slice(0, 4).join(', ')
    expense = await createExpense(businessId, {
      amountCents: input.expense.amountCents,
      concept: `Ticket${supplier ? ` ${supplier}` : ''}${what ? `: ${what}${lines.length > 4 ? '…' : ''}` : ''}`.slice(0, 140),
      categoryId: category.id, paymentMethod: input.expense.method, contactId, jobId: input.expense.jobId || undefined,
      ...(input.date && { date: `${input.date}T12:00:00` }),
    })
  }
  return { updated, created, expense }
}
