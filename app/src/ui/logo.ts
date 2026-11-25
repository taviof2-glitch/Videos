/** Lado mayor del logo guardado: nítido en el documento y ligero para sincronizar. */
export const LOGO_SIZE = 320

const toDataUri = (canvas: HTMLCanvasElement, type: string, quality?: number) => canvas.toDataURL(type, quality)

/**
 * Reduce la imagen elegida a un logo de como mucho 320 px por lado, sin recortarla.
 * Queda en PNG (conserva el fondo transparente); si así pesa demasiado, pasa a JPEG con fondo blanco.
 */
export async function prepareLogo(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.')
  }
  const k = Math.min(1, LOGO_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * k))
  canvas.height = Math.max(1, Math.round(bitmap.height * k))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const png = toDataUri(canvas, 'image/png')
  if (png.length <= 150_000) return png
  ctx.globalCompositeOperation = 'destination-over'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return toDataUri(canvas, 'image/jpeg', 0.88)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar el logo'))
    img.src = src
  })
}
