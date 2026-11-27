import { beforeEach, describe, expect, it } from 'vitest'
import { createBusiness } from './business'
import { DEFAULT_SPECS } from './cutlist'
import { db } from './db'
import { startJob } from './jobs'
import { saveMaterial } from './materials'
import { bySupplier, orderMessage, purchaseList, syncQuoterPrices } from './purchaseList'
import { quoterSettings, saveQuoterQuote } from './quoter'

let bizId: string
const fresh = async () => (await db.business.get(bizId))!
const tv = { type: 'tv', q: 1, km: 0, suave: true, pint: false, cub: false, xmat: 0, xhrs: 0, med: DEFAULT_SPECS.tv }
const x = { customer: 'Ana', description: '', delivery: '2 semanas', iva: false, ivaRate: 16, phone: '' }

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  bizId = (await createBusiness({ name: 'Taller' })).id
})

describe('pedido de material', () => {
  it('junta las obras por arrancar, resta lo que hay y reparte por el proveedor más barato', async () => {
    await saveMaterial(bizId, { name: 'Hoja de melamina 16 mm', unit: 'hojas', stock: 1, prices: [{ supplier: 'Erlo', priceCents: 95000 }, { supplier: 'Maximaderas', priceCents: 89000 }] })
    await saveMaterial(bizId, { name: 'Tornillos', unit: 'cajas', stock: 0, min: 2, prices: [] })
    const a = await saveQuoterQuote(await fresh(), tv, x)
    const b = await saveQuoterQuote(await fresh(), tv, { ...x, customer: 'Luis' })
    await startJob(a.id)
    await startJob(b.id)
    const list = await purchaseList(await fresh())
    const sheets = list.find((l) => l.name === 'Hoja de melamina 16 mm')!
    expect(sheets).toMatchObject({ need: 4, have: 1, buy: 3, supplier: 'Maximaderas', priceCents: 89000 })
    expect(list.find((l) => l.name === 'Tornillos')).toMatchObject({ need: 0, buy: 2 })
    const groups = bySupplier(list)
    expect(groups[0].supplier).toBe('Maximaderas')
    expect(orderMessage('House Lite', groups[0].lines)).toContain('• 3 hojas de Hoja de melamina 16 mm')
  })
  it('el ticket deja al día los precios del cotizador', async () => {
    await db.business.update(bizId, { quoter: { mats: [{ n: 'Nogal Tzalam', hoja: 900 }] } })
    const changes = await syncQuoterPrices(bizId, [
      { name: 'Hoja de MDF 15 mm con melamina nogal Tzalam', unit: 'hojas', unitCents: 48934 },
      { name: 'Hoja de MDF 15 mm con melamina negro Titanium', unit: 'hojas', unitCents: 48934 },
      { name: 'Hoja de fondo 3 mm', unit: 'hojas', unitCents: 32000 },
      { name: 'Bisagras', unit: 'piezas', unitCents: 3000 },
    ])
    expect(changes).toHaveLength(3)
    const { mats, cfg } = quoterSettings(await fresh())
    expect(mats.find((m) => m.n === 'Nogal Tzalam')?.hoja).toBe(489.34)
    expect(mats.some((m) => /negro Titanium/.test(m.n))).toBe(true)
    expect(cfg.fondo).toBe(320)
  })
})
