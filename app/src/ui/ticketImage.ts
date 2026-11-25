/** Dibuja un comprobante o cotización (líneas monoespaciadas ya alineadas) como imagen PNG, para compartirla por WhatsApp u otra app. */
export type TicketLine = { text: string; bold: boolean }
export type TicketImageOptions = { cols: number; fontSize?: number; padding?: number; scale?: number }

const FONT = '"Courier New", Courier, "Liberation Mono", monospace'

/** Tamaño de la imagen (en píxeles lógicos) para esas líneas. */
export function ticketImageSize(lineCount: number, cols: number, charWidth: number, fontSize: number, padding: number) {
  const lineHeight = Math.round(fontSize * 1.45)
  return { width: Math.ceil(cols * charWidth + padding * 2), height: lineCount * lineHeight + padding * 2, lineHeight }
}

export async function renderTicketImage(lines: TicketLine[], { cols, fontSize = 22, padding = 28, scale = 2 }: TicketImageOptions): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear la imagen en este navegador')
  ctx.font = `${fontSize}px ${FONT}`
  const { width, height, lineHeight } = ticketImageSize(lines.length, cols, ctx.measureText('0').width, fontSize, padding)
  canvas.width = width * scale // cambiar el tamaño reinicia el contexto: lo de abajo se define después
  canvas.height = height * scale
  ctx.scale(scale, scale)
  // Colores fijos: la imagen se comparte fuera de la app, no depende del tema claro u oscuro.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'
  ctx.textBaseline = 'alphabetic'
  lines.forEach((l, i) => {
    ctx.font = `${l.bold ? 'bold ' : ''}${fontSize}px ${FONT}`
    ctx.fillText(l.text, padding, padding + i * lineHeight + fontSize)
  })
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'))
}
