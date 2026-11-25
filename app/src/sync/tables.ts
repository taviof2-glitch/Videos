// Qué tablas de Dexie se sincronizan y cómo (ver replica/sync-design.md).
// Debe coincidir con sync_table_kind() y sync_child_parent() de app/supabase/migrations/0001_sync.sql.

/** Entidades y documentos: gana la última escritura que llega al servidor; el borrado gana. */
export const ROW_TABLES = ['business', 'category', 'contact', 'product', 'productVariant', 'txn', 'quote', 'order', 'purchase'] as const
/** Libro: solo se añade (y se anula con deletedAt). */
export const LEDGER_TABLES = ['stockMovement', 'payment'] as const
/** Líneas de un documento: viajan siempre con su documento. */
export const CHILD_TABLES = {
  txnItem: { parent: 'txn', field: 'transactionId' },
  quoteItem: { parent: 'quote', field: 'quoteId' },
  orderItem: { parent: 'order', field: 'orderId' },
  purchaseItem: { parent: 'purchase', field: 'purchaseId' },
} as const

/** Tablas solo de este dispositivo: ni se sincronizan ni van en la copia de seguridad. */
/** Fila de `syncState` con el negocio de este aparato que está conectado a la cuenta. */
export const LINK_KEY = 'link'

export const DEVICE_TABLES = ['outbox', 'syncState'] as const

export type RowTable = (typeof ROW_TABLES)[number] | (typeof LEDGER_TABLES)[number]
export type ChildTable = keyof typeof CHILD_TABLES
export type TableKind = 'row' | 'ledger' | 'child'

export function tableKind(name: string): TableKind | undefined {
  if ((ROW_TABLES as readonly string[]).includes(name)) return 'row'
  if ((LEDGER_TABLES as readonly string[]).includes(name)) return 'ledger'
  if (name in CHILD_TABLES) return 'child'
  return undefined
}

/** Líneas de cada documento, p. ej. txn → txnItem. */
export const CHILDREN_OF: Record<string, { table: ChildTable; field: string }> = Object.fromEntries(
  Object.entries(CHILD_TABLES).map(([table, c]) => [c.parent, { table: table as ChildTable, field: c.field }]),
)

/** Campos que no viajan al servidor (las fotos van aparte, a Storage) y se conservan al descargar. */
export const LOCAL_FIELDS: Record<string, readonly string[]> = { product: ['photos'] }

/** Una fila pendiente de subir. Las líneas apuntan a su documento. */
export interface OutboxEntry {
  seq?: number
  tbl: RowTable
  rowId: string
}

export interface SyncStateRow {
  key: string
  value: unknown
}
