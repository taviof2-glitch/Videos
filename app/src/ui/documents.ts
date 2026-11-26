// Cotizaciones y comprobantes con diseño: se dibujan en un canvas (en puntos, a 2× para que salgan nítidos)
// y del mismo dibujo salen la imagen PNG que se manda por WhatsApp y el PDF. Lleva siempre el sello del negocio:
// el logo que subió la dueña o, si no hay, el logo completo de Houselite.
import type { Sketch } from '../data/sketch'
import defaultLogo from '../assets/houselite-logo.webp'
import { formatMoney } from '../data/money'
import { buildImagePdf, type PdfImage } from '../data/pdf'
import { formatQuantity } from '../data/quantity'
import type { QuoteDoc } from '../data/quote-document'
import type { Receipt } from '../data/receipt'
import { loadImage } from './logo'

const C = {
  night: '#0a0a0a',
  ink: '#12100d',
  muted: '#5c6660',
  line: '#e3e6e1',
  sage: '#3d5e50',
  sageSoft: '#e9f0ec',
  gold: '#e4b467',
  goldSoft: '#fbf3e2',
  goldInk: '#6b4e12',
  onNight: '#b9bdb9',
  sale: '#167a4a',
  expense: '#b42318',
}
const FONT = '"Figtree Variable", system-ui, sans-serif'
const SCALE = 2
/** Carta en puntos (8.5 × 11 in). */
export const PAGE = { w: 612, h: 792 }

/** El logo de los documentos: el que subió la dueña o el sello de Houselite. */
export const documentLogoSrc = (logo?: string) => logo || defaultLogo

type Ctx = CanvasRenderingContext2D

function newCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: Ctx } {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * SCALE)
  canvas.height = Math.round(h * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo dibujar el documento en este navegador')
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.textBaseline = 'alphabetic'
  return { canvas, ctx }
}

