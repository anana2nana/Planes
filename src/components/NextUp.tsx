import { PEOPLE } from '../lib/people'
import { formatDue } from '../lib/time'
import type { Plan } from '../lib/types'
import { BigCountdown } from './Countdown'
import { DirectionsLink } from './DirectionsLink'
import { NavigateIcon, PinIcon } from './Icons'

const GRADIENT = {
  nita: 'from-rose-400 via-rose-500 to-pink-500',
  kitos: 'from-sky-400 via-sky-500 to-indigo-500',
  both: 'from-fuchsia-400 via-violet-500 to-indigo-500',
}

/** Tarjeta destacada con el próximo plan y su cuenta atrás gigante. */
export function NextUp({ plan, onOpen }: { plan: Plan; onOpen: (p: Plan) => void }) {
  const due = plan.dueAt!.toDate()
  return (
    <div className="relative">
    <button
      onClick={() => onOpen(plan)}
      className={`relative w-full overflow-hidden rounded-[28px] bg-gradient-to-br ${GRADIENT[plan.assignee]} p-5 text-left text-white shadow-lg shadow-violet-500/20 active:scale-[0.99]`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/15 blur-2xl" />
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-90">
        <span>Lo próximo</span>
        <span>{PEOPLE[plan.assignee].name}</span>
      </div>
      <h2 className={`mt-2 line-clamp-2 text-xl font-extrabold leading-tight ${plan.place ? "pr-20" : ""}`}>{plan.title}</h2>
      <p className="mb-4 mt-1 text-sm font-medium opacity-90">
        {formatDue(due, plan.allDay)}
        {plan.place && (
          <span className="mt-0.5 flex items-center gap-1 truncate pr-20">
            <PinIcon className="size-3.5 shrink-0" /> {plan.place.name}
          </span>
        )}
      </p>
      <BigCountdown due={due} />
    </button>
    {plan.place && (
      <DirectionsLink
        place={plan.place}
        className="absolute right-4 top-12 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-violet-700 shadow-lg active:scale-95"
      >
        <NavigateIcon className="size-4" /> Ir
      </DirectionsLink>
    )}
    </div>
  )
}
