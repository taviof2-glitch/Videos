import { useState } from 'react'
import { niceScale } from './scale'

export type BarDatum = { key: string; label: string; value: number; /** Texto corto bajo la barra (si falta se usa `label`). */ short?: string }

const W = 340
const H = 190
const PAD = { top: 10, right: 6, bottom: 22, left: 44 }

/**
 * Columnas de una sola serie que crecen desde una base común. Tocar o pasar sobre una columna muestra su valor.
 * Columnas de 24 px como máximo, con la punta redondeada y la base recta; cuadrícula tenue.
 */
export default function BarChart(props: { data: BarDatum[]; format: (v: number) => string; formatTick: (v: number) => string; labelEvery?: number; title: string; tone?: 'sale' | 'expense' }) {
  const [active, setActive] = useState<number>()
  const { data } = props
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const { top, step } = niceScale(Math.max(...data.map((d) => d.value), 0))
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH
  const slot = plotW / data.length
  const barW = Math.min(24, slot * 0.7)
  const every = props.labelEvery ?? 1
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const shown = active !== undefined ? data[active] : undefined

  return (
    <figure className={`chart ${props.tone === 'expense' ? 'expense' : ''}`}>
      <figcaption className="chart-readout" aria-live="polite">
        {shown ? <><strong>{props.format(shown.value)}</strong> <span className="muted">· {shown.label}</span></> : <span className="muted">Toca una barra para ver su valor</span>}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title} onMouseLeave={() => setActive(undefined)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="chart-tick">{props.formatTick(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2
          const h = PAD.top + plotH - y(d.value)
          const r = Math.min(4, barW / 2, h)
          const base = PAD.top + plotH
          return (
            <g key={d.key}>
              {d.value > 0 && (
                <path
                  className={`chart-bar ${active === i ? 'on' : ''}`}
                  d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barW - r} Q${x + barW},${base - h} ${x + barW},${base - h + r} V${base} Z`}
                />
              )}
              {i % every === 0 && <text x={PAD.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" className="chart-tick">{d.short ?? d.label}</text>}
              {/* zona de toque más grande que la barra */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} onClick={() => setActive(i)}>
                <title>{`${d.label}: ${props.format(d.value)}`}</title>
              </rect>
            </g>
          )
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="chart-axis" />
      </svg>
      <details className="chart-table">
        <summary>Ver como tabla</summary>
        <table>
          <tbody>
            {data.filter((d) => d.value > 0).map((d) => (
              <tr key={d.key}><td>{d.label}</td><td>{props.format(d.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
