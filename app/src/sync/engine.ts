// Motor de sincronización: sube lo que hay en `outbox`, descarga lo nuevo del servidor y recalcula el stock.
// No sabe nada de Supabase: habla con un `SyncTransport` (ver replica/sync-design.md).
import Dexie from 'dexie'
import type { AppDB } from '../data/db'
import { roundQty } from '../data/quantity'
import type { ProductVariant, StockMovement } from '../data/types'
import { markRemote } from './outbox'
import { type PhotoStore, syncPhotos } from './photos'
import { CHILD_TABLES, CHILDREN_OF, type ChildTable, LEDGER_TABLES, LOCAL_FIELDS, type OutboxEntry, ROW_TABLES, tableKind } from './tables'

type Data = Record<string, unknown>

export type Change = { tbl: string; row: Data } | { tbl: string; parentId: string; rows: Data[] }
export interface Assigned {
  tbl: string
  id: string
  number: number
}
export interface PullRow {
  tbl: string
  id: string
  parent_id: string | null
  data: Data
  deleted_at: string | null
  rev: number | string
}
export interface SyncTransport {
  push(businessId: string, changes: Change[]): Promise<Assigned[]>
  pull(businessId: string, after: number, limit: number): Promise<PullRow[]>
  /** Fotos en Storage; sin esto (versión sin servidor) las fotos solo viven en el dispositivo. */
  photos?: PhotoStore
}

const SYNCED = [...ROW_TABLES, ...LEDGER_TABLES, ...Object.keys(CHILD_TABLES)]
const PUSH_BATCH = 200
const PULL_PAGE = 500

const cursorKey = (businessId: string) => `cursor:${businessId}`
const uploadKey = (businessId: string) => `upload:${businessId}`

/** A qué negocio pertenece una fila (el negocio mismo no tiene businessId). */
const businessOf = (tbl: string, row: Data) => (tbl === 'business' ? row.id : row.businessId) as string | undefined

/** La fila tal como viaja: sin los campos que solo viven en el dispositivo. */
function toServer(tbl: string, row: Data): Data {
  const local = LOCAL_FIELDS[tbl]
  if (!local) return row
  const out = { ...row }
  for (const f of local) delete out[f]
  return out
}

/** Arma los cambios de unas filas (cada documento con todas sus líneas actuales). Las filas que ya no existen se omiten. */
async function buildChanges(db: AppDB, businessId: string, keys: { tbl: string; rowId: string }[]): Promise<Change[]> {
  const changes: Change[] = []
  const seen = new Set<string>()
  for (const { tbl, rowId } of keys) {
    const key = `${tbl}:${rowId}`
    if (seen.has(key)) continue
    seen.add(key)
    const row = (await db.table(tbl).get(rowId)) as Data | undefined
    if (!row || businessOf(tbl, row) !== businessId) continue
    changes.push({ tbl, row: toServer(tbl, row) })
    const children = CHILDREN_OF[tbl]
    if (children) {
      const rows = (await db.table(children.table).where(children.field).equals(rowId).toArray()) as Data[]
      changes.push({ tbl: children.table, parentId: rowId, rows })
    }
  }
  return changes
}

/** Guarda los folios que asignó el servidor (sin volver a ponerlos en la cola). */
async function applyAssigned(db: AppDB, assigned: Assigned[], doneSeqs: number[]) {
  await db.transaction('rw', [db.outbox, db.quote, db.order], async () => {
    markRemote(Dexie.currentTransaction.idbtrans)
    await db.outbox.bulkDelete(doneSeqs)
    for (const a of assigned) {
      if (a.tbl !== 'quote' && a.tbl !== 'order') continue
      await db.table(a.tbl).where('id').equals(a.id).modify((r: { number: number; numberPending?: boolean }) => {
        r.number = a.number
        delete r.numberPending
      })
    }
  })
}

