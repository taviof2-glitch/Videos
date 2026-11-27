/** Reduce la foto a `max` px por lado y la pasa a JPEG (base64 sin encabezado) para mandarla ligera. */
export async function shrinkPhoto(file: File, max = 1280, quality = 0.82): Promise<{ data: string; preview: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('No se pudo leer la foto')); img.src = url })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * k)
    canvas.height = Math.round(img.naturalHeight * k)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const preview = canvas.toDataURL('image/jpeg', quality)
    return { data: preview.split(',')[1], preview }
  } finally {
    URL.revokeObjectURL(url)
  }
}
