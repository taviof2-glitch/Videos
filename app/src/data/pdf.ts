/**
 * PDF de texto sin dependencias: una página con letra monoespaciada (Courier), como un ticket.
 * Courier mide exactamente 0.6 × el tamaño por carácter, así que el ajuste de línea y la
 * alineación a la derecha se hacen con espacios y salen exactos, también en la vista previa.
 */
export type PdfLine = { text: string; bold?: boolean; align?: 'left' | 'center' | 'right' }

export const TICKET_COLS = 44
const SIZE = 10
const CHAR_W = SIZE * 0.6
const LEADING = 14
const MARGIN = 20

const REPLACEMENTS: Record<string, string> = { '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '€': 'EUR', '•': '*' }

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

export function buildPdf(lines: PdfLine[], cols = TICKET_COLS): Uint8Array {
  const width = MARGIN * 2 + cols * CHAR_W
  const height = Math.max(MARGIN * 2 + lines.length * LEADING, 200)
  const ops = lines
    .map((l, i) => {
      const y = height - MARGIN - SIZE - i * LEADING
      return `BT /${l.bold ? 'F2' : 'F1'} ${SIZE} Tf 1 0 0 1 ${MARGIN} ${y} Tm (${escape(layoutLine(l, cols))}) Tj ET`
    })
    .join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
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