/** Sube todo lo pendiente de este negocio. Devuelve cuántas filas subió. */
export async function push(db: AppDB, transport: SyncTransport, businessId: string): Promise<number> {
  let after = 0
  let pushed = 0
  for (;;) {
    const entries = await db.outbox.where('seq').above(after).limit(PUSH_BATCH).toArray()
    if (!entries.length) return pushed
    after = entries[entries.length - 1].seq!
    const { changes, doneSeqs } = await db.transaction('r', SYNCED.map((t) => db.table(t)), async () => {
      const mine: OutboxEntry[] = []
      const done: number[] = []
      for (const e of entries) {
        const row = (await db.table(e.tbl).get(e.rowId)) as Data | undefined
        // Las entradas de otro negocio se quedan en la cola (T14); las de filas que ya no existen se descartan.
        if (row && businessOf(e.tbl, row) !== businessId) continue
        done.push(e.seq!)
        if (row) mine.push(e)
      }
      return { changes: await buildChanges(db, businessId, mine), doneSeqs: done }
    })
    const assigned = changes.length ? await transport.push(businessId, changes) : []
    await applyAssigned(db, assigned, doneSeqs)
    pushed += changes.filter((c) => 'row' in c).length
  }
}

/** Recalcula la caché de stock de productos y variantes a partir de los movimientos (la del servidor no manda). */
async function recomputeStock(db: AppDB, productIds: Set<string>) {
  for (const productId of productIds) {
    const product = await db.product.get(productId)
    if (!product) continue
    const moves: StockMovement[] = await db.stockMovement.where({ productId }).toArray()
    const stock = roundQty(moves.reduce((s, m) => s + m.delta, 0))
    if (product.stock !== stock) await db.product.update(productId, { stock })
    const variants: ProductVariant[] = await db.productVariant.where({ productId }).toArray()
    for (const v of variants) {
      const vs = roundQty(moves.filter((m) => m.variantId === v.id).reduce((s, m) => s + m.delta, 0))
      if (v.stock !== vs) await db.productVariant.update(v.id, { stock: vs })
    }
  }
}

/** Aplica una página de filas del servidor en una sola transacción y avanza el cursor. */
async function applyPage(db: AppDB, businessId: string, rows: PullRow[]) {
  await db.transaction('rw', [...SYNCED.map((t) => db.table(t)), db.outbox, db.syncState], async () => {
    markRemote(Dexie.currentTransaction.idbtrans)
    // Lo que este dispositivo cambió y aún no subió no se pisa: se sube después y el servidor decide.
    const pending = new Set((await db.outbox.toArray()).map((e) => `${e.tbl}:${e.rowId}`))
    const touched = new Set<string>()
    for (const r of rows) {
      const kind = tableKind(r.tbl)
      if (!kind) continue // tabla de una versión más nueva de la app
      const table = db.table(r.tbl)
      if (kind === 'child') {
        const { parent } = CHILD_TABLES[r.tbl as ChildTable]
        if (r.parent_id && pending.has(`${parent}:${r.parent_id}`)) continue
        if (r.deleted_at) await table.delete(r.id)
        else await table.put(r.data)
        continue
      }
      if (pending.has(`${r.tbl}:${r.id}`)) continue
      let data = r.data
      const local = LOCAL_FIELDS[r.tbl]
      if (local) {
        const existing = (await table.get(r.id)) as Data | undefined
        data = { ...data }
        for (const f of local) data[f] = existing?.[f] ?? (r.tbl === 'product' && f === 'photos' ? [] : undefined)
      }
      await table.put(data)
      if (r.tbl === 'product') touched.add(r.id)
      if (r.tbl === 'productVariant' || r.tbl === 'stockMovement') touched.add((data as { productId: string }).productId)
    }
    await recomputeStock(db, touched)
    await db.syncState.put({ key: cursorKey(businessId), value: Number(rows[rows.length - 1].rev) })
  })
}

