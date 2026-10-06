import { useNow } from '../hooks/useNow'
import { formatCountdown, formatDue, splitDuration, urgencyOf, type Urgency } from '../lib/time'
import { ClockIcon } from './Icons'

export const URGENCY_STYLE: Record<Urgency, string> = {
  overdue: 'bg-rose-100 text-rose-700',
  critical: 'bg-red-100 text-red-700',
  soon: 'bg-orange-100 text-orange-700',
  near: 'bg-violet-100 text-violet-700',
  far: 'bg-stone-100 text-stone-600',
  none: 'bg-stone-100 text-stone-500',
}

/** Chip con la fecha tope. Si está cerca, muestra cuenta atrás en vivo (segundo a segundo). */
export function DueChip({ due, allDay, done }: { due: Date; allDay: boolean; done: boolean }) {
  const now = useNow(1000)
  const diff = due.getTime() - now
  const urgency = urgencyOf(diff)
  const live = !done && urgency !== 'far'

  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        done ? URGENCY_STYLE.none : URGENCY_STYLE[urgency]
      }`}
    >
      <ClockIcon className={`size-3 ${live && urgency === 'critical' ? 'animate-pulse' : ''}`} />
      {formatDue(due, allDay, now)}
      {live && (
        <>
          <span className="opacity-40">·</span>
          {urgency === 'overdue' ? `-${formatCountdown(diff)}` : formatCountdown(diff)}
        </>
      )}
    </span>
  )
}

/** Cuenta atrás grande, por bloques, para el plan más cercano. */
export function BigCountdown({ due }: { due: Date }) {
  const now = useNow(1000)
  const diff = Math.max(0, due.getTime() - now)
  const { d, h, m, s } = splitDuration(diff)
  const blocks = [
    { v: d, l: d === 1 ? 'día' : 'días' },
    { v: h, l: 'h' },
    { v: m, l: 'min' },
    { v: s, l: 's' },
  ]
  return (
    <div className="grid grid-cols-4 gap-2">
      {blocks.map((b) => (
        <div key={b.l} className="rounded-2xl bg-white/20 py-2 text-center backdrop-blur-sm">
          <div className="tabular text-2xl font-extrabold leading-none">{String(b.v).padStart(2, '0')}</div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider opacity-80">{b.l}</div>
        </div>
      ))}
    </div>
  )
}
