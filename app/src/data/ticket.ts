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

export async function applyTicket(businessId: string, input: TicketApply): Promise<TicketResult> {
  const supplier = input.supplier.trim()
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
      const found = (await listContacts(businessId, 'supplier')).find((c) => c.name.localeCompare(supplier, 'es', { sensitivity: 'base' }) === 0)
      contactId = found?.id ?? (await createContact(businessId, 'supplier', { name: supplier })).id
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
