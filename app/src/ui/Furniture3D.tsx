import { useMemo, useRef, useState } from 'react'
import { Box } from 'lucide-react'
import { canShareFiles, downloadBlob, shareFile } from './share'

/** Colores de melamina comunes: cara, costado y tapa (más claro u oscuro para que se vea el volumen). */
const COLORS: Record<string, [string, string, string]> = {
  Blanco: ['#f4f4f1', '#d9d9d4', '#ffffff'],
  Nogal: ['#8a5a36', '#6d4527', '#a06c45'],
  Roble: ['#c49a6c', '#a87f54', '#d6b085'],
  Negro: ['#2b2b2b', '#1a1a1a', '#3a3a3a'],
  Gris: ['#9a9c9e', '#7e8082', '#b2b4b6'],
  Tzalam: ['#a9825d', '#8d6a49', '#bf9873'],
}

type Props = { width: number; height: number; depth: number; doors: number; drawers: number; title: string; business: string }

/**
 * Vista 3D sencilla del mueble (isométrica) con su color, puertas y cajones, para mandarla al cliente junto con la
 * cotización. Medidas en mm.
 */
export default function Furniture3D({ width, height, depth, doors, drawers, title, business }: Props) {
  const [color, setColor] = useState('Blanco')
  const [flip, setFlip] = useState(false)
  const [msg, setMsg] = useState('')
  const svg = useRef<SVGSVGElement>(null)
  const [face, side, top] = COLORS[color]
  const line = color === 'Negro' ? '#5a5a5a' : 'rgba(0,0,0,.35)'

  const g = useMemo(() => {
    // Escala para que quepa en 320 px de ancho.
    const W = Math.max(100, width), H = Math.max(100, height), D = Math.max(50, depth)
    const k = 260 / (W + D * 0.6)
    const w = W * k, h = H * k, dx = D * k * 0.55, dy = D * k * 0.32
    const x0 = flip ? 20 + dx : 20, y0 = 20 + dy
    const sx = flip ? -1 : 1
    const front = `${x0},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + h} ${x0},${y0 + h}`
    const edge = flip ? x0 : x0 + w
    const sidePts = `${edge},${y0} ${edge + sx * dx},${y0 - dy} ${edge + sx * dx},${y0 + h - dy} ${edge},${y0 + h}`
    const topPts = `${x0},${y0} ${x0 + sx * dx},${y0 - dy} ${x0 + w + sx * dx},${y0 - dy} ${x0 + w},${y0}`
    // Frente: cajones a la izquierda (o todo) y puertas en el resto.
    const parts: { x: number; y: number; w: number; h: number; kind: 'door' | 'drawer' }[] = []
    const pad = 3
    const drawerW = drawers && doors ? w / 3 : drawers ? w : 0
    for (let i = 0; i < drawers; i++) parts.push({ x: x0 + pad, y: y0 + pad + (i * (h - pad)) / drawers, w: drawerW - pad * 2, h: (h - pad) / drawers - pad, kind: 'drawer' })
    const rest = w - drawerW
    for (let i = 0; i < doors; i++) parts.push({ x: x0 + drawerW + pad + (i * (rest - pad)) / doors, y: y0 + pad, w: (rest - pad) / doors - pad, h: h - pad * 2, kind: 'door' })
    return { front, sidePts, topPts, parts, vw: w + dx + 40, vh: h + dy + 60, x0, y0, w, h }
  }, [width, height, depth, doors, drawers, flip])

  async function save() {
    const el = svg.current
    if (!el) return
    const data = new XMLSerializer().serializeToString(el)
    const img = new Image()
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`
    await new Promise((ok) => { img.onload = ok })
    const canvas = document.createElement('canvas')
    canvas.width = g.vw * 3
    canvas.height = g.vh * 3
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
    if (!blob) return
    const name = `${title.replace(/[^\w\sáéíóúñ-]/gi, '').trim().replace(/\s+/g, '-') || 'mueble'}-3d.png`
    if (canShareFiles()) await shareFile(new File([blob], name, { type: 'image/png' }), title, `${title} · ${business}`).catch(() => downloadBlob(blob, name))
    else await downloadBlob(blob, name)
    setMsg('Imagen lista.')
  }

  return (
    <section className="card form furniture-3d">
      <h2><Box className="i-inline" aria-hidden /> Vista 3D</h2>
      <svg ref={svg} viewBox={`0 0 ${g.vw} ${g.vh}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`Vista 3D de ${title}`} style={{ background: '#fff', borderRadius: 12 }}>
        <polygon points={g.topPts} fill={top} stroke={line} strokeWidth="1" />
        <polygon points={g.sidePts} fill={side} stroke={line} strokeWidth="1" />
        <polygon points={g.front} fill={face} stroke={line} strokeWidth="1.2" />
        {g.parts.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width={Math.max(1, p.w)} height={Math.max(1, p.h)} fill={face} stroke={line} strokeWidth="1" rx="1.5" />
            {p.kind === 'drawer'
              ? <rect x={p.x + p.w / 2 - Math.min(16, p.w / 4)} y={p.y + Math.min(8, p.h / 3)} width={Math.min(32, p.w / 2)} height="2.5" rx="1.2" fill={line} />
              : <rect x={i % 2 ? p.x + 5 : p.x + p.w - 7.5} y={p.y + p.h / 2 - Math.min(14, p.h / 6)} width="2.5" height={Math.min(28, p.h / 3)} rx="1.2" fill={line} />}
          </g>
        ))}
        <text x={g.x0 + g.w / 2} y={g.y0 + g.h + 18} textAnchor="middle" fontSize="11" fill="#555" fontFamily="system-ui, sans-serif">{Math.round(width / 10)} × {Math.round(height / 10)} × {Math.round(depth / 10)} cm · {color}</text>
        <text x={g.vw / 2} y={g.vh - 8} textAnchor="middle" fontSize="9" fill="#999" fontFamily="system-ui, sans-serif">{business}</text>
      </svg>
      <div className="chips wrap" role="group" aria-label="Color">
        {Object.keys(COLORS).map((c) => <button key={c} type="button" className={`chip ${color === c ? 'on' : ''}`} onClick={() => setColor(c)}><span className="swatch" style={{ background: COLORS[c][0] }} />{c}</button>)}
      </div>
      <div className="quick">
        <button type="button" className="btn ghost" onClick={() => setFlip(!flip)}>Girar</button>
        <button type="button" className="btn primary" onClick={() => void save()}>Mandar imagen</button>
      </div>
      <small className="muted">Vista aproximada para que el cliente se imagine el mueble; las medidas y piezas exactas están en el despiece.</small>
      {msg && <p className="success" role="status">{msg}</p>}
    </section>
  )
}
