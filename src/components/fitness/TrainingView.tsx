import { useMemo, useState } from 'react'
import { saveRoutine, useRoutines, useWorkouts } from '../../hooks/useFitness'
import { useSheetState } from '../../hooks/useSheetState'
import {
  DAY_SHORT,
  GROUPS,
  GROUP_ORDER,
  TEMPLATES,
  WEEK_ORDER,
  doneSets,
  groupsThisWeek,
  isRecord,
  routineForToday,
  routineGroups,
  startFromRoutine,
  streak,
  weekDates,
  ymd,
  type Routine,
  type Workout,
} from '../../lib/fitness'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon } from '../Icons'
import { LineChart } from '../home/Charts'
import { RoutineEditor, emptyRoutine, type RoutineDraft } from './RoutineEditor'
import { WorkoutLogger, readLive, type WorkoutDraft } from './WorkoutLogger'

const dayFmt = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const shortFmt = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
})
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const daysText = (days: number[]) =>
  days.length
    ? WEEK_ORDER.filter((d) => days.includes(d))
        .map((d) => DAY_SHORT[d])
        .join(' · ')
    : 'Sin día fijo'

/** Entrenos: la semana, lo que toca hoy, rutinas, progreso por ejercicio e historial. */
export function TrainingView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const [whose, setWhose] = useState<PersonId>(me)
  const { routines: allRoutines } = useRoutines()
  const { workouts: all, loading } = useWorkouts()
  const [logger, setLogger] = useState<{
    initial: WorkoutDraft
    startedAt: number | null
  } | null>(null)
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'start' } | { type: 'routine'; draft: RoutineDraft }>()
  const [live, setLive] = useState(() => readLive(me))
  const today = ymd(new Date())
  const isMe = whose === me
  const routines = allRoutines.filter((r) => r.owner === whose)
  const workouts = all.filter((w) => w.owner === whose)
  const todayRoutine = routineForToday(allRoutines, all, whose, today)
  const week = weekDates(today)
  const groups = groupsThisWeek(workouts, today)
  const st = streak(workouts, today)

  const start = (r: Routine | null) => {
    const open = () =>
      setLogger({
        initial: startFromRoutine(
          r,
          me,
          today,
          all.filter((w) => w.owner === me),
        ),
        startedAt: Date.now(),
      })
    // Desde la hoja: primero se cierra (vuelve atrás en el historial) y luego se abre el entreno encima.
    if (history.state?.sheet) {
      window.addEventListener('popstate', () => setTimeout(open, 0), {
        once: true,
      })
      closeSheet()
    } else open()
  }
  const resume = () => live && setLogger({ initial: live.workout, startedAt: live.startedAt })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="De quién">
        {[me, partner].map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={whose === p}
            onClick={() => setWhose(p)}
            className={`flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold ${whose === p ? 'bg-surface shadow-sm' : 'text-muted'}`}
          >
            <Avatar mode={p} size="xs" /> {p === me ? 'Los míos' : `Los de ${PEOPLE[p].name}`}
          </button>
        ))}
      </div>

      {isMe && live && !logger && (
        <button onClick={resume} className="flex w-full items-center gap-3 rounded-3xl bg-amber-50 p-4 text-left active:scale-[0.99]">
          <span className="text-3xl" aria-hidden>
            ⏸️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold text-amber-800">Tienes un entreno a medias</span>
            <span className="block truncate text-sm text-amber-800/80">{live.workout.name} · toca para seguir</span>
          </span>
        </button>
      )}

      {/* Esta semana */}
      <section className={card}>
        <div className="flex items-baseline justify-between">
          <h3 className="font-extrabold">Esta semana</h3>
          <span className="text-xs font-semibold text-muted">
            {st.thisWeek} {st.thisWeek === 1 ? 'entreno' : 'entrenos'}
            {st.weeks > 1 && ` · 🔥 ${st.weeks} semanas seguidas`}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {week.map((d) => {
            const ws = workouts.filter((w) => w.date === d)
            const gs = [...new Set(ws.flatMap((w) => w.entries.map((e) => e.group)))]
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] font-bold ${d === today ? 'text-ink' : 'text-muted'}`}>{DAY_SHORT[parse(d).getDay()]}</span>
                <span
                  className={`grid size-9 place-items-center rounded-full text-base ${ws.length ? `${PEOPLE[whose].solid} text-white` : d === today ? 'ring-2 ring-stone-300' : 'bg-stone-100'}`}
                  title={ws.map((w) => w.name).join(', ')}
                >
                  {ws.length ? (GROUPS[gs[0]]?.emoji ?? '✓') : ''}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {GROUP_ORDER.filter((g) => g !== 'otro').map((g) => {
            const n = groups.get(g) ?? 0
            return (
              <span key={g} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${n ? `${PEOPLE[whose].soft} text-ink` : 'bg-stone-100 text-muted opacity-60'}`}>
                {GROUPS[g].emoji} {GROUPS[g].label}
                {n > 1 && ` ×${n}`}
              </span>
            )
          })}
        </div>
      </section>

      {/* Hoy */}
      {isMe && !live && (
        <div className="space-y-2">
          {todayRoutine && (
            <button
              onClick={() => start(todayRoutine)}
              className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 p-4 text-left text-white shadow-lg active:scale-[0.99]"
            >
              <span className="text-3xl" aria-hidden>
                {GROUPS[routineGroups(todayRoutine)[0] ?? 'otro'].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider opacity-90">Hoy toca</span>
                <span className="block truncate text-lg font-extrabold">{todayRoutine.name}</span>
              </span>
              <span className="rounded-full bg-white/25 px-3.5 py-2 text-sm font-bold">Empezar</span>
            </button>
          )}
          <button
            onClick={() => openSheet({ type: 'start' })}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold active:scale-[0.99] ${todayRoutine ? 'bg-surface shadow-sm' : 'bg-ink text-cream'}`}
          >
            ▶ {todayRoutine ? 'Otro entreno' : 'Empezar entreno'}
          </button>
        </div>
      )}

      {/* Rutinas */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Rutinas</h2>
          {isMe && (
            <button onClick={() => openSheet({ type: 'routine', draft: emptyRoutine(me) })} className="flex items-center gap-1 text-xs font-bold text-both">
              <PlusIcon className="size-3.5" /> Nueva
            </button>
          )}
        </div>
        {routines.length === 0 ? (
          isMe ? (
            <Templates me={me} onError={onError} />
          ) : (
            <p className="px-1 text-sm text-muted">{PEOPLE[whose].name} aún no tiene rutinas.</p>
          )
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {routines.map((r) => (
              <button key={r.id} disabled={!isMe} onClick={() => openSheet({ type: 'routine', draft: r })} className={`${card} p-3.5 text-left active:scale-[0.98] disabled:active:scale-100`}>
                <span className="block text-lg" aria-hidden>
                  {routineGroups(r)
                    .slice(0, 3)
                    .map((g) => GROUPS[g].emoji)
                    .join('')}
                </span>
                <span className="mt-1 block truncate font-extrabold">{r.name}</span>
                <span className="block text-xs text-muted">
                  {daysText(r.days)} · {r.exercises.length} ej.
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <Progress workouts={workouts} color={whose === 'nita' ? 'var(--color-nita)' : 'var(--color-kitos)'} />

      {/* Historial */}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Historial</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-3xl bg-surface/70" />
        ) : workouts.length === 0 ? (
          <p className="px-1 text-sm text-muted">{isMe ? 'Aquí saldrán tus entrenos. ¡El primero cuenta doble! 💪' : `${PEOPLE[whose].name} aún no ha apuntado entrenos.`}</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {workouts.slice(0, 20).map((w) => (
              <li key={w.id}>
                <button disabled={!isMe} onClick={() => setLogger({ initial: w, startedAt: null })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
                  <span className="w-16 shrink-0 text-xs font-bold capitalize text-muted">{dayFmt.format(parse(w.date))}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">
                      {w.name}
                      {w.entries.some((e) => isRecord(workouts, w, e)) && ' 🏆'}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[...new Set(w.entries.map((e) => GROUPS[e.group].emoji))].join('')} {w.entries.length} {w.entries.length === 1 ? 'ejercicio' : 'ejercicios'}
                      {w.duration ? ` · ${w.duration} min` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheet?.type === 'start' && (
        <BottomSheet open onClose={closeSheet} title="¿Qué entrenas?">
          <div className="space-y-2">
            {routines.map((r) => (
              <button key={r.id} onClick={() => start(r)} className="flex w-full items-center gap-3 rounded-2xl bg-stone-50 p-3 text-left active:scale-[0.99]">
                <span className="text-xl" aria-hidden>
                  {routineGroups(r)
                    .slice(0, 2)
                    .map((g) => GROUPS[g].emoji)
                    .join('')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.name}</span>
                  <span className="block truncate text-xs text-muted">{r.exercises.map((e) => e.name).join(', ')}</span>
                </span>
              </button>
            ))}
            <button onClick={() => start(null)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-stone-200 p-3 text-left font-bold">
              <span className="text-xl" aria-hidden>
                ✨
              </span>
              Entreno libre (eliges sobre la marcha)
            </button>
          </div>
        </BottomSheet>
      )}
      {sheet?.type === 'routine' && <RoutineEditor draft={sheet.draft} onClose={closeSheet} onError={onError} />}
      {logger && (
        <WorkoutLogger
          initial={logger.initial}
          startedAt={logger.startedAt}
          history={all}
          me={me}
          onClose={() => {
            setLogger(null)
            setLive(readLive(me))
          }}
          onError={onError}
        />
      )}
    </div>
  )
}

/** Sin rutinas: plantillas para empezar con un toque. */
function Templates({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  return (
    <div className={`${card} space-y-2`}>
      <p className="text-sm text-muted">Empieza con una plantilla (luego cambias lo que quieras) o crea la tuya con «+ Nueva».</p>
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            for (const r of t.routines) saveRoutine({ ...r, owner: me }, onError)
            onError(`🏋️ ${t.routines.length} ${t.routines.length === 1 ? 'rutina creada' : 'rutinas creadas'}`)
          }}
          className="w-full rounded-2xl bg-stone-50 p-3 text-left active:scale-[0.99]"
        >
          <span className="block font-bold">{t.name}</span>
          <span className="block text-xs text-muted">
            {t.hint}: {t.routines.map((r) => r.name).join(' · ')}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Progreso de un ejercicio: el peso máximo de cada día. */
function Progress({ workouts, color }: { workouts: Workout[]; color: string }) {
  const exercises = useMemo(() => {
    const count = new Map<string, number>()
    for (const w of workouts) for (const e of w.entries) if (e.group !== 'cardio' && doneSets(e).some((s) => s.kg)) count.set(e.name, (count.get(e.name) ?? 0) + 1)
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [workouts])
  const [pick, setPick] = useState<string | null>(null)
  const name = pick && exercises.includes(pick) ? pick : exercises[0]
  if (!name) return null
  // El peso máximo de cada día (aunque ese día haya dos entrenos).
  const byDay = new Map<string, number>()
  for (const w of workouts) {
    const kg = Math.max(0, ...w.entries.filter((e) => e.name === name).flatMap((e) => doneSets(e).map((s) => s.kg ?? 0)))
    if (kg > 0) byDay.set(w.date, Math.max(kg, byDay.get(w.date) ?? 0))
  }
  const points = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([x, y]) => ({ x, y }))
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Progreso</h2>
      <div className={card}>
        <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
          {exercises.slice(0, 10).map((e) => (
            <button key={e} onClick={() => setPick(e)} aria-pressed={e === name} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${e === name ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {e}
            </button>
          ))}
        </div>
        {points.length >= 2 ? (
          <LineChart
            title={`${name}: kilos`}
            points={points}
            color={color}
            formatY={(v) => `${v.toLocaleString('es-ES')} kg`}
            formatX={(x) => shortFmt.format(parse(x))}
            zeroBased={false}
            height={130}
          />
        ) : (
          <p className="text-sm text-muted">
            {points[0]?.y.toLocaleString('es-ES')} kg el {shortFmt.format(parse(points[0].x))}. Con otro entreno verás la evolución.
          </p>
        )}
      </div>
    </section>
  )
}
