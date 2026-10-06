import { PEOPLE } from '../lib/people'
import { formatDue } from '../lib/time'
import type { Plan } from '../lib/types'
import { BigCountdown } from './Countdown'

const GRADIENT = {
  nita: 'from-rose-400 via-rose-500 to-pink-500',
  kitos: 'from-sky-400 via-sky-500 to-indigo-500',
  both: 'from-fuchsia-400 via-violet-500 to-indigo-500',
}

/** Tarjeta destacada con el próximo plan y su cuenta atrás gigante. */
export function NextUp({ plan, onOpen }: { plan: Plan; onOpen: (p: Plan) => void }) {
  const due = plan.dueAt!.toDate()
  return (
    <button
      onClick={() => onOpen(plan)}
      className={`relative w-full overflow-hidden rounded-[28px] bg-gradient-to-br ${GRADIENT[plan.assignee]} p-5 text-left text-white shadow-lg shadow-violet-500/20 active:scale-[0.99]`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-90">
        <span>Lo próximo</span>
        <span>{PEOPLE[plan.assignee].name}</span>
      </div>
      <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight">{plan.title}</h2>
      <p className="mb-4 mt-1 text-sm font-medium opacity-90">{formatDue(due, plan.allDay)}</p>
      <BigCountdown due={due} />
    </button>
  )
}
