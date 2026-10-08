import { PEOPLE } from '../lib/people'
import type { Plan, PersonId, PriorityConfig, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { DueChip } from './Countdown'
import { CheckIcon, CopyIcon, NavigateIcon, NoteIcon, PinIcon, RepeatIcon } from './Icons'
import { directionsUrl } from '../lib/maps'
import { describeRepeat } from '../lib/recurrence'
import { eventEmoji } from '../lib/kinds'
import { TagChip } from './TagChip'

interface Props {
  plan: Plan
  me: PersonId
  tagsById: Map<string, Tag>
  priorities: PriorityConfig
  siblings: Plan[]
  onOpen: (plan: Plan) => void
  onToggle: (plan: Plan) => void
}

export function PlanCard({ plan, me, tagsById, priorities, siblings, onOpen, onToggle }: Props) {
  const priority = priorities[plan.priority]
  const person = PEOPLE[plan.assignee]
  const tags = plan.tagIds.map((id) => tagsById.get(id)).filter((t): t is Tag => !!t)
  const partnerCopy = siblings[0]
  const isEvent = plan.kind === 'event'

  return (
    <article
      className={`group relative flex gap-3 overflow-hidden rounded-3xl bg-white p-3.5 pl-4 shadow-[0_1px_2px_rgba(42,34,51,0.04),0_4px_16px_-6px_rgba(42,34,51,0.08)] transition ${
        plan.done ? 'opacity-60' : ''
      }`}
    >
      {/* Barra de prioridad (las citas no tienen prioridad) */}
      {!isEvent && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: priority.color }} aria-hidden />}

      {isEvent ? (
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm ${person.soft}`} aria-hidden>
          {eventEmoji(!!plan.repeat?.yearly)}
        </span>
      ) : (
      <button
        onClick={() => onToggle(plan)}
        aria-label={plan.done ? 'Marcar como pendiente' : 'Marcar como hecho'}
        aria-pressed={plan.done}
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
          plan.done ? `${person.solid} border-transparent text-white` : 'border-stone-300 hover:border-stone-400'
        }`}
      >
        {plan.done && <CheckIcon className="size-3.5 animate-pop" />}
      </button>
      )}

      <button onClick={() => onOpen(plan)} className="min-w-0 flex-1 text-left">
        <div className="flex items-start gap-2">
          <h3 className={`flex-1 text-[15px] font-semibold leading-snug ${plan.done ? 'text-muted line-through' : ''}`}>{plan.title}</h3>
          <Avatar mode={plan.assignee} size="xs" className="mt-0.5" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {!isEvent && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: `${priority.color}1f`, color: priority.color }}
            >
              {priority.label}
            </span>
          )}
          {plan.dueAt && <DueChip due={plan.dueAt.toDate()} allDay={plan.allDay} done={plan.done} event={isEvent} />}
          {plan.repeat && !plan.done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              <RepeatIcon className="size-3" />
              {describeRepeat(plan.repeat)}
              {plan.repeat.rotate && ' · por turnos'}
            </span>
          )}
          {plan.groupId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <CopyIcon className="size-3" />
              {partnerCopy
                ? `${PEOPLE[partnerCopy.assignee].name}: ${partnerCopy.done ? 'hecho ✓' : 'pendiente'}`
                : 'Duplicada'}
            </span>
          )}
          {plan.notes && <NoteIcon className="size-3.5 text-muted" />}
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>

        {plan.place && (
          <span className="mt-2 flex items-center gap-1 text-xs font-medium text-muted">
            <PinIcon className="size-3.5 shrink-0 text-rose-400" />
            <span className="truncate">{plan.place.name}</span>
          </span>
        )}

        {plan.done && plan.doneBy && plan.assignee === 'both' && (
          <p className="mt-1.5 text-[11px] text-muted">Hecho por {plan.doneBy === me ? 'ti' : PEOPLE[plan.doneBy].name}</p>
        )}
      </button>

      {plan.place && !plan.done && (
        <a
          href={directionsUrl(plan.place)}
          target="_blank"
          rel="noopener"
          aria-label={`Cómo llegar a ${plan.place.name}`}
          className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-center rounded-2xl bg-sky-50 px-2.5 py-2 text-[10px] font-bold text-sky-700 active:scale-95"
        >
          <NavigateIcon className="size-5" />
          Ir
        </a>
      )}
    </article>
  )
}
