import { useMemo, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { PEOPLE } from '../lib/people'
import { dayKey, describeRepeat, upcomingOccurrences } from '../lib/recurrence'
import { dateToDraft } from '../lib/time'
import type { Plan, PersonId, PriorityConfig, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { ChevronIcon, PlusIcon, RepeatIcon } from './Icons'
import { PlanCard } from './PlanCard'

interface Props {
  plans: Plan[]
  me: PersonId
  tags: Tag[]
  priorities: PriorityConfig
  onOpen: (plan: Plan) => void
  onToggle: (plan: Plan) => void
  /** Crear un plan nuevo en esa fecha (yyyy-mm-dd). */
  onCreate: (date: string) => void
}

/** Una entrada del calendario: un plan real o una repetición futura (aún no creada). */
interface Entry {
  plan: Plan
  date: Date
  virtual: boolean
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b)

const DOT: Record<Plan['assignee'], string> = { nita: 'bg-nita', kitos: 'bg-kitos', both: 'bg-both' }

export function CalendarView({ plans, me, tags, priorities, onOpen, onToggle, onCreate }: Props) {
  const now = useNow(60_000)
  const today = new Date(now)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState(() => today)

  // Cuadrícula de semanas completas (lunes a domingo) que cubre el mes.
  const { cells, gridEnd } = useMemo(() => {
    const offset = (month.getDay() + 6) % 7
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    const total = Math.ceil((offset + daysInMonth) / 7) * 7
    const cells = Array.from({ length: total }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i - offset + 1))
    const last = cells[cells.length - 1]
    return { cells, gridEnd: new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59) }
  }, [month])

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    const add = (e: Entry) => {
      const k = dayKey(e.date)
      map.set(k, [...(map.get(k) ?? []), e])
    }
    for (const plan of plans) {
      if (!plan.dueAt) continue
      const due = plan.dueAt.toDate()
      add({ plan, date: due, virtual: false })
      // Repeticiones futuras del plan pendiente (las reales se crean al completarlo).
      if (plan.repeatDays && !plan.done) {
        upcomingOccurrences(due, plan.repeatDays, gridEnd).forEach((date) => add({ plan, date, virtual: true }))
      }
    }
    map.forEach((list) => list.sort((a, b) => a.date.getTime() - b.date.getTime()))
    return map
  }, [plans, gridEnd])

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])
  const siblingsOf = (p: Plan) => (p.groupId ? plans.filter((s) => s.groupId === p.groupId && s.id !== p.id) : [])

  const entries = byDay.get(dayKey(selected)) ?? []
  const undated = plans.filter((p) => !p.dueAt && !p.done).length

  const shiftMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelected(today)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-extrabold">{capitalize(monthFmt.format(month))}</h2>
          <button onClick={goToday} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold active:scale-95">
            Hoy
          </button>
          <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="grid size-9 place-items-center rounded-full bg-stone-100 active:scale-90">
            <ChevronIcon className="size-4 rotate-180" />
          </button>
          <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="grid size-9 place-items-center rounded-full bg-stone-100 active:scale-90">
            <ChevronIcon className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-1.5">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day) => {
            const list = byDay.get(dayKey(day)) ?? []
            const inMonth = day.getMonth() === month.getMonth()
            const isSel = sameDay(day, selected)
            const isToday = sameDay(day, today)
            const pending = list.filter((e) => !e.plan.done || e.virtual)
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setSelected(day)
                  if (!inMonth) setMonth(new Date(day.getFullYear(), day.getMonth(), 1))
                }}
                aria-label={`${dayFmt.format(day)}${list.length ? `, ${list.length} planes` : ''}`}
                aria-pressed={isSel}
                className="flex flex-col items-center gap-1 py-1"
              >
                <span
                  className={`tabular grid size-9 place-items-center rounded-full text-sm font-semibold transition ${
                    isSel ? 'bg-ink text-white' : isToday ? 'text-both ring-2 ring-both' : inMonth ? 'text-ink' : 'text-stone-300'
                  }`}
                >
                  {day.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {pending.slice(0, 3).map((e, i) => (
                    <span key={i} className={`size-1.5 rounded-full ${DOT[e.plan.assignee]} ${e.virtual ? 'opacity-40' : ''} ${inMonth ? '' : 'opacity-30'}`} />
                  ))}
                  {pending.length === 0 && list.length > 0 && <span className="size-1.5 rounded-full bg-stone-300" />}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-[11px] font-semibold text-muted">
          {(['nita', 'kitos', 'both'] as const).map((p) => (
            <span key={p} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${DOT[p]}`} /> {PEOPLE[p].name}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-both opacity-40" /> Se repite
          </span>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-sm font-extrabold">{capitalize(dayFmt.format(selected))}</h2>
          <span className="text-xs text-muted">{entries.length ? `${entries.length} ${entries.length === 1 ? 'plan' : 'planes'}` : ''}</span>
        </div>

        <div className="space-y-2.5">
          {entries.map((e) =>
            e.virtual ? (
              <button
                key={`${e.plan.id}-${e.date.getTime()}`}
                onClick={() => onOpen(e.plan)}
                className="flex w-full items-center gap-3 rounded-3xl border-2 border-dashed border-violet-200 bg-white/60 p-3.5 text-left"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-600">
                  <RepeatIcon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{e.plan.title}</span>
                  <span className="text-[11px] font-semibold text-violet-700">
                    {e.plan.allDay ? 'Todo el día' : timeFmt.format(e.date)} · {describeRepeat(e.plan.repeatDays ?? [])}
                  </span>
                </span>
                <Avatar mode={e.plan.assignee} size="xs" />
              </button>
            ) : (
              <PlanCard
                key={e.plan.id}
                plan={e.plan}
                me={me}
                tagsById={tagsById}
                priorities={priorities}
                siblings={siblingsOf(e.plan)}
                onOpen={onOpen}
                onToggle={onToggle}
              />
            ),
          )}

          {entries.length === 0 && <p className="px-1 py-2 text-sm text-muted">Nada este día.</p>}

          <button
            onClick={() => onCreate(dateToDraft(selected, true).dueDate)}
            className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted active:scale-[0.99]"
          >
            <PlusIcon className="size-4" /> Añadir plan este día
          </button>

          {undated > 0 && (
            <p className="px-1 pt-1 text-center text-xs text-muted">
              {undated} {undated === 1 ? 'plan sin fecha no aparece' : 'planes sin fecha no aparecen'} en el calendario.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
