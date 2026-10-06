import { useMemo, useState } from 'react'
import { useNow } from '../hooks/useNow'
import { PRIORITY_WEIGHT } from '../lib/colors'
import { PEOPLE } from '../lib/people'
import { NEAR_WINDOW_MS, dueMillis } from '../lib/time'
import type { Assignee, Plan, PersonId, PriorityConfig, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { NextUp } from './NextUp'
import { PlanCard } from './PlanCard'

type Who = 'all' | Assignee
type Status = 'pending' | 'done'

interface Props {
  /** Qué lista es: planes (ocio) o tareas (casa, gata, gimnasio…). */
  kind: 'plan' | 'task'
  plans: Plan[]
  me: PersonId
  tags: Tag[]
  priorities: PriorityConfig
  loading: boolean
  onOpen: (plan: Plan) => void
  onToggle: (plan: Plan) => void
}

function byDueThenPriority(a: Plan, b: Plan) {
  const da = dueMillis(a) ?? Infinity
  const db = dueMillis(b) ?? Infinity
  if (da !== db) return da - db
  return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
}

const EMPTY = {
  plan: { emoji: '🌿', pending: 'Pulsa + para crear vuestro próximo plan.' },
  task: { emoji: '✨', pending: 'Pulsa + para añadir una tarea (limpiar, la gata, el gimnasio…).' },
}

export function PlansView({ kind, plans: allPlans, me, tags, priorities, loading, onOpen, onToggle }: Props) {
  const [who, setWho] = useState<Who>('all')
  const [status, setStatus] = useState<Status>('pending')
  const plans = useMemo(() => allPlans.filter((p) => p.kind === kind), [allPlans, kind])
  // Re-agrupa cada minuto (las cuentas atrás de cada tarjeta van al segundo por su cuenta).
  const now = useNow(60_000)

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const siblingsOf = useMemo(() => {
    const groups = new Map<string, Plan[]>()
    allPlans.forEach((p) => p.groupId && groups.set(p.groupId, [...(groups.get(p.groupId) ?? []), p]))
    return (p: Plan) => (p.groupId ? (groups.get(p.groupId) ?? []).filter((s) => s.id !== p.id) : [])
  }, [allPlans])

  const visible = plans.filter((p) => who === 'all' || p.assignee === who)
  const pending = visible.filter((p) => !p.done).sort(byDueThenPriority)
  const done = visible
    .filter((p) => p.done)
    .sort((a, b) => (b.doneAt?.toMillis() ?? 0) - (a.doneAt?.toMillis() ?? 0))

  const counts = {
    all: plans.filter((p) => !p.done).length,
    nita: plans.filter((p) => !p.done && p.assignee === 'nita').length,
    kitos: plans.filter((p) => !p.done && p.assignee === 'kitos').length,
    both: plans.filter((p) => !p.done && p.assignee === 'both').length,
  }

  // Tarjeta destacada con cuenta atrás grande: solo en Planes.
  const nextUp =
    kind === 'plan'
      ? pending.find((p) => {
          const d = dueMillis(p)
          return d !== null && d >= now
        })
      : undefined

  const today = new Date(now)
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime()

  // El plan destacado no se repite en la lista.
  const rest = pending.filter((p) => p !== nextUp)

  const groups: { title: string; items: Plan[]; tone?: string }[] =
    status === 'done'
      ? [{ title: 'Completados', items: done }]
      : [
          { title: 'Vencidos', tone: 'text-rose-600', items: rest.filter((p) => (dueMillis(p) ?? Infinity) < now) },
          {
            title: 'Hoy',
            tone: 'text-both',
            items: rest.filter((p) => {
              const d = dueMillis(p)
              return d !== null && d >= now && d < endOfToday
            }),
          },
          {
            title: 'Próximos 7 días',
            items: rest.filter((p) => {
              const d = dueMillis(p)
              return d !== null && d >= endOfToday && d - now < NEAR_WINDOW_MS
            }),
          },
          { title: 'Más adelante', items: rest.filter((p) => (dueMillis(p) ?? -1) - now >= NEAR_WINDOW_MS) },
          { title: 'Sin fecha', items: rest.filter((p) => !p.dueAt) },
        ]

  const card = (p: Plan) => (
    <PlanCard
      key={p.id}
      plan={p}
      me={me}
      tagsById={tagsById}
      priorities={priorities}
      siblings={siblingsOf(p)}
      onOpen={onOpen}
      onToggle={onToggle}
    />
  )

  const isEmpty = groups.every((g) => g.items.length === 0) && !(status === 'pending' && nextUp)

  return (
    <div className="space-y-5">
      {/* Filtro por persona */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(['all', 'nita', 'kitos', 'both'] as Who[]).map((w) => {
          const active = who === w
          return (
            <button
              key={w}
              onClick={() => setWho(w)}
              className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-bold transition active:scale-95 ${
                active ? 'bg-ink text-white shadow-md shadow-ink/20' : 'bg-white text-ink shadow-sm'
              }`}
            >
              {w === 'all' ? (
                <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-nita via-both to-kitos text-[11px] text-white">✦</span>
              ) : (
                <Avatar mode={w} size="sm" />
              )}
              {w === 'all' ? 'Todos' : PEOPLE[w].name}
              <span className={`tabular text-xs ${active ? 'text-white/60' : 'text-muted'}`}>{counts[w]}</span>
            </button>
          )
        })}
      </div>

      {/* Pendientes / Hechos */}
      <div className="grid grid-cols-2 rounded-2xl bg-stone-200/60 p-1 text-sm font-bold">
        {(['pending', 'done'] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-xl py-2 transition ${status === s ? 'bg-white shadow-sm' : 'text-muted'}`}
          >
            {s === 'pending' ? `Pendientes · ${pending.length}` : `Hechos · ${done.length}`}
          </button>
        ))}
      </div>

      {status === 'pending' && nextUp && <NextUp plan={nextUp} onOpen={onOpen} />}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-white/70" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="py-16 text-center">
          <div className="text-5xl">{status === 'pending' ? EMPTY[kind].emoji : '📭'}</div>
          <p className="mt-3 font-bold">{status === 'pending' ? 'Nada pendiente' : 'Todavía nada completado'}</p>
          <p className="mt-1 text-sm text-muted">{status === 'pending' ? EMPTY[kind].pending : 'Lo que completéis aparecerá aquí.'}</p>
        </div>
      ) : (
        groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.title}>
              <h2 className={`mb-2 px-1 text-xs font-bold uppercase tracking-wider ${g.tone ?? 'text-muted'}`}>
                {g.title} <span className="opacity-60">· {g.items.length}</span>
              </h2>
              <div className="space-y-2.5">{g.items.map(card)}</div>
            </section>
          ))
      )}
    </div>
  )
}
