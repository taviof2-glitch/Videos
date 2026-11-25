export const PHOTO_SIZE = 500
export const CATALOG_PHOTO_SIZE = 360

/** Recorta al centro en cuadrado y reduce a 500×500 JPEG, para que las fotos ocupen poco en el dispositivo. */
export async function resizeImage(file: Blob, size = PHOTO_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(size, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out, out)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.82),
  )
}


/** Foto reducida como data URI (JPEG), para llevarla dentro del catálogo publicado. */
export async function thumbnailDataUri(photo: Blob, size = CATALOG_PHOTO_SIZE): Promise<string | undefined> {
  try {
    const small = await resizeImage(photo, size)
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(small)
    })
  } catch {
    return undefined // una foto que no se puede leer no impide publicar el catálogo
  }
}
