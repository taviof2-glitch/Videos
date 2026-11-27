import { useRef, useState } from 'react'
import { specTitle, type CutSpec } from '../data/cutlist'
import { sketch, type Shape, type Sketch as SketchData } from '../data/sketch'
import { canShareFiles, downloadBlob, shareFile } from './share'

// Colores fijos (no variables CSS): el mismo dibujo se convierte en imagen para compartir.
const INK = '#12100d'
const FILL: Record<Extract<Shape, { t: 'rect' }>['role'], string> = { body: '#ffffff', door: '#e6eeea', drawer: '#f1e7d2', zoclo: '#3a3a3a', top: '#c9b48a', ghost: 'none' }
const FONT = 'Figtree, system-ui, sans-serif'

/** Boceto 2D de frente del mueble, con sus medidas. Se puede compartir como imagen. */
export default function Sketch({ spec, drawing, share = true }: { spec?: CutSpec; /** Un boceto ya armado (muebles que no salen del despiece normal). */ drawing?: { title: string; sketch: SketchData }; share?: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const [msg, setMsg] = useState('')
  if (!drawing && !(spec && spec.largo > 0 && spec.alto > 0)) return null
  const sk = drawing ? drawing.sketch : sketch(spec!)
  // Letra y márgenes proporcionales al mueble, para que se lea igual en un escritorio que en una cocina de 4 m.
  const fs = Math.max(sk.w, sk.h * 1.4) / 26
  const pad = { l: fs * 4.6, r: fs * 0.8, t: fs * 1.8, b: fs * 3.4 }
  // En un mueble angosto la línea de notas es más ancha que el dibujo: se abre espacio a los lados para que no se corte.
  const notesW = sk.notes.join(' · ').length * fs * 0.42
  const extra = Math.max(0, notesW - (sk.w + pad.l + pad.r)) / 2
  const vb = { x: -pad.l - extra, y: -pad.t, w: sk.w + pad.l + pad.r + 2 * extra, h: sk.h + pad.t + pad.b }
  const sw = Math.max(0.5, fs / 9)
  const title = drawing ? drawing.title : specTitle(spec!)

  async function toPng(): Promise<Blob> {
    const W = 1200
    const Hpx = Math.round((W * vb.h) / vb.w)
    // La copia lleva tamaño en pixeles: sin él algunos navegadores no la dibujan.
    const svg = ref.current!.cloneNode(true) as SVGSVGElement
    svg.setAttribute('width', String(W))
    svg.setAttribute('height', String(Hpx))
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok()
      img.onerror = () => bad(new Error('No se pudo generar la imagen'))
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = Hpx
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('No se pudo generar la imagen'))), 'image/png'))
  }

  async function send() {
    setMsg('')
    try {
      const blob = await toPng()
      const name = spec ? `boceto-${spec.kind}-${spec.largo}x${spec.alto}.png` : `boceto-${Math.round(sk.w)}x${Math.round(sk.h)}.png`
      if (canShareFiles()) await shareFile(new File([blob], name, { type: 'image/png' }), 'Boceto', title)
      else if (await downloadBlob(blob, name)) setMsg('Imagen descargada.')
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setMsg(e instanceof Error ? e.message : 'No se pudo generar la imagen')
    }
  }

  return (
    <figure className="sketch">
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={`Boceto de frente: ${title}. ${sk.notes.join(', ')}`}>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#ffffff" />
        {sk.shapes.map((s, i) => {
          if (s.t === 'rect') return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={FILL[s.role]} stroke={INK} strokeWidth={s.role === 'body' ? sw * 1.6 : sw} strokeDasharray={s.role === 'ghost' ? `${sw * 4} ${sw * 3}` : undefined} />
          if (s.t === 'line') return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.role === 'tube' ? '#8a6d1f' : INK} strokeWidth={s.role === 'tube' ? sw * 2.6 : s.role === 'handle' ? sw * 1.8 : sw} strokeLinecap="round" />
          return (
            <text key={i} x={s.anchor === 'end' ? -fs * 0.5 : s.x} y={s.role === 'dim' && s.anchor === 'middle' ? s.y + fs * 1.3 : s.y} fontFamily={FONT} fontSize={s.role === 'dim' ? fs : fs * 0.8} fontWeight={s.role === 'dim' ? 700 : 500} fill={INK} textAnchor={s.anchor} dominantBaseline={s.anchor === 'end' ? 'central' : undefined}>
              {s.text}
            </text>
          )
        })}
        <text x={vb.x + vb.w / 2} y={sk.h + fs * 2.7} fontFamily={FONT} fontSize={fs * 0.78} fill="#5c5f5a" textAnchor="middle">{sk.notes.join(' · ')}</text>
      </svg>
      <figcaption>
        <small className="muted">Boceto de muestra, visto de frente.</small>
        {share && <button type="button" className="btn small ghost" onClick={() => void send()}>Compartir boceto</button>}
      </figcaption>
      {msg && <p className="success" role="status">{msg}</p>}
    </figure>
  )
}
