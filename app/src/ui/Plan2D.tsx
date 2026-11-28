import { useMemo, useRef, useState } from 'react'
import { Ruler } from 'lucide-react'
import { buildImagePdf } from '../data/pdf'
import { canShareFiles, downloadBlob, shareFile } from './share'

type Props = { width: number; height: number; depth: number; doors: number; drawers: number; title: string; business: string; customer?: string }

const W = 560, H = 420

/**
 * Plano de frente con todas las medidas (y un costado con el fondo), para que el cliente lo apruebe antes de cortar.
 * Medidas en mm; se muestran en cm. Se manda como PDF o imagen.
 */
export default function Plan2D({ width, height, depth, doors, drawers, title, business, customer = '' }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const [msg, setMsg] = useState('')
  const cm = (mm: number) => `${Math.round(mm / 10 * 10) / 10}`.replace(/\.0$/, '')

  const g = useMemo(() => {
    const Wm = Math.max(100, width), Hm = Math.max(100, height), Dm = Math.max(50, depth)
    const k = Math.min(330 / Wm, 270 / Hm, 330 / (Wm + Dm))
    const fw = Wm * k, fh = Hm * k, sw = Dm * k
    const x0 = 70, y0 = 70
    const sx = x0 + fw + 60
    const drawerW = drawers && doors ? fw / 3 : drawers ? fw : 0
    const parts: { x: number; y: number; w: number; h: number; kind: 'door' | 'drawer'; mmW: number; mmH: number }[] = []
    for (let i = 0; i < drawers; i++) parts.push({ x: x0, y: y0 + (i * fh) / drawers, w: drawerW, h: fh / drawers, kind: 'drawer', mmW: (drawerW / fw) * Wm, mmH: Hm / drawers })
    for (let i = 0; i < doors; i++) parts.push({ x: x0 + drawerW + (i * (fw - drawerW)) / doors, y: y0, w: (fw - drawerW) / doors, h: fh, kind: 'door', mmW: ((fw - drawerW) / fw) * Wm / doors, mmH: Hm })
    return { fw, fh, sw, x0, y0, sx, parts }
  }, [width, height, depth, doors, drawers])

  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, side: 'h' | 'v', key: string) => {
    const tick = 5
    return (
      <g key={key} stroke="#b4442d" fill="#b4442d" strokeWidth="1">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        {side === 'h' ? <><line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} /><line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} /></> : <><line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} /><line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} /></>}
        <text stroke="none" fontSize="12" fontFamily="system-ui, sans-serif" textAnchor="middle"
          x={side === 'h' ? (x1 + x2) / 2 : x1 - 8} y={side === 'h' ? y1 - 6 : (y1 + y2) / 2}
          transform={side === 'v' ? `rotate(-90 ${x1 - 8} ${(y1 + y2) / 2})` : undefined}>{label}</text>
      </g>
    )
  }

  async function render(): Promise<HTMLCanvasElement | undefined> {
    const el = svg.current
    if (!el) return undefined
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(el))}`
    await new Promise((ok) => { img.onload = ok })
    const c = document.createElement('canvas')
    c.width = W * 3
    c.height = H * 3
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c
  }
  const fileBase = `${title.replace(/[^\w\sáéíóúñ-]/gi, '').trim().replace(/\s+/g, '-') || 'mueble'}-plano`

  async function send(kind: 'pdf' | 'png') {
    const c = await render()
    if (!c) return
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, kind === 'pdf' ? 'image/jpeg' : 'image/png', 0.92))
    if (!blob) return
    let out: Blob = blob
    let name = `${fileBase}.png`
    if (kind === 'pdf') {
      const jpeg = new Uint8Array(await blob.arrayBuffer())
      out = new Blob([buildImagePdf([{ jpeg, width: c.width, height: c.height }], 792, 594) as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
      name = `${fileBase}.pdf`
    }
    const file = new File([out], name, { type: out.type })
    if (canShareFiles()) await shareFile(file, title, `Plano de ${title} · ${business}. Por favor revise las medidas y confírmenos antes de fabricar.`).catch(() => downloadBlob(out, name))
    else await downloadBlob(out, name)
    setMsg('Plano listo para mandar.')
  }

  const { fw, fh, sw, x0, y0, sx, parts } = g
  const doorsOnly = parts.filter((p) => p.kind === 'door')
  return (
    <section className="card form">
      <h2><Ruler className="i-inline" aria-hidden /> Plano con medidas</h2>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Plano de ${title}`} style={{ background: '#fff', borderRadius: 12 }}>
        <rect width={W} height={H} fill="#fff" />
        <text x={x0} y="22" fontSize="14" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#222">{title}{customer ? ` · ${customer}` : ''}</text>
        <text x={x0} y="38" fontSize="10" fontFamily="system-ui, sans-serif" fill="#777">Medidas en centímetros · {business}</text>
        <rect x={x0} y={y0} width={fw} height={fh} fill="#f6f4ef" stroke="#333" strokeWidth="1.5" />
        {parts.map((p, i) => (
          <g key={i}>
            <rect x={p.x + 2} y={p.y + 2} width={Math.max(1, p.w - 4)} height={Math.max(1, p.h - 4)} fill="#fff" stroke="#555" strokeWidth="1" />
            {p.kind === 'drawer' && <line x1={p.x + p.w / 2 - 12} y1={p.y + 10} x2={p.x + p.w / 2 + 12} y2={p.y + 10} stroke="#555" strokeWidth="2" />}
            {p.kind === 'door' && <line x1={i % 2 ? p.x + 8 : p.x + p.w - 8} y1={p.y + p.h / 2 - 12} x2={i % 2 ? p.x + 8 : p.x + p.w - 8} y2={p.y + p.h / 2 + 12} stroke="#555" strokeWidth="2" />}
          </g>
        ))}
        {dim(x0, y0 + fh + 22, x0 + fw, y0 + fh + 22, `${cm(width)} cm`, 'h', 'w')}
        {dim(x0 - 22, y0, x0 - 22, y0 + fh, `${cm(height)} cm`, 'v', 'h')}
        {doorsOnly.length > 1 && doorsOnly.map((p, i) => dim(p.x, y0 - 12, p.x + p.w, y0 - 12, cm(p.mmW), 'h', `d${i}`))}
        {drawers > 1 && dim(x0 + fw + 14, y0 + (drawers ? 0 : 0), x0 + fw + 14, y0 + fh / drawers, cm(height / drawers), 'v', 'dr')}
        <rect x={sx} y={y0} width={sw} height={fh} fill="#f6f4ef" stroke="#333" strokeWidth="1.5" />
        <text x={sx + sw / 2} y={y0 + fh / 2} fontSize="10" textAnchor="middle" fontFamily="system-ui, sans-serif" fill="#777">costado</text>
        {dim(sx, y0 + fh + 22, sx + sw, y0 + fh + 22, `${cm(depth)} cm`, 'h', 'dp')}
        <text x={x0} y={H - 34} fontSize="11" fontFamily="system-ui, sans-serif" fill="#333">{doors ? `${doors} puerta${doors > 1 ? 's' : ''}` : ''}{doors && drawers ? ' · ' : ''}{drawers ? `${drawers} cajón${drawers > 1 ? 'es' : ''}` : ''}</text>
        <text x={x0} y={H - 14} fontSize="11" fontFamily="system-ui, sans-serif" fill="#333">Aprobado por el cliente: ______________________   Fecha: ___________</text>
      </svg>
      <div className="quick">
        <button type="button" className="btn ghost" onClick={() => void send('png')}>Mandar imagen</button>
        <button type="button" className="btn primary" onClick={() => void send('pdf')}>Mandar PDF</button>
      </div>
      <small className="muted">Mándalo al cliente para que confirme las medidas antes de cortar. Las medidas por puerta son aproximadas al dibujo.</small>
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
