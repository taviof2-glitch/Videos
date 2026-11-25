import { db } from './db'

/**
 * Copia de seguridad: todo el contenido de la base local en un solo archivo JSON.
 * Las fotos (Blob) se guardan en base64. Importar REEMPLAZA los datos actuales, en una sola
 * transacción: si el archivo está dañado no se cambia nada.
 */
/** Marcador interno de las copias; no cambia con el nombre de la app para que las copias antiguas sigan sirviendo. */
export const BACKUP_APP = 'mi-negocio'
export const BACKUP_VERSION = 1
const LAST_BACKUP = 'lastBackupAt'

/** Toda tabla nueva de la base debe estar aquí (hay una prueba que lo comprueba). */
export const BACKUP_TABLES = ['business', 'meta', 'category', 'product', 'stockMovement', 'contact', 'txn', 'txnItem', 'payment', 'quote', 'quoteItem', 'purchase', 'purchaseItem'] as const

type EncodedPhoto = { type: string; data: string }
export type BackupFile = {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  tables: Record<string, Record<string, unknown>[]>
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function fromBase64(data: string): Uint8Array<ArrayBuffer> {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export async function exportBackup(): Promise<BackupFile> {
  // La fecha se anota antes de leer: así viaja dentro de la copia y, al restaurarla, no se vuelve a pedir otra de inmediato.
  const exportedAt = new Date().toISOString()
  await db.meta.put({ key: LAST_BACKUP, value: exportedAt })
  // Dentro de la transacción solo se leen filas. Codificar las fotos (Blob.arrayBuffer) espera una promesa que
  // no es de IndexedDB y, en el navegador real, eso cierra la transacción antes de tiempo: se hace después.
  const raw: Record<string, Record<string, unknown>[]> = {}
  await db.transaction('r', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const name of BACKUP_TABLES) raw[name] = await db.table(name).toArray()
  })
  const tables: BackupFile['tables'] = { ...raw }
  tables.product = await Promise.all(
    raw.product.map(async (p) => ({
      ...p,
      photos: await Promise.all(((p.photos as Blob[]) ?? []).map(async (b): Promise<EncodedPhoto> => ({ type: b.type, data: toBase64(new Uint8Array(await b.arrayBuffer())) }))),
    })),
  )
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, tables }
}

export const backupFileName = (iso = new Date().toISOString()) => `copia-conta-${iso.slice(0, 10)}.json`

export async function lastBackupAt(): Promise<string | undefined> {
  return (await db.meta.get(LAST_BACKUP))?.value
}

/** Valida el archivo y lo convierte a filas listas para guardar. Lanza un error legible si algo no cuadra. */
function parseBackup(text: string): Record<string, Record<string, unknown>[]> {
  let file: Partial<BackupFile>
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida (no se puede leer).')
  }
  if (!file || typeof file !== 'object' || file.app !== BACKUP_APP || typeof file.tables !== 'object' || !file.tables) {
    throw new Error('El archivo no es una copia de seguridad de esta app.')
  }
  if (typeof file.version !== 'number' || file.version > BACKUP_VERSION) {
    throw new Error('La copia es de una versión más nueva de la app. Actualiza la app e inténtalo de nuevo.')
  }
  const out: Record<string, Record<string, unknown>[]> = {}
  for (const name of BACKUP_TABLES) {
    const rows = file.tables[name]
    if (!Array.isArray(rows)) throw new Error(`La copia está incompleta: falta la tabla "${name}".`)
    for (const row of rows) {
      const keyField = name === 'meta' ? 'key' : 'id'
      if (!row || typeof row !== 'object' || typeof row[keyField] !== 'string') throw new Error(`La copia está dañada: una fila de "${name}" no es válida.`)
    }
    out[name] =
      name === 'product'
        ? rows.map((p) => {
            const photos = Array.isArray(p.photos) ? p.photos : []
            try {
              return { ...p, photos: photos.map((x: EncodedPhoto) => new Blob([fromBase64(x.data)], { type: String(x.type) })) }
            } catch {
              throw new Error('La copia está dañada: una foto no se puede leer.')
            }
          })
        : rows
  }
  return out
}

export type ImportSummary = { products: number; contacts: number; movements: number }

/** Reemplaza TODOS los datos actuales por los de la copia. Todo o nada. */
export async function importBackup(text: string): Promise<ImportSummary> {
  const data = parseBackup(text) // se valida todo antes de tocar la base
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const name of BACKUP_TABLES) {
      await db.table(name).clear()
      await db.table(name).bulkAdd(data[name])
    }
  })
  return { products: data.product.length, contacts: data.contact.length, movements: data.txn.length }
}

export const BACKUP_REMINDER_DAYS = 7

/** Para el aviso de Inicio: hay datos que perder y hace tiempo (o nunca) que no se respalda. */
export async function backupStatus(now = Date.now()): Promise<{ hasData: boolean; ageDays: number | null; due: boolean }> {
  const [sales, products, last] = await Promise.all([db.txn.count(), db.product.count(), lastBackupAt()])
  const hasData = sales + products > 0
  const ageDays = last ? Math.max(0, Math.floor((now - new Date(last).getTime()) / 86_400_000)) : null
  return { hasData, ageDays, due: hasData && (ageDays === null || ageDays >= BACKUP_REMINDER_DAYS) }
}
