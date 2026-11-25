import { describe, expect, it } from 'vitest'
import { buildPdf, LETTER_PAPER, logoBox, TICKET_COLS, TICKET_PAPER, type PdfImage } from './pdf'

// Un JPEG mínimo de mentira: el PDF solo copia los bytes, no los decodifica.
const logo: PdfImage = { jpeg: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x28, 0x29, 0x5c, 0xff, 0xd9]), width: 320, height: 160 }
const text = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')
const lines = [{ text: 'Carpintería López', bold: true }, { text: 'TOTAL  $100.00' }]

describe('logo en el PDF', () => {
  it('se ajusta al tamaño máximo sin deformarse', () => {
    expect(logoBox(logo, TICKET_PAPER)).toMatchObject({ w: 112, h: 56 })
    expect(logoBox(logo, LETTER_PAPER)).toMatchObject({ w: 128, h: 64 })
    expect(logoBox({ width: 40, height: 20 }, TICKET_PAPER)).toMatchObject({ w: 40, h: 20 }) // no se agranda
  })

  it('va como imagen en la primera página, con los bytes intactos y el xref correcto', () => {
    const pdf = text(buildPdf(lines, TICKET_COLS, TICKET_PAPER, logo))
    expect(pdf).toContain('/Subtype /Image /Width 320 /Height 160')
    expect(pdf).toContain('/Filter /DCTDecode /Length 9')
    expect(pdf).toContain(text(logo.jpeg))
    expect(pdf).toContain('/XObject << /Im1 7 0 R >>')
    expect(pdf).toMatch(/q 112 0 0 56 \d+ \d+ cm \/Im1 Do Q/)
    // Cada entrada del xref apunta al inicio de su objeto.
    const xrefAt = Number(pdf.match(/startxref\n(\d+)/)![1])
    const offsets = pdf.slice(xrefAt).split('\n').slice(3).filter((l) => l.endsWith(' n ')).map((l) => Number(l.slice(0, 10)))
    offsets.forEach((o, i) => expect(pdf.startsWith(`${i + 1} 0 obj\n`, o)).toBe(true))
    expect(offsets).toHaveLength(7)
  })

  it('el ticket crece para dejar sitio al logo; sin logo, nada cambia', () => {
    const height = (pdf: string) => Number(pdf.match(/MediaBox \[0 0 [\d.]+ ([\d.]+)\]/)![1])
    const many = Array.from({ length: 30 }, (_, i) => ({ text: `línea ${i}` }))
    const plain = text(buildPdf(many))
    const withLogo = text(buildPdf(many, TICKET_COLS, TICKET_PAPER, logo))
    expect(height(withLogo) - height(plain)).toBe(logoBox(logo, TICKET_PAPER).lines * TICKET_PAPER.leading)
    expect(plain).not.toContain('/XObject')
  })

  it('en hoja carta el logo solo va en la primera página', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ text: `línea ${i}` }))
    const pdf = text(buildPdf(many, 80, LETTER_PAPER, logo))
    expect(pdf.match(/\/Im1 Do/g)).toHaveLength(1)
    expect(pdf.match(/\/XObject <</g)).toHaveLength(1)
  })
})
