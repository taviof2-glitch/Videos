// Reglas del servidor (app/supabase/migrations/0001_sync.sql) contra un Postgres real.
// Se saltan sin SYNC_PG_URL; ver replica/sync-design.md.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestServer, PG_URL, type TestServer } from './pgTestServer'

const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

type PullRow = { tbl: string; id: string; parent_id: string | null; data: Record<string, unknown>; deleted_at: string | null; rev: string }

describe.skipIf(!PG_URL)('servidor de sincronización', () => {
  let s: TestServer
  const owner = uuid()
  const stranger = uuid()
  const biz = uuid()
  const row = (extra: Record<string, unknown>) => ({ id: uuid(), businessId: biz, createdAt: now(), updatedAt: now(), ...extra })
  const push = (changes: unknown[], user = owner) => s.rpc<{ tbl: string; id: string; number: number }[]>(user, 'sync_push', [biz, changes])
  const pull = async (after = 0, user = owner) => s.rpc<PullRow[]>(user, 'sync_pull', [biz, after, 1000])
  const find = async (tbl: string, id: string) => (await pull()).find((r) => r.tbl === tbl && r.id === id)

  beforeAll(async () => {
    s = await createTestServer()
  })
  afterAll(async () => {
    await s?.close()
  })

  it('el primero que sube un negocio queda como dueño y nadie más entra', async () => {
    expect(await s.rpc(owner, 'sync_business_status', [biz])).toBe('unclaimed')
    expect(await s.rpc(owner, 'sync_claim_business', [biz])).toBe('member')
    expect(await s.rpc(owner, 'sync_claim_business', [biz])).toBe('member')
    expect(await s.rpc(stranger, 'sync_business_status', [biz])).toBe('forbidden')
    await expect(s.rpc(stranger, 'sync_claim_business', [biz])).rejects.toThrow(/forbidden/)
    await expect(push([], stranger)).rejects.toThrow(/forbidden/)
    await expect(pull(0, stranger)).rejects.toThrow(/forbidden/)
  })

  it('sin sesión no se puede llamar nada ni leer las tablas', async () => {
    await expect(s.rpc(null, 'sync_pull', [biz, 0, 10])).rejects.toThrow(/permission denied/)
    await expect(s.rpc(null, 'sync_claim_business', [biz])).rejects.toThrow(/permission denied/)
    await expect(s.queryAs(owner, 'select * from sync_row')).rejects.toThrow(/permission denied/)
    await expect(s.queryAs(owner, 'select * from business_counter')).rejects.toThrow(/permission denied/)
    await expect(s.rpc(owner, 'sync_apply_row', [biz, 'contact', {}])).rejects.toThrow(/permission denied/)
    // Solo ve su propia membresía.
    expect(await s.queryAs(owner, 'select business_id from business_member')).toHaveLength(1)
    expect(await s.queryAs(stranger, 'select business_id from business_member')).toHaveLength(0)
  })

  it('el negocio y las filas deben ser de ese negocio', async () => {
    await push([{ tbl: 'business', row: { id: biz, name: 'Taller', createdAt: now(), updatedAt: now() } }])
    await expect(push([{ tbl: 'business', row: { id: uuid(), name: 'Otro' } }])).rejects.toThrow(/bad_business/)
    await expect(push([{ tbl: 'contact', row: { ...row({ name: 'X' }), businessId: uuid() } }])).rejects.toThrow(/bad_business/)
    await expect(push([{ tbl: 'meta', row: row({}) }])).rejects.toThrow(/bad_table/)
  })

  it('entidades: gana la última escritura que llega y el borrado gana', async () => {
    const c = row({ type: 'customer', name: 'Ana', phone: '' })
    await push([{ tbl: 'contact', row: c }])
    await push([{ tbl: 'contact', row: { ...c, name: 'Ana López' } }])
    expect((await find('contact', c.id))?.data.name).toBe('Ana López')
    const deletedAt = now()
    await push([{ tbl: 'contact', row: { ...c, name: 'Ana López', deletedAt } }])
    // Otro dispositivo, sin enterarse del borrado, la edita: se descarta.
    await push([{ tbl: 'contact', row: { ...c, name: 'Ana L.' } }])
    const got = await find('contact', c.id)
    expect(got?.data.name).toBe('Ana López')
    expect(got?.deleted_at).not.toBeNull()
  })

  it('libro: solo se añade; lo único que cambia después es anular', async () => {
    const m = { id: uuid(), businessId: biz, productId: uuid(), delta: -2, reason: 'sale', createdAt: now() }
    await push([{ tbl: 'stockMovement', row: m }])
    await push([{ tbl: 'stockMovement', row: { ...m, delta: -5 } }])
    expect((await find('stockMovement', m.id))?.data.delta).toBe(-2)
    const p = row({ transactionId: uuid(), contactId: uuid(), batchId: uuid(), direction: 'in', amountCents: 5000, method: 'cash', date: now() })
    await push([{ tbl: 'payment', row: p }])
    const deletedAt = now()
    await push([{ tbl: 'payment', row: { ...p, deletedAt } }])
    await push([{ tbl: 'payment', row: p }]) // un dispositivo atrasado no la "revive"
    const got = await find('payment', p.id)
    expect(got?.deleted_at).not.toBeNull()
    expect(got?.data.deletedAt).toBe(deletedAt)
    expect(got?.data.amountCents).toBe(5000)
  })

  it('documentos: las líneas viajan con el padre y se reemplazan en bloque', async () => {
    const t = row({ type: 'sale', amountCents: 300, concept: 'Venta', date: now(), paymentMethod: 'cash', status: 'paid' })
    const a = { id: uuid(), transactionId: t.id, name: 'A', quantity: 1, unitPriceCents: 100, unitCostCents: 50, position: 0 }
    const b = { id: uuid(), transactionId: t.id, name: 'B', quantity: 1, unitPriceCents: 200, unitCostCents: 50, position: 1 }
    await push([{ tbl: 'txn', row: t }, { tbl: 'txnItem', parentId: t.id, rows: [a, b] }])
    const [{ max }] = await s.admin('select max(rev)::text as max from sync_row')
    // Al editar la venta, la app borra las líneas y crea otras nuevas.
    const c = { ...a, id: uuid(), quantity: 3 }
    await push([{ tbl: 'txn', row: t }, { tbl: 'txnItem', parentId: t.id, rows: [c] }])
    const changed = await pull(Number(max))
    const items = changed.filter((r) => r.tbl === 'txnItem')
    expect(items.map((r) => [r.data.name, r.data.quantity, r.deleted_at !== null]).sort()).toEqual([['A', 1, true], ['A', 3, false], ['B', 1, true]])
    expect(items.every((r) => r.parent_id === t.id)).toBe(true)
    // Repetir el mismo envío no cambia nada (reintento tras un corte).
    const [{ max: max2 }] = await s.admin('select max(rev)::text as max from sync_row')
    await push([{ tbl: 'txnItem', parentId: t.id, rows: [c] }])
    expect((await pull(Number(max2))).filter((r) => r.tbl === 'txnItem')).toHaveLength(0)
    // Líneas sin documento: error.
    await expect(push([{ tbl: 'txnItem', parentId: uuid(), rows: [] }])).rejects.toThrow(/missing_parent/)
  })

  it('folios: el servidor asigna los pendientes y nunca repite', async () => {
    const quote = (extra: Record<string, unknown>) => row({ title: 'Cocina', contactId: uuid(), status: 'pending', totalCents: 1000, ...extra })
    // Una cotización que ya existía en el dispositivo conserva su número y sube el contador.
    const old = quote({ number: 7 })
    expect(await push([{ tbl: 'quote', row: old }])).toEqual([])
    // Dos dispositivos crean una sin conexión, ambas con el número local 8.
    const q1 = quote({ number: 8, numberPending: true })
    const q2 = quote({ number: 8, numberPending: true })
    expect(await push([{ tbl: 'quote', row: q1 }])).toEqual([{ tbl: 'quote', id: q1.id, number: 8 }])
    expect(await push([{ tbl: 'quote', row: q2 }])).toEqual([{ tbl: 'quote', id: q2.id, number: 9 }])
    // Reenviar la misma (el dispositivo aún no recibió la respuesta) no le da otro número.
    expect(await push([{ tbl: 'quote', row: q2 }])).toEqual([])
    const got = await find('quote', q2.id)
    expect(got?.data.number).toBe(9)
    expect(got?.data).not.toHaveProperty('numberPending')
    // Pedidos llevan su propio contador.
    const o = row({ number: 1, numberPending: true, customerName: '', notes: '', status: 'pending', totalCents: 0, source: 'manual' })
    expect(await push([{ tbl: 'order', row: o }])).toEqual([{ tbl: 'order', id: o.id, number: 1 }])
  })

  it('un envío es todo o nada', async () => {
    const c = row({ type: 'customer', name: 'Beto', phone: '' })
    await expect(push([{ tbl: 'contact', row: c }, { tbl: 'contact', row: { ...row({}), businessId: uuid() } }])).rejects.toThrow()
    expect(await find('contact', c.id)).toBeUndefined()
  })

  it('la descarga va en orden y por páginas', async () => {
    const all = await pull()
    const revs = all.map((r) => BigInt(r.rev))
    expect(revs).toEqual([...revs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    const page = await s.rpc<PullRow[]>(owner, 'sync_pull', [biz, 0, 2])
    expect(page).toHaveLength(2)
    expect(page.map((r) => r.id)).toEqual(all.slice(0, 2).map((r) => r.id))
  })
})
