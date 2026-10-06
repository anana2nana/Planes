import { PEOPLE } from '../lib/people'
import type { Plan, PersonId, PriorityConfig, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { DueChip } from './Countdown'
import { CheckIcon, CopyIcon, NoteIcon, RepeatIcon } from './Icons'
import { describeRepeat } from '../lib/recurrence'
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

  return (
    <article
      className={`group relative flex gap-3 overflow-hidden rounded-3xl bg-white p-3.5 pl-4 shadow-[0_1px_2px_rgba(42,34,51,0.04),0_4px_16px_-6px_rgba(42,34,51,0.08)] transition ${
        plan.done ? 'opacity-60' : ''
      }`}
    >
      {/* Barra de prioridad */}
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ background: priority.color }} aria-hidden />

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

      <button onClick={() => onOpen(plan)} className="min-w-0 flex-1 text-left">
        <div className="flex items-start gap-2">
          <h3 className={`flex-1 text-[15px] font-semibold leading-snug ${plan.done ? 'text-muted line-through' : ''}`}>{plan.title}</h3>
          <Avatar mode={plan.assignee} size="xs" className="mt-0.5" />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ background: `${priority.color}1f`, color: priority.color }}
          >
            {priority.label}
          </span>
          {plan.dueAt && <DueChip due={plan.dueAt.toDate()} allDay={plan.allDay} done={plan.done} />}
          {plan.repeatDays && !plan.done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
              <RepeatIcon className="size-3" />
              {describeRepeat(plan.repeatDays)}
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

        {plan.done && plan.doneBy && plan.assignee === 'both' && (
          <p className="mt-1.5 text-[11px] text-muted">Hecho por {plan.doneBy === me ? 'ti' : PEOPLE[plan.doneBy].name}</p>
        )}
      </button>
    </article>
  )
}