/** Descarga lo nuevo del servidor. Devuelve cuántas filas recibió. */
export async function pull(db: AppDB, transport: SyncTransport, businessId: string): Promise<number> {
  let pulled = 0
  for (;;) {
    const cursor = Number((await db.syncState.get(cursorKey(businessId)))?.value ?? 0)
    const rows = await transport.pull(businessId, cursor, PULL_PAGE)
    if (!rows.length) return pulled
    await applyPage(db, businessId, rows)
    pulled += rows.length
    if (rows.length < PULL_PAGE) return pulled
  }
}

export type SyncStep = 'push' | 'pull' | 'photos'

/** Los datos: primero sube (así lo propio nunca queda pendiente al descargar) y luego descarga. */
export async function syncData(db: AppDB, transport: SyncTransport, businessId: string, onStep?: (step: SyncStep) => void) {
  onStep?.('push')
  const pushed = await push(db, transport, businessId)
  onStep?.('pull')
  const pulled = await pull(db, transport, businessId)
  return { pushed, pulled }
}

/** Las fotos van aparte: así los datos quedan al día aunque Storage falle o vaya lento. */
export async function syncPhotosRound(db: AppDB, transport: SyncTransport, businessId: string) {
  if (!transport.photos) return
  const { uploaded } = await syncPhotos(db, transport.photos, businessId)
  if (uploaded) await push(db, transport, businessId)
}

/** Una vuelta completa: datos y luego fotos. */
export async function syncOnce(db: AppDB, transport: SyncTransport, businessId: string, onStep?: (step: SyncStep) => void) {
  const result = await syncData(db, transport, businessId, onStep)
  onStep?.('photos')
  await syncPhotosRound(db, transport, businessId)
  return result
}

/** Orden de subida inicial: primero lo que otras filas mencionan. Las líneas viajan con su documento. */
const UPLOAD_ORDER = ['business', 'category', 'contact', 'product', 'productVariant', 'txn', 'purchase', 'quote', 'order', 'stockMovement', 'payment'] as const

/**
 * Primera conexión: sube todos los datos del negocio que hay en este dispositivo, por lotes.
 * Si se corta, la siguiente llamada sigue donde se quedó. Al terminar, la cola anterior ya no hace falta.
 */
export async function uploadAll(db: AppDB, transport: SyncTransport, businessId: string, onProgress?: (done: number, total: number) => void) {
  const count = async (tbl: string) =>
    tbl === 'business' ? 1 : db.table(tbl).filter((r: Data) => r.businessId === businessId).count()
  const total = (await Promise.all(UPLOAD_ORDER.map(count))).reduce((a, b) => a + b, 0)
  type Progress = { table: number; lastId: string; done: number; outboxSeq: number }
  const saved = (await db.syncState.get(uploadKey(businessId)))?.value as Progress | undefined
  const lastSeq = (await db.outbox.orderBy('seq').last())?.seq ?? 0
  const progress: Progress = saved ?? { table: 0, lastId: '', done: 0, outboxSeq: lastSeq }
  onProgress?.(progress.done, total)
  for (; progress.table < UPLOAD_ORDER.length; progress.table++, progress.lastId = '') {
    const tbl = UPLOAD_ORDER[progress.table]
    for (;;) {
      const rows = (await db.table(tbl).where('id').above(progress.lastId).limit(PUSH_BATCH).toArray()) as Data[]
      if (!rows.length) break
      progress.lastId = rows[rows.length - 1].id as string
      const mine = rows.filter((r) => businessOf(tbl, r) === businessId)
      if (mine.length) {
        await transport.push(businessId, await buildChanges(db, businessId, mine.map((r) => ({ tbl, rowId: r.id as string }))))
        progress.done += mine.length
      }
      await db.syncState.put({ key: uploadKey(businessId), value: { ...progress } })
      onProgress?.(progress.done, total)
    }
  }
  // Lo que estaba en la cola antes de empezar ya subió; lo escrito durante la subida se queda y se sube después.
  await db.transaction('rw', [db.outbox, db.syncState], async () => {
    await db.outbox.where('seq').belowOrEqual(progress.outboxSeq).delete()
    await db.syncState.delete(uploadKey(businessId))
  })
}
