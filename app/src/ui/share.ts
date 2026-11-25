/** Descargar y compartir archivos desde el navegador (sin servidor). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function pdfFile(bytes: Uint8Array<ArrayBuffer>, filename: string): File {
  return new File([bytes], filename, { type: 'application/pdf' })
}

/** El menú nativo de compartir con archivos existe en móviles (Chrome/Safari) y algunos escritorios. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof navigator.share !== 'function') return false
  try {
    return navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })
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
