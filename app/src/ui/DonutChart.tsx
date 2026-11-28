import { useState } from 'react'
import { DONUT_COLORS, donutOffsets, donutSlices, type DonutSlice } from './donut'

/**
 * Dona sencilla: una vuelta dividida por categoría. Al tocar una porción (o su renglón) muestra su valor al centro.
 * La leyenda lleva el color, el nombre, el porcentaje y el importe, así que no depende solo del color.
 */
export default function DonutChart(props: { data: DonutSlice[]; format: (v: number) => string; title: string; totalLabel: string }) {
  const [active, setActive] = useState<number>()
  const slices = donutSlices(props.data)
  const total = slices.reduce((s, i) => s + i.value, 0)
  const R = 15.9155 // circunferencia = 100
  const offsets = donutOffsets(slices)
  const shown = active !== undefined ? slices[active] : undefined
  return (
    <figure className="donut">
      <svg viewBox="0 0 42 42" role="img" aria-label={props.title} onMouseLeave={() => setActive(undefined)}>
        <circle cx="21" cy="21" r={R} fill="none" className="donut-track" strokeWidth="6" />
        {slices.map((s, i) => {
          const pct = (s.value / total) * 100
          return (
            <circle
              key={s.key}
              cx="21" cy="21" r={R} fill="none" stroke={DONUT_COLORS[i]} strokeWidth={active === i ? 7 : 6}
              strokeDasharray={`${Math.max(pct - (slices.length > 1 ? 0.6 : 0), 0.1)} ${100 - Math.max(pct - (slices.length > 1 ? 0.6 : 0), 0.1)}`}
              strokeDashoffset={25 - offsets[i]}
              onMouseEnter={() => setActive(i)} onClick={() => setActive(i)}
            >
              <title>{`${s.label}: ${props.format(s.value)}`}</title>
            </circle>
          )
        })}
        <text x="21" y="20" textAnchor="middle" className="donut-value">{props.format(shown?.value ?? total)}</text>
        <text x="21" y="25.5" textAnchor="middle" className="donut-label">{shown ? shown.label.slice(0, 18) : props.totalLabel}</text>
      </svg>
      <ul className="donut-legend">
        {slices.map((s, i) => (
          <li key={s.key} className={active === i ? 'on' : ''} onClick={() => setActive(i)}>
            <span className="dot" style={{ background: DONUT_COLORS[i] }} aria-hidden />
            <span className="grow">{s.label}</span>
            <small className="muted">{Math.round((s.value / total) * 100)} %</small>
            <strong>{props.format(s.value)}</strong>
          </li>
        ))}
      </ul>
    </figure>
  )
}