async function ready(logoSrc: string): Promise<HTMLImageElement | undefined> {
  try {
    await Promise.all(['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 16px "Figtree Variable"`)))
  } catch {
    // sin la letra de la app, el navegador usa la del sistema
  }
  return loadImage(logoSrc).catch(() => (logoSrc === defaultLogo ? undefined : loadImage(defaultLogo).catch(() => undefined)))
}

function font(ctx: Ctx, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`
}

function text(ctx: Ctx, s: string, x: number, y: number, o: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; track?: number } = {}) {
  font(ctx, o.size ?? 10, o.weight ?? 400)
  ctx.fillStyle = o.color ?? C.ink
  ctx.textAlign = o.align ?? 'left'
  const c = ctx as Ctx & { letterSpacing?: string }
  if (o.track && 'letterSpacing' in c) c.letterSpacing = `${o.track}px`
  ctx.fillText(s, x, y)
  if (o.track && 'letterSpacing' in c) c.letterSpacing = '0px'
}

/** Parte un texto en líneas que caben en `width` con esa letra. */
function wrap(ctx: Ctx, s: string, width: number, size: number, weight = 400): string[] {
  font(ctx, size, weight)
  const out: string[] = []
  for (const para of s.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= width) line = next
      else {
        if (line) out.push(line)
        // una palabra más larga que el ancho se corta a la fuerza
        let w = word
        while (ctx.measureText(w).width > width && w.length > 1) {
          let cut = w.length - 1
          while (cut > 1 && ctx.measureText(w.slice(0, cut)).width > width) cut--
          out.push(w.slice(0, cut))
          w = w.slice(cut)
        }
        line = w
      }
    }
    out.push(line)
  }
  return out
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function hline(ctx: Ctx, x1: number, x2: number, y: number, color = C.line, width = 1) {
  ctx.fillStyle = color
  ctx.fillRect(x1, y, x2 - x1, width)
}

function drawLogo(ctx: Ctx, logo: HTMLImageElement | undefined, x: number, y: number, maxW: number, maxH: number, align: 'left' | 'center' = 'left') {
  if (!logo) return 0
  const k = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight)
  const w = logo.naturalWidth * k
  const h = logo.naturalHeight * k
  ctx.drawImage(logo, align === 'center' ? x - w / 2 : x, y + (maxH - h) / 2, w, h)
  return w
}

async function toJpeg(canvas: HTMLCanvasElement): Promise<PdfImage> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
  if (!blob) throw new Error('No se pudo crear el PDF')
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height }
}

async function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('No se pudo crear la imagen')
  return blob
}

/** Junta las páginas una debajo de otra, para mandarlas como una sola imagen. */
function stack(pages: HTMLCanvasElement[]): HTMLCanvasElement {
  if (pages.length === 1) return pages[0]
  const out = document.createElement('canvas')
  out.width = pages[0].width
  out.height = pages.reduce((s, p) => s + p.height, 0)
  const ctx = out.getContext('2d')!
  let y = 0
  for (const p of pages) {
    ctx.drawImage(p, 0, y)
    y += p.height
  }
  return out
}

// ───────────────────────────── Cotización (hoja carta) ─────────────────────────────

const M = 40 // margen
const COL = { qty: 372, price: 470, total: PAGE.w - M - 12 }
const NAME_W = 236
const FOOT_GAP = 46

type QuoteRow = { lines: string[]; sub: string[]; qty: string; price: string; total: string; h: number }

function quoteRows(ctx: Ctx, d: QuoteDoc): QuoteRow[] {
  const money = (c: number) => formatMoney(c, d.currency)
  return d.lines.map((l) => {
    const lines = wrap(ctx, l.name, NAME_W, 10.5, 600)
    const sub = [
      ...(l.detail ? wrap(ctx, l.detail, NAME_W, 9) : []),
      ...(l.discountCents ? [`Descuento${l.discountLabel ? ` ${l.discountLabel}` : ''}: −${money(l.discountCents)}`] : []),
    ]
    return {
      lines,
      sub,
      qty: `${formatQuantity(l.quantity)} ${l.unit}`,
      price: money(l.unitPriceCents),
      total: money(l.grossCents - l.discountCents),
      h: 18 + lines.length * 14 + sub.length * 12,
    }
  })
}

function quoteHeader(ctx: Ctx, d: QuoteDoc, logo: HTMLImageElement | undefined, page: number) {
  if (page === 0) {
    ctx.fillStyle = C.night
    ctx.fillRect(0, 0, PAGE.w, 150)
    hline(ctx, 0, PAGE.w, 150, C.gold, 3)
    drawLogo(ctx, logo, M - 6, 14, 200, 122)
    const R = PAGE.w - M
    text(ctx, 'COTIZACIÓN', R, 52, { size: 10, weight: 700, color: C.gold, align: 'right', track: 3 })
    text(ctx, d.numberLabel, R, 86, { size: 30, weight: 800, color: '#ffffff', align: 'right' })
    text(ctx, `Fecha: ${d.dateLabel}`, R, 110, { size: 10, color: C.onNight, align: 'right' })
    text(ctx, `Vigente hasta el ${d.validLabel}`, R, 125, { size: 10, weight: 600, color: C.gold, align: 'right' })
    return 150
  }
  // Páginas siguientes: una franja corta con el sello y el número.
  ctx.fillStyle = C.night
  ctx.fillRect(0, 0, PAGE.w, 58)
  hline(ctx, 0, PAGE.w, 58, C.gold, 2)
  drawLogo(ctx, logo, M - 4, 6, 70, 46)
  text(ctx, `Cotización ${d.numberLabel} (continuación)`, PAGE.w - M, 35, { size: 11, weight: 700, color: '#ffffff', align: 'right' })
  return 58
}

function tableHead(ctx: Ctx, y: number) {
  roundRect(ctx, M, y, PAGE.w - 2 * M, 26, 6, C.sageSoft)
  const o = { size: 8.5, weight: 700, color: C.sage, track: 1 }
  text(ctx, 'DESCRIPCIÓN', M + 12, y + 17, o)
  text(ctx, 'CANTIDAD', COL.qty, y + 17, { ...o, align: 'right' })
  text(ctx, 'PRECIO', COL.price, y + 17, { ...o, align: 'right' })
  text(ctx, 'IMPORTE', COL.total, y + 17, { ...o, align: 'right' })
  return y + 26
}

function footer(ctx: Ctx, d: QuoteDoc, page: number, pages: number, h: number) {
  const FOOT_Y = h - FOOT_GAP
  hline(ctx, M, PAGE.w - M, FOOT_Y - 14, C.gold, 1)
  text(ctx, 'Gracias por tu preferencia.', M, FOOT_Y + 2, { size: 10, weight: 700 })
  const contact = [d.businessPhone && `WhatsApp ${d.businessPhone}`, d.businessName].filter(Boolean).join(' · ')
  text(ctx, contact, PAGE.w - M, FOOT_Y + 2, { size: 9, color: C.muted, align: 'right' })
  if (pages > 1) text(ctx, `Página ${page + 1} de ${pages}`, PAGE.w / 2, h - 18, { size: 8, color: C.muted, align: 'center' })
}

/**
 * Dibuja la cotización en una o más páginas carta. Con `fit`, una cotización de una sola página se recorta a lo que
 * ocupa (para la imagen de WhatsApp, sin media hoja en blanco); el PDF siempre va en carta.
 */
export async function renderQuotePages(d: QuoteDoc, logoSrc?: string, fit = false): Promise<HTMLCanvasElement[]> {
  const logo = await ready(documentLogoSrc(logoSrc))
  const measure = newCanvas(1, 1).ctx
  const money = (c: number) => formatMoney(c, d.currency)
  const rows = quoteRows(measure, d)

  // Totales y condiciones: se calculan antes para saber si caben en la página.
  const totals: { label: string; value: string; strong?: boolean; color?: string }[] = []
  if (d.discountCents > 0) totals.push({ label: 'Importe', value: money(d.grossCents) }, { label: 'Descuentos', value: `−${money(d.discountCents)}`, color: C.expense })
  if (d.taxCents > 0) totals.push({ label: 'Subtotal', value: money(d.subtotalCents) }, { label: `IVA ${d.taxRate}%`, value: money(d.taxCents) })
  const after: { label: string; value: string; strong?: boolean }[] = []
  if (d.advanceCents > 0) after.push({ label: 'Anticipo para iniciar', value: money(d.advanceCents) }, { label: 'Saldo', value: money(d.totalCents - d.advanceCents), strong: true })
  const terms = [`Vigencia: hasta el ${d.validLabel}`]
  if (d.advanceCents > 0) terms.push(`Anticipo para iniciar: ${money(d.advanceCents)}`)
  if (d.payByLabel) terms.push(`Fecha estimada de pago: ${d.payByLabel}`)
  const notes = d.notes ? wrap(measure, d.notes, 260, 9.5) : []
  const totalsH = totals.length * 20 + 50 + after.length * 20
  const leftH = 30 + terms.length * 15 + 12 + (notes.length ? 26 + notes.length * 13 : 0)
  const closingH = Math.max(totalsH, leftH) + 24

  // Reparte las filas en páginas.
  type Page = { rows: QuoteRow[]; closing: boolean }
  const plan: Page[] = []
  let current: Page = { rows: [], closing: false }
  let y = 150 + 112 + 26 // cabecera + bloque de datos + encabezado de tabla
  const limit = PAGE.h - FOOT_GAP - 30
  for (const r of rows) {
    if (y + r.h > limit && current.rows.length) {
      plan.push(current)
      current = { rows: [], closing: false }
      y = 58 + 24 + 26
    }
    current.rows.push(r)
    y += r.h
  }
  if (y + 18 + closingH > limit) {
    plan.push(current)
    current = { rows: [], closing: true }
  } else current.closing = true
  plan.push(current)

  const drawPage = (pg: Page, i: number, h: number): { canvas: HTMLCanvasElement; end: number } => {
    const { canvas, ctx } = newCanvas(PAGE.w, h)
    let y = quoteHeader(ctx, d, logo, i)
    let end = y
    if (i === 0) {
      // Para / De
      y += 30
      text(ctx, 'PARA', M, y, { size: 8.5, weight: 700, color: C.muted, track: 1.5 })
      text(ctx, 'DE', 340, y, { size: 8.5, weight: 700, color: C.muted, track: 1.5 })
      text(ctx, d.customer || 'Cliente', M, y + 20, { size: 15, weight: 700 })
      if (d.title) wrap(ctx, d.title, 270, 10.5).slice(0, 2).forEach((t, k) => text(ctx, t, M, y + 38 + k * 14, { size: 10.5, color: C.sage, weight: 600 }))
      text(ctx, d.businessName, 340, y + 20, { size: 12, weight: 700 })
      const from = [d.businessPhone && `Tel. ${d.businessPhone}`, ...(d.businessAddress ? wrap(ctx, d.businessAddress, 232, 10) : [])].filter(Boolean) as string[]
      from.slice(0, 3).forEach((t, k) => text(ctx, t, 340, y + 37 + k * 14, { size: 10, color: C.muted }))
      y = 150 + 112
    } else y += 24
    if (pg.rows.length) {
      y = tableHead(ctx, y)
      for (const r of pg.rows) {
        let ty = y + 18
        r.lines.forEach((t, k) => text(ctx, t, M + 12, ty + k * 14, { size: 10.5, weight: 600 }))
        text(ctx, r.qty, COL.qty, ty, { size: 10.5, color: C.muted, align: 'right' })
        text(ctx, r.price, COL.price, ty, { size: 10.5, color: C.muted, align: 'right' })
        text(ctx, r.total, COL.total, ty, { size: 10.5, weight: 700, align: 'right' })
        ty += r.lines.length * 14 - 2
        r.sub.forEach((t, k) => text(ctx, t, M + 12, ty + k * 12, { size: 9, color: t.startsWith('Descuento') ? C.expense : C.muted }))
        y += r.h
        hline(ctx, M, PAGE.w - M, y - 1)
      }
    }
    if (pg.closing) {
      y += 18
      // Totales a la derecha
      const X1 = 330
      const X2 = PAGE.w - M
      let ty = y
      for (const t of totals) {
        text(ctx, t.label, X1 + 4, ty + 13, { size: 10.5, color: C.muted })
        text(ctx, t.value, X2 - 12, ty + 13, { size: 10.5, weight: 600, color: t.color ?? C.ink, align: 'right' })
        ty += 20
      }
      roundRect(ctx, X1, ty + 2, X2 - X1, 44, 9, C.night)
      text(ctx, 'TOTAL', X1 + 14, ty + 29, { size: 10, weight: 700, color: C.gold, track: 2 })
      text(ctx, money(d.totalCents), X2 - 14, ty + 32, { size: 19, weight: 800, color: '#ffffff', align: 'right' })
      ty += 54
      for (const a of after) {
        text(ctx, a.label, X1 + 4, ty + 13, { size: 10.5, color: a.strong ? C.ink : C.muted, weight: a.strong ? 700 : 400 })
        text(ctx, a.value, X2 - 12, ty + 13, { size: 10.5, weight: 700, color: a.strong ? C.sage : C.ink, align: 'right' })
        ty += 20
      }
      // Condiciones y notas a la izquierda
      const boxH = 30 + terms.length * 15 + 4
      roundRect(ctx, M, y, 270, boxH, 9, C.goldSoft)
      text(ctx, 'CONDICIONES', M + 14, y + 20, { size: 8.5, weight: 700, color: C.goldInk, track: 1.5 })
      terms.forEach((t, k) => text(ctx, t, M + 14, y + 38 + k * 15, { size: 9.5, color: C.goldInk, weight: k === 0 ? 600 : 400 }))
      if (notes.length) {
        const ny = y + boxH + 22
        text(ctx, 'NOTAS', M, ny, { size: 8.5, weight: 700, color: C.muted, track: 1.5 })
        notes.forEach((t, k) => text(ctx, t, M, ny + 16 + k * 13, { size: 9.5, color: C.ink }))
        end = Math.max(end, ny + 16 + notes.length * 13)
      }
      end = Math.max(end, ty, y + boxH)
    }
    end = Math.max(end, y)
    footer(ctx, d, i, plan.length, h)
    return { canvas, end }
  }
  const pages = plan.map((pg, i) => drawPage(pg, i, PAGE.h))
  const extra = d.sketches?.length ? [sketchPage(d, fit, plan.length, plan.length + 1)] : []
  if (fit && pages.length === 1) {
    const h = Math.min(PAGE.h, Math.ceil(pages[0].end + 40 + FOOT_GAP + 14))
    return [drawPage(plan[0], 0, h).canvas, ...extra]
  }
  return [...pages.map((p) => p.canvas), ...extra]
}

const SK_FILL: Record<string, string | undefined> = { body: '#ffffff', door: '#e6eeea', drawer: '#f1e7d2', zoclo: '#3a3a3a', top: '#c9b48a', ghost: undefined }

/** Dibuja un boceto (geometría en cm) dentro de la caja dada, centrado y a escala. Devuelve el alto que ocupó. */
function drawSketch(ctx: Ctx, sk: Sketch, x: number, y: number, maxW: number, maxH: number): number {
  const fs = Math.max(sk.w, sk.h * 1.4) / 26
  const pad = { l: fs * 4.6, r: fs * 0.8, t: fs * 1.8, b: fs * 3.4 }
  const scale = Math.min(maxW / (sk.w + pad.l + pad.r), maxH / (sk.h + pad.t + pad.b))
  const ox = x + (maxW - (sk.w + pad.l + pad.r) * scale) / 2 + pad.l * scale
  const oy = y + pad.t * scale
  const X = (v: number) => ox + v * scale
  const Y = (v: number) => oy + v * scale
  const sw = Math.max(0.6, (fs / 9) * scale)
  ctx.save()
  ctx.lineCap = 'round'
  for (const s of sk.shapes) {
    if (s.t === 'rect') {
      const fill = SK_FILL[s.role]
      if (fill) {
        ctx.fillStyle = fill
        ctx.fillRect(X(s.x), Y(s.y), s.w * scale, s.h * scale)
      }
      ctx.strokeStyle = C.ink
      ctx.lineWidth = s.role === 'body' ? sw * 1.6 : sw
      ctx.setLineDash(s.role === 'ghost' ? [sw * 4, sw * 3] : [])
      ctx.strokeRect(X(s.x), Y(s.y), s.w * scale, s.h * scale)
      ctx.setLineDash([])
    } else if (s.t === 'line') {
      ctx.strokeStyle = s.role === 'tube' ? '#8a6d1f' : C.ink
      ctx.lineWidth = s.role === 'tube' ? sw * 2.6 : s.role === 'handle' ? sw * 1.8 : sw
      ctx.beginPath()
      ctx.moveTo(X(s.x1), Y(s.y1))
      ctx.lineTo(X(s.x2), Y(s.y2))
      ctx.stroke()
    } else {
      const dim = s.role === 'dim'
      const size = (dim ? fs : fs * 0.8) * scale
      if (s.anchor === 'end') text(ctx, s.text, X(-fs * 0.5), Y(s.y) + size * 0.35, { size, weight: 700, align: 'right' })
      else text(ctx, s.text, X(s.x), Y(dim ? s.y + fs * 1.3 : s.y), { size, weight: dim ? 700 : 500, align: s.anchor === 'middle' ? 'center' : 'left' })
    }
  }
  text(ctx, sk.notes.join(' · '), x + maxW / 2, Y(sk.h + fs * 2.7), { size: Math.max(7.5, fs * 0.78 * scale), color: C.muted, align: 'center' })
  ctx.restore()
  return (sk.h + pad.t + pad.b) * scale
}

/** La hoja de bocetos que acompaña a la cotización. Con `fit` mide solo lo que ocupa (para la imagen). */
function sketchPage(d: QuoteDoc, fit: boolean, page: number, pages: number): HTMLCanvasElement {
  const list = d.sketches ?? []
  const each = Math.min(300, (PAGE.h - 150 - FOOT_GAP) / list.length - 34)
  const draw = (h: number) => {
    const { canvas, ctx } = newCanvas(PAGE.w, h)
    let y = 44
    text(ctx, list.length === 1 ? 'BOCETO DE MUESTRA' : 'BOCETOS DE MUESTRA', M, y, { size: 9.5, weight: 700, color: C.sage, track: 2.5 })
    text(ctx, `Cotización ${d.numberLabel}`, PAGE.w - M, y, { size: 9, color: C.muted, align: 'right' })
    hline(ctx, M, PAGE.w - M, y + 12, C.gold, 1)
    y += 34
    for (const s of list) {
      text(ctx, s.title, M, y, { size: 10.5, weight: 700 })
      y += 10
      y += drawSketch(ctx, s.sketch, M, y, PAGE.w - 2 * M, each) + 24
    }
    text(ctx, 'Dibujo ilustrativo, visto de frente. Las medidas finales se confirman en obra.', M, y, { size: 8.5, color: C.muted })
    if (!fit) footer(ctx, d, page, pages, h)
    return { canvas, end: y + 20 }
  }
  const full = draw(PAGE.h)
  return fit ? draw(Math.min(PAGE.h, Math.ceil(full.end))).canvas : full.canvas
}

export async function quoteImage(d: QuoteDoc, logo?: string): Promise<Blob> {
  return toPng(stack(await renderQuotePages(d, logo, true)))
}

export async function quoteDesignedPdf(d: QuoteDoc, logo?: string): Promise<Uint8Array> {
  const pages = await renderQuotePages(d, logo)
  return buildImagePdf(await Promise.all(pages.map(toJpeg)), PAGE.w, PAGE.h)
}

// ───────────────────────────── Comprobante (formato angosto) ─────────────────────────────

const RW = 380

export async function renderReceipt(r: Receipt, logoSrc?: string): Promise<HTMLCanvasElement> {
  const logo = await ready(documentLogoSrc(logoSrc))
  const money = (c: number) => formatMoney(c, r.currency)
  const measure = newCanvas(1, 1).ctx
  const P = 26
  const items = r.lines.length
    ? r.lines.map((l) => ({ name: wrap(measure, `${formatQuantity(l.quantity)} × ${l.name}`, RW - 2 * P - 110, 10.5, 600), total: money(l.totalCents), note: l.discountCents ? `Descuento −${money(l.discountCents)}` : '' }))
    : [{ name: wrap(measure, r.concept || 'Venta', RW - 2 * P - 110, 10.5, 600), total: money(r.totalCents), note: '' }]
  const extra = [r.customer && `Cliente: ${r.customer}`].filter(Boolean) as string[]
  const credit = r.credit
    ? [
        ...(r.credit.paidCents > 0 ? [['Anticipo', money(r.credit.paidCents)]] : []),
        ['Saldo pendiente', money(r.credit.remainingCents)],
        ...(r.credit.dueLabel ? [['Fecha de liquidación', r.credit.dueLabel]] : []),
      ]
    : []
  // Se dibuja en una hoja alta y al final se recorta a lo que ocupó.
  const { canvas, ctx } = newCanvas(RW, 2400)

  ctx.fillStyle = C.night
  ctx.fillRect(0, 0, RW, 150)
  hline(ctx, 0, RW, 150, C.gold, 3)
  drawLogo(ctx, logo, RW / 2, 12, 230, 126, 'center')

  let y = 150 + 34
  text(ctx, 'COMPROBANTE DE VENTA', RW / 2, y, { size: 9.5, weight: 700, color: C.sage, align: 'center', track: 2.5 })
  text(ctx, r.businessName, RW / 2, y + 22, { size: 13, weight: 700, align: 'center' })
  const meta = [`Folio ${r.folio}`, r.dateLabel].join(' · ')
  text(ctx, meta, RW / 2, y + 40, { size: 9.5, color: C.muted, align: 'center' })
  if (r.businessPhone) text(ctx, `Tel. ${r.businessPhone}`, RW / 2, y + 54, { size: 9.5, color: C.muted, align: 'center' })
  y += 70
  extra.forEach((t) => {
    text(ctx, t, P, y, { size: 10, weight: 600 })
    y += 15
  })
  y += 8
  hline(ctx, P, RW - P, y)
  y += 6
  for (const i of items) {
    let ty = y + 16
    i.name.forEach((t, k) => text(ctx, t, P, ty + k * 14, { size: 10.5, weight: 600 }))
    text(ctx, i.total, RW - P, ty, { size: 10.5, weight: 700, align: 'right' })
    ty += i.name.length * 14 - 2
    if (i.note) text(ctx, i.note, P, ty, { size: 9, color: C.expense })
    y += 16 + i.name.length * 14 + (i.note ? 12 : 0)
  }
  y += 8
  roundRect(ctx, P, y, RW - 2 * P, 46, 10, C.night)
  text(ctx, 'TOTAL', P + 14, y + 28, { size: 10, weight: 700, color: C.gold, track: 2 })
  text(ctx, money(r.totalCents), RW - P - 14, y + 31, { size: 19, weight: 800, color: '#ffffff', align: 'right' })
  y += 62
  text(ctx, 'Pago', P, y, { size: 10, color: C.muted })
  text(ctx, r.payment, RW - P, y, { size: 10, weight: 700, align: 'right', color: C.ink })
  y += 18
  for (const [label, value] of credit) {
    text(ctx, label, P, y, { size: 10, color: C.muted })
    text(ctx, value, RW - P, y, { size: 10, weight: 700, align: 'right' })
    y += 18
  }
  y += 8
  hline(ctx, P, RW - P, y, C.gold)
  text(ctx, '¡Gracias por tu compra!', RW / 2, y + 26, { size: 11, weight: 700, align: 'center' })
  const H = Math.ceil(y + 48)
  const out = newCanvas(RW, H)
  out.ctx.drawImage(canvas, 0, 0, canvas.width, H * SCALE, 0, 0, RW, H)
  return out.canvas
}

export async function receiptImage(r: Receipt, logo?: string): Promise<Blob> {
  return toPng(await renderReceipt(r, logo))
}

export async function receiptDesignedPdf(r: Receipt, logo?: string): Promise<Uint8Array> {
  const canvas = await renderReceipt(r, logo)
  return buildImagePdf([await toJpeg(canvas)], canvas.width / SCALE, canvas.height / SCALE)
}
