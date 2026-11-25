// Fotos de productos: los datos viajan por sync_push/sync_pull, las fotos aparte, a Storage.
// El producto guarda `photoPaths` (viaja con la fila); los Blob se quedan en el dispositivo como caché.
// Cada foto se nombra por la huella de su contenido: subir dos veces lo mismo es inofensivo y dos aparatos nunca se pisan.
import Dexie from 'dexie'
import type { AppDB } from '../data/db'
import type { Product } from '../data/types'
import { markRemote } from './outbox'

export interface PhotoStore {
  /** Sube (o reemplaza) el archivo en esa ruta. */
  upload(path: string, blob: Blob): Promise<void>
  download(path: string): Promise<Blob>
  /** Borra lo que se pueda; un fallo aquí nunca importa. */
  remove(paths: string[]): Promise<void>
}

const baseKey = (productId: string) => `photos:${productId}`

async function fingerprint(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

const fingerprintOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.jpg$/, '')
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Pone al día las fotos de los productos del negocio. Devuelve cuántos productos subieron fotos
 * (el llamador vuelve a subir los datos para que `photoPaths` llegue al servidor).
 * Quién gana: si las fotos de este aparato cambiaron desde la última vez, suben; si no, se descargan las del servidor.
 */
export async function syncPhotos(db: AppDB, store: PhotoStore, businessId: string): Promise<{ uploaded: number; downloaded: number }> {
  const products = (await db.product.where('businessId').equals(businessId).toArray()).filter((p) => !p.deletedAt)
  let uploaded = 0
  let downloaded = 0
  let firstError: unknown
  for (const p of products) {
    try {
      const remotePaths = p.photoPaths ?? []
      if (!p.photos.length && !remotePaths.length) continue
      const local = await Promise.all(p.photos.map(fingerprint))
      const remote = remotePaths.map(fingerprintOf)
      const base = (await db.syncState.get(baseKey(p.id)))?.value as string[] | undefined
      if (same(local, remote)) {
        if (!base || !same(base, local)) await db.syncState.put({ key: baseKey(p.id), value: local })
        continue
      }
      const up = base ? !same(local, base) : local.length > 0
      if (up) {
        const paths = local.map((h) => `${businessId}/${p.id}/${h}.jpg`)
        for (const [i, path] of paths.entries()) if (!remotePaths.includes(path)) await store.upload(path, p.photos[i])
        // Va por el outbox como cualquier cambio del producto.
        await db.product.update(p.id, { photoPaths: paths })
        const stale = remotePaths.filter((r) => !paths.includes(r))
        if (stale.length) await store.remove(stale).catch(() => undefined)
        await db.syncState.put({ key: baseKey(p.id), value: local })
        uploaded++
      } else {
        const have = new Map(local.map((h, i) => [h, p.photos[i]]))
        const photos = await Promise.all(remotePaths.map(async (path) => have.get(fingerprintOf(path)) ?? store.download(path)))
        await db.transaction('rw', [db.product, db.outbox], async () => {
          markRemote(Dexie.currentTransaction.idbtrans)
          await db.product.update(p.id, { photos } as Partial<Product>)
        })
        await db.syncState.put({ key: baseKey(p.id), value: remote })
        downloaded++
      }
    } catch (e) {
      firstError ??= e
    }
  }
  if (firstError) throw firstError
  return { uploaded, downloaded }
}
