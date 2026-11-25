/**
 * PDF de texto sin dependencias, con letra monoespaciada (Courier): un ticket de una página (comprobante)
 * o páginas tamaño carta con numeración (cotizaciones).
 * Courier mide exactamente 0.6 × el tamaño por carácter, así que el ajuste de línea y la
 * alineación a la derecha se hacen con espacios y salen exactos, también en la vista previa.
 */
export type PdfLine = { text: string; bold?: boolean; align?: 'left' | 'center' | 'right' }

export const TICKET_COLS = 44

const REPLACEMENTS: Record<string, string> = { '–': '-', '—': '-', '−': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '€': 'EUR', '•': '*' }

/** Deja solo caracteres Latin-1 (los que Courier/WinAnsi dibuja: á é ñ ¿ ¡ × …). Lo demás se aproxima o pasa a "?". */
export function toLatin1(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (/\s/.test(ch)) out += ' '
    else if (code < 32 || code === 127) out += ' '
    else if (code < 256) out += ch
    else if (REPLACEMENTS[ch]) out += REPLACEMENTS[ch]
    else {
      const base = ch.normalize('NFD').replace(/\p{Diacritic}/gu, '')
      out += base !== ch && base.charCodeAt(0) < 128 ? base : '?'
    }
  }
  return out
}

/** Parte un texto en líneas de como mucho `cols` caracteres, sin cortar palabras salvo que una sola no quepa. */
export function wrapText(text: string, cols: number): string[] {
  const lines: string[] = []
  let line = ''
  for (let word of toLatin1(text).split(' ').filter(Boolean)) {
    while (word.length > cols) {
      if (line) { lines.push(line); line = '' }
      lines.push(word.slice(0, cols))
      word = word.slice(cols)
    }
    if (!line) line = word
    else if (line.length + 1 + word.length <= cols) line += ' ' + word
    else { lines.push(line); line = word }
  }
  if (line || lines.length === 0) lines.push(line)
  return lines
}

/** La línea ya con sus espacios de alineación (para el PDF y para la vista previa). */
export function layoutLine(line: PdfLine, cols = TICKET_COLS): string {
  const text = toLatin1(line.text).slice(0, cols)
  const room = cols - text.length
  if (line.align === 'center') return ' '.repeat(Math.floor(room / 2)) + text
  if (line.align === 'right') return ' '.repeat(room) + text
  return text
}

/** Texto a la izquierda y a la derecha en la misma línea (p. ej. "TOTAL        $2,400.00"). */
export function twoColumns(left: string, right: string, cols = TICKET_COLS): string {
  const l = toLatin1(left)
  const r = toLatin1(right)
  if (l.length + r.length + 1 > cols) return l.slice(0, Math.max(0, cols - r.length - 1)) + ' ' + r
  return l + ' '.repeat(cols - l.length - r.length) + r
}

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

/** Medidas de una hoja. Sin `page` es una sola página tan alta como haga falta (ticket). */
export type PaperSpec = { size: number; leading: number; margin: number; page?: { width: number; height: number } }
export const TICKET_PAPER: PaperSpec = { size: 10, leading: 14, margin: 20 }
/** Carta (612 × 792 pt) con 80 columnas: 2 × 42 de margen + 80 × 6.6 = 612. */
export const LETTER_PAPER: PaperSpec = { size: 11, leading: 15, margin: 42, page: { width: 612, height: 792 } }

/** Reparte las líneas en páginas; si hay más de una, reserva una línea para "Página i de n". */
export function paginate(lines: PdfLine[], paper: PaperSpec): PdfLine[][] {
  if (!paper.page) return [lines]
  const room = Math.floor((paper.page.height - 2 * paper.margin) / paper.leading)
  const chunk = (n: number) => Array.from({ length: Math.max(1, Math.ceil(lines.length / n)) }, (_, i) => lines.slice(i * n, (i + 1) * n))
  const single = chunk(room)
  return single.length === 1 ? single : chunk(room - 1)
}

export function buildPdf(lines: PdfLine[], cols = TICKET_COLS, paper: PaperSpec = TICKET_PAPER): Uint8Array {
  const { size, leading, margin } = paper
  const width = paper.page?.width ?? margin * 2 + cols * size * 0.6
  const pages = paginate(lines, paper)
  const height = paper.page?.height ?? Math.max(margin * 2 + lines.length * leading, 200)
  const text = (x: number, y: number, str: string, bold: boolean, fontSize = size) =>
    `BT /${bold ? 'F2' : 'F1'} ${fontSize} Tf 1 0 0 1 ${x} ${y} Tm (${escape(str)}) Tj ET`

  const contents = pages.map((pageLines, p) => {
    const ops = pageLines.map((l, i) => text(margin, height - margin - size - i * leading, layoutLine(l, cols), !!l.bold))
    if (pages.length > 1) {
      const label = `Página ${p + 1} de ${pages.length}`
      ops.push(text(Math.round((width - label.length * 4.8) / 2), margin - 10, label, false, 8))
    }
    return ops.join('\n')
  })

  // 1 catálogo, 2 páginas, 3-4 fuentes y luego (página, contenido) por cada página.
  const kids = pages.map((_, p) => `${5 + 2 * p} 0 R`).join(' ')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    ...contents.flatMap((ops, p) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents ${6 + 2 * p} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
      `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    ]),
  ]
  // Todo el archivo usa caracteres ≤ 255, así que 1 carácter = 1 byte y los desfases se cuentan por longitud.
  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Uint8Array.from(out, (c) => c.charCodeAt(0))
}
