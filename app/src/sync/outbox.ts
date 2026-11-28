// Captura automática de cambios: cada escritura en una tabla sincronizada deja una entrada en `outbox`
// dentro de la MISMA transacción de IndexedDB (si la escritura falla, no queda nada en la cola).
// Así no hay que tocar las funciones de src/data/.
import type { DBCore, DBCoreMutateRequest, DBCoreTable, DBCoreTransaction, Middleware } from 'dexie'
import { CHILD_TABLES, type ChildTable, type OutboxEntry, type RowTable, tableKind } from './tables'

/** Marca puesta en una transacción que aplica datos del servidor: esas escrituras no se vuelven a subir. */
const REMOTE = Symbol('conta-sync-remote')

export function markRemote(idbTransaction: unknown) {
  ;(idbTransaction as Record<symbol, boolean>)[REMOTE] = true
}

/**
 * Avisos de «se escribió algo en la cola». `liveQuery` no se entera de las entradas que este middleware escribe
 * (van por debajo del observador de Dexie), así que el ejecutor de la sincronización se suscribe aquí.
 */
const writeListeners = new Set<() => void>()
export function onOutboxWrite(fn: () => void): () => void {
  writeListeners.add(fn)
  return () => writeListeners.delete(fn)
}
const notifyWrite = () => {
  for (const l of writeListeners) l()
}

const isRemote = (trans: DBCoreTransaction) => (trans as unknown as Record<symbol, boolean>)[REMOTE] === true

function keysOf(req: DBCoreMutateRequest, results: unknown[] | undefined): unknown[] {
  if (req.type === 'add' || req.type === 'put') {
    const keys = req.keys ?? results ?? req.values.map((v) => (v as { id?: unknown }).id)
    return [...keys, ...(req.type === 'put' && req.updates ? req.updates.keys : [])]
  }
  if (req.type === 'delete') return req.keys
  return []
}

async function parentsOf(table: DBCoreTable, trans: DBCoreTransaction, child: ChildTable, req: DBCoreMutateRequest, keys: unknown[]): Promise<string[]> {
  const field = CHILD_TABLES[child].field
  let rows: unknown[]
  if (req.type === 'deleteRange') {
    rows = (await table.query({ trans, values: true, query: { index: table.schema.primaryKey, range: req.range } })).result
  } else {
    rows = keys.length ? await table.getMany({ trans, keys }) : []
  }
  return rows.flatMap((r) => (r && typeof (r as Record<string, unknown>)[field] === 'string' ? [(r as Record<string, string>)[field]] : []))
}

export const outboxMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'conta-outbox',
  // Por debajo de todos los middlewares de Dexie (hooks, caché y liveQuery usan su contexto de zona, que se
  // pierde al esperar): aquí sí se espera a IndexedDB antes de escribir (leer las líneas que se van a borrar).
  level: -2,
  create(down) {
    return {
      ...down,
      transaction(stores, mode, options) {
        const scope = mode === 'readwrite' && !stores.includes('outbox') && stores.some((s) => tableKind(s)) ? [...stores, 'outbox'] : stores
        return down.transaction(scope, mode, options)
      },
      table(name) {
        const table = down.table(name)
        const kind = tableKind(name)
        if (!kind) return table
        return {
          ...table,
          async mutate(req) {
            if (isRemote(req.trans)) return table.mutate(req)
            let entries: OutboxEntry[] = []
            if (kind === 'child') {
              const child = name as ChildTable
              const parent = CHILD_TABLES[child].parent
              // Las líneas borradas solo se pueden leer antes de borrarlas.
              const before = req.type === 'delete' || req.type === 'deleteRange' ? await parentsOf(table, req.trans, child, req, keysOf(req, undefined)) : []
              const res = await table.mutate(req)
              const after = req.type === 'add' || req.type === 'put' ? await parentsOf(table, req.trans, child, req, keysOf(req, res.results)) : []
              entries = [...new Set([...before, ...after])].map((rowId) => ({ tbl: parent, rowId }))
              await record(req.trans, entries)
              return res
            }
            const res = await table.mutate(req)
            // Borrar filas de verdad solo ocurre al restaurar una copia: no se sincroniza (ver sync-design.md).
            if (req.type === 'add' || req.type === 'put') {
              const failed = new Set(Object.keys(res.failures ?? {}).map(Number))
              entries = keysOf(req, res.results)
                .filter((k, i) => typeof k === 'string' && !failed.has(i))
                .map((rowId) => ({ tbl: name as RowTable, rowId: rowId as string }))
            }
            await record(req.trans, entries)
            return res
          },
        }
      },
    }

    async function record(trans: DBCoreTransaction, entries: OutboxEntry[]) {
      if (!entries.length) return
      await down.table('outbox').mutate({ type: 'add', trans, values: entries })
      // Se avisa cuando la transacción termina de verdad (antes, el dato aún no se puede leer).
      const raw = trans as unknown as { addEventListener?: (t: string, f: () => void, o?: object) => void }
      if (raw.addEventListener) raw.addEventListener('complete', notifyWrite, { once: true })
      else notifyWrite()
    }
  },
}
