// Respaldos semanales en la nube: el servidor guarda cada semana una copia de todo el negocio (últimas 8).
// Aquí se listan y se descargan como archivo de copia normal (el mismo que se restaura en «Más»).
import { BACKUP_APP, BACKUP_TABLES, BACKUP_VERSION, type BackupFile } from '../data/backup'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { sessionToken } from './runner'

export type CloudBackup = { id: number; created_at: string; rows: number }

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  if (!navigator.onLine) throw new Error('Sin conexión.')
  const t = await sessionToken().catch(() => undefined)
  if (!t) throw new Error('Entra a tu cuenta en «Cuenta y nube» para ver los respaldos.')
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error('No se pudieron leer los respaldos.')
  return (await r.json()) as T
}

export const listCloudBackups = (businessId: string) => rpc<CloudBackup[]>('list_backups', { p_business: businessId })

/** Convierte las filas del respaldo del servidor en un archivo de copia de la app. */
export function toBackupFile(rows: { tbl: string; data: Record<string, unknown> }[], createdAt: string): BackupFile {
  const tables: Record<string, Record<string, unknown>[]> = Object.fromEntries(BACKUP_TABLES.map((t) => [t, []]))
  for (const r of rows) if (tables[r.tbl] && r.data) tables[r.tbl].push(r.data)
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: createdAt, tables }
}

export async function downloadCloudBackup(businessId: string, b: CloudBackup): Promise<BackupFile> {
  const rows = await rpc<{ tbl: string; data: Record<string, unknown> }[] | null>('get_backup', { p_business: businessId, p_id: b.id })
  return toBackupFile(rows ?? [], b.created_at)
}
