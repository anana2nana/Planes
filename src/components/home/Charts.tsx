import { useId, useMemo, useState } from 'react'

/** Barra de progreso fina con extremo redondeado. */
export function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-stone-100"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export interface Point {
  x: string
  y: number
}

/**
 * Línea simple de una serie, con tooltip al tocar/pasar el dedo (crosshair).
 * Eje Y recesivo con 3 marcas; sin leyenda (el título dice qué es).
 */
export function LineChart({
  points,
  color,
  formatY,
  formatX = (x) => x,
  height = 140,
  title,
  zeroBased = true,
}: {
  points: Point[]
  color: string
  formatY: (v: number) => string
  formatX?: (x: string) => string
  height?: number
  title: string
  zeroBased?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const gradId = useId()
  const W = 320
  const H = height
  const pad = { l: 8, r: 8, t: 12, b: 20 }

  const { min, max, xs, ys } = useMemo(() => {
    const vals = points.map((p) => p.y)
    let lo = zeroBased ? Math.min(0, ...vals) : Math.min(...vals)
    let hi = Math.max(...vals)
    if (hi === lo) {
      hi += 1
      lo -= zeroBased ? 0 : 1
    }
    const span = hi - lo
    if (!zeroBased) {
      lo -= span * 0.1
      hi += span * 0.1
    }
    const xs = points.map((_, i) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, points.length - 1))
    const ys = points.map((p) => pad.t + (1 - (p.y - lo) / (hi - lo)) * (H - pad.t - pad.b))
    return { min: lo, max: hi, xs, ys }
  }, [points, zeroBased, H])

  if (points.length < 2) return null
  const path = xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const area = `${path} L${xs[xs.length - 1].toFixed(1)},${H - pad.b} L${xs[0].toFixed(1)},${H - pad.b} Z`
  const ticks = [min, (min + max) / 2, max]
  const yOf = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)

  const onMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    xs.forEach((px, i) => Math.abs(px - x) < Math.abs(xs[best] - x) && (best = i))
    setHover(best)
  }

  const h = hover ?? points.length - 1
  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`${title}: de ${formatY(points[0].y)} (${formatX(points[0].x)}) a ${formatY(points[points.length - 1].y)} (${formatX(points[points.length - 1].x)})`}
        onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <line key={i} x1={pad.l} x2={W - pad.r} y1={yOf(t)} y2={yOf(t)} stroke="var(--color-stone-200)" strokeWidth="1" strokeDasharray={i === 0 ? '' : '2 3'} />
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={xs[h]} x2={xs[h]} y1={pad.t} y2={H - pad.b} stroke="#a8a29e" strokeWidth="1" />}
        <circle cx={xs[h]} cy={ys[h]} r="4.5" fill={color} stroke="var(--color-surface)" strokeWidth="2" />
        <text x={pad.l} y={H - 5} fontSize="10" fill="#8a7f93">
          {formatX(points[0].x)}
        </text>
        <text x={W - pad.r} y={H - 5} fontSize="10" fill="#8a7f93" textAnchor="end">
          {formatX(points[points.length - 1].x)}
        </text>
      </svg>
      <div
        className="pointer-events-none absolute top-0 rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold text-cream shadow-lg"
        style={{ left: `clamp(0px, calc(${(xs[h] / W) * 100}% - 48px), calc(100% - 110px))` }}
      >
        <span className="opacity-70">{formatX(points[h].x)}</span> · {formatY(points[h].y)}
      </div>
    </figure>
  )
}
