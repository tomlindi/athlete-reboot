import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceTicks } from '../../core/progress'

// Liniendiagramm im Stil von Apple Health, als einfaches SVG.
// Eine Datenreihe in Akzentfarbe: 2px-Linie, Fläche mit 10 % Deckkraft, haarfeines Raster,
// hervorgehobener Endpunkt mit Wert. Fadenkreuz beim Antippen, Pfeiltasten für die Tastatur
// und alle Werte zusätzlich als Liste, damit nichts nur im Diagramm steht.

export interface ChartPoint {
  t: number
  v: number
}

const tipFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const defaultTipDate = (t: number) => tipFmt.format(t)

const HEIGHT = 180
const PAD = { top: 22, right: 44, bottom: 24, left: 4 }

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(200, el.clientWidth))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export function LineChart({
  points,
  from,
  to,
  formatValue,
  formatTick = formatValue,
  formatDate,
  formatTipDate = defaultTipDate,
  label,
  includeZero = false,
  listLabel = 'Alle Werte',
}: {
  points: ChartPoint[]
  /** Beginn und Ende der x-Achse (Zeitraum) */
  from: number
  to: number
  formatValue: (v: number) => string
  formatTick?: (v: number) => string
  /** Kurzes Datum für die Achse */
  formatDate: (t: number) => string
  /** Volles Datum für Tooltip, Liste und Screenreader */
  formatTipDate?: (t: number) => string
  label: string
  includeZero?: boolean
  listLabel?: string
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const gradientId = useId()

  // Auswahl zurücksetzen, wenn sich die Daten wirklich ändern (z. B. anderer Zeitraum),
  // nicht bei jedem Neuzeichnen, sonst verschwindet das Fadenkreuz sofort wieder
  const dataKey = `${points.length}:${points[0]?.t}:${points[points.length - 1]?.t}`
  useEffect(() => setActive(null), [dataKey])

  const values = points.map((p) => p.v)
  const ticks = niceTicks(Math.min(...values, ...(includeZero ? [0] : [])), Math.max(...values, ...(includeZero ? [0] : [])))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const span = Math.max(1, to - from)
  const x = (t: number) => PAD.left + ((t - from) / span) * plotW
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const baseY = y(Math.max(yMin, Math.min(yMax, includeZero ? 0 : yMin)))
  const area = points.length > 1 ? `${line} L${x(points[points.length - 1].t).toFixed(1)},${baseY} L${x(points[0].t).toFixed(1)},${baseY} Z` : ''
  const last = points[points.length - 1]
  const shown = active !== null ? points[active] : null

  // Drei Datumsbeschriftungen: Anfang, Mitte, Ende des Zeitraums
  const dateTicks = [from, from + span / 2, to]

  function nearest(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].t) - px) < Math.abs(x(points[best].t) - px)) best = i
    setActive(best)
  }

  function onPointer(e: PointerEvent<SVGRectElement>) {
    if (points.length === 0) return
    nearest(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())
  }

  function onKey(e: KeyboardEvent) {
    if (points.length === 0) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const cur = active ?? points.length - 1
      setActive(Math.max(0, Math.min(points.length - 1, cur + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setActive(null)
  }

  const tipLeft = shown ? Math.min(Math.max(x(shown.t), 60), width - 60) : 0

  return (
    <div className="chart" ref={wrapRef}>
      <div className="chart-plot">
        {shown && (
          <div className="chart-tooltip" style={{ left: tipLeft }} role="status">
            <strong>{formatValue(shown.v)}</strong>
            <span>{formatTipDate(shown.t)}</span>
          </div>
        )}
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${label}. ${points.length ? `Letzter Wert ${formatValue(last.v)} am ${formatTipDate(last.t)}.` : 'Keine Werte im Zeitraum.'} Pfeiltasten zeigen einzelne Werte.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.14" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Raster und y-Achse rechts */}
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(tv)} y2={y(tv)} className="chart-grid" />
              <text x={width - 4} y={y(tv)} dy="0.32em" textAnchor="end" className="chart-axis">
                {formatTick(tv)}
              </text>
            </g>
          ))}
          {dateTicks.map((t, i) => (
            <text
              key={i}
              x={i === 0 ? PAD.left : i === 2 ? PAD.left + plotW : x(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
              className="chart-axis"
            >
              {formatDate(t)}
            </text>
          ))}

          {area && <path d={area} fill={`url(#${gradientId})`} />}
          {points.length > 1 && <path d={line} className="chart-line" />}

          {/* Fadenkreuz */}
          {shown && (
            <>
              <line x1={x(shown.t)} x2={x(shown.t)} y1={PAD.top - 6} y2={PAD.top + plotH} className="chart-crosshair" />
              <circle cx={x(shown.t)} cy={y(shown.v)} r={5} className="chart-dot" />
            </>
          )}

          {/* Endpunkt mit Wert */}
          {last && !shown && (
            <>
              <circle cx={x(last.t)} cy={y(last.v)} r={5} className="chart-dot" />
              <text
                x={Math.min(x(last.t), PAD.left + plotW)}
                y={y(last.v) - 10}
                textAnchor={x(last.t) > PAD.left + plotW - 40 ? 'end' : 'middle'}
                className="chart-endlabel"
              >
                {formatValue(last.v)}
              </text>
            </>
          )}

          {/* Trefferfläche größer als die Linie: der ganze Plotbereich */}
          <rect
            x={PAD.left}
            y={0}
            width={plotW}
            height={HEIGHT}
            fill="transparent"
            onPointerDown={onPointer}
            onPointerMove={onPointer}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            style={{ touchAction: 'pan-y' }}
          />
        </svg>
      </div>

      {points.length > 0 && (
        <details className="chart-table">
          <summary>{listLabel}</summary>
          <ul>
            {[...points].reverse().map((p) => (
              <li key={p.t}>
                <span>{formatTipDate(p.t)}</span>
                <strong>{formatValue(p.v)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
