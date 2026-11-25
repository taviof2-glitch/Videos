/** Lo mínimo de `window.claude` que se usa: dentro de una página publicada en claude.ai las descargas propias están bloqueadas y se piden por la capacidad `downloads`. */
type DownloadsCapability = { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }
type ClaudeHost = { use(name: string): Promise<unknown> }

/**
 * Descarga un archivo. Devuelve `false` si la persona cancela (no es un error).
 * Dentro de una página publicada usa la capacidad `downloads`; en cualquier otro sitio, una descarga normal.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  const host = (globalThis as { claude?: ClaudeHost }).claude
  const downloads = host ? ((await host.use('downloads').catch(() => null)) as DownloadsCapability | null) : null
  if (downloads) {
    try {
      await downloads.save({ filename, data: blob })
      return true
    } catch (err) {
      if ((err as { code?: string })?.code === 'declined') return false
      throw new Error('No se pudo guardar el archivo en este visor. Ábrela en el navegador para descargar.')
    }
  }
  saveWithLink(blob, filename)
  return true
}

function saveWithLink(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** El menú nativo de compartir con archivos (PDF e imagen) existe en móviles (Chrome/Safari) y algunos escritorios. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' }), new File(['x'], 'x.png', { type: 'image/png' })] })
  } catch {
    return false
  }
}

/** Abre el menú de compartir. Si la persona lo cierra sin elegir no es un error. */
export async function shareFile(file: File, title: string, text: string): Promise<void> {
  try {
    await navigator.share({ files: [file], title, text })
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
  }
}
