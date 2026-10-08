import { useNow } from '../hooks/useNow'
import { eventEmoji } from '../lib/kinds'
import type { Plan, PersonId } from '../lib/types'
import { ChevronIcon } from './Icons'

const EMOJI = { plan: '💞', task: '🧹' }
const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

/** "Hoy para ti": lo de hoy de la persona (suyo o de los dos) y lo que arrastra atrasado. */
export function TodayStrip({ plans, me, onOpen, onGoTasks }: { plans: Plan[]; me: PersonId; onOpen: (p: Plan) => void; onGoTasks: () => void }) {
  const now = new Date(useNow(60_000))
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const mine = plans.filter((p) => !p.done && p.dueAt && (p.assignee === me || p.assignee === 'both'))
  const today = mine.filter((p) => p.dueAt!.toMillis() >= start && p.dueAt!.toMillis() < end).sort((a, b) => a.dueAt!.toMillis() - b.dueAt!.toMillis())
  const overdue = mine.filter((p) => p.kind !== 'event' && p.dueAt!.toMillis() < start).length
  const MAX = 4

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-700">☀️ Hoy para ti</h2>
      {today.length === 0 ? (
        <p className="text-sm text-muted">Nada apuntado para hoy 🌿</p>
      ) : (
        <ul className="space-y-1">
          {today.slice(0, MAX).map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpen(p)} className="flex w-full items-center gap-2.5 rounded-xl py-1 text-left active:bg-white/60">
                <span aria-hidden className="w-5 text-center">
                  {p.kind === 'event' ? eventEmoji(!!p.repeat?.yearly) : EMOJI[p.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span>
                <span className="tabular shrink-0 text-xs font-semibold text-muted">{p.allDay ? 'hoy' : timeFmt.format(p.dueAt!.toDate())}</span>
              </button>
            </li>
          ))}
          {today.length > MAX && <li className="pl-7 text-xs text-muted">y {today.length - MAX} más en el calendario</li>}
        </ul>
      )}
      {overdue > 0 && (
        <button onClick={onGoTasks} className="mt-2 flex w-full items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-left text-xs font-bold text-rose-700 active:scale-[0.99]">
          ⚠️ {overdue} {overdue === 1 ? 'pendiente atrasada' : 'pendientes atrasadas'}
          <ChevronIcon className="ml-auto size-3.5" />
        </button>
      )}
    </section>
  )
}
