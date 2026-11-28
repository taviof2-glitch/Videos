// Etiquetas para las piezas del despiece: una por pieza, con la obra, número, medidas y cantos. PDF tamaño carta
// a dos columnas, con líneas para recortar.
import { edgeText, type BPiece } from './bases'
import { buildPdf, LETTER_PAPER, toLatin1, type PdfLine } from './pdf'

export type Label = { no: number; total: number; name: string; l: number; a: number; edges: string; mdf: boolean }

export function expandLabels(pieces: BPiece[]): Label[] {
  const total = pieces.reduce((s, p) => s + p.q, 0)
  const out: Label[] = []
  for (const p of pieces) for (let i = 0; i < p.q; i++) out.push({ no: out.length + 1, total, name: p.q > 1 ? `${p.n} (${i + 1} de ${p.q})` : p.n, l: p.l, a: p.a, edges: p.mdf ? 'Fondo 3 mm' : edgeText(p.e) || 'Sin canto', mdf: !!p.mdf })
  return out
}

const COLS = 80
const HALF = 39

function block(l: Label, title: string): string[] {
  const cut = (s: string) => toLatin1(s).slice(0, HALF - 1)
  return [cut(`#${l.no}/${l.total}  ${l.name}`), cut(`${l.l} x ${l.a} mm`), cut(`Cantos: ${l.edges}`), cut(title), '']
}

export function labelsPdf(pieces: BPiece[], title: string): Uint8Array {
  const labels = expandLabels(pieces)
  const lines: PdfLine[] = []
  for (let i = 0; i < labels.length; i += 2) {
    const a = block(labels[i], title)
    const b = labels[i + 1] ? block(labels[i + 1], title) : a.map(() => '')
    a.forEach((t, k) => lines.push({ text: `${t.padEnd(HALF)}| ${b[k]}`, bold: k === 0 }))
    lines.push({ text: '-'.repeat(COLS) })
  }
  return buildPdf(lines, COLS, LETTER_PAPER)
}

/** Piezas del despiece del cotizador (en cm) como piezas de Bases (mm) para las etiquetas. */
export const fromCutPieces = (pieces: { name: string; qty: number; largo: number; ancho: number; material: string }[]): BPiece[] =>
  pieces.filter((p) => p.material !== 'tubo').map((p) => ({ n: p.name, l: Math.round(Math.max(p.largo, p.ancho) * 10), a: Math.round(Math.min(p.largo, p.ancho) * 10), q: p.qty, e: '----', mdf: p.material === 'fondo' }))
