import { useEffect, useRef, useState } from 'react'
import { deleteWorkout, saveWorkout } from '../../hooks/useFitness'
import { useLayer } from '../../hooks/useLayer'
import { beep, useWakeLock } from '../../hooks/useWakeLock'
import { GROUPS, bestSet, lastTime, newEntry, summarize, ymd, type Entry, type Workout } from '../../lib/fitness'
import { clock } from '../../lib/recipe'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { CloseIcon, PlusIcon, TrashIcon } from '../Icons'
import { ExercisePicker } from './ExercisePicker'

export type WorkoutDraft = Omit<Workout, 'id'> & { id?: string }

const dateFmt = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const shortFmt = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
})
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ─── Entreno a medias (en este móvil): si se cierra la app, se sigue donde estaba ───

const DRAFT_KEY = (me: PersonId) => `nitakitos.workout.${me}`
export interface LiveDraft {
  workout: WorkoutDraft
  startedAt: number
}
export function readLive(me: PersonId): LiveDraft | null {
  try {
    const x = JSON.parse(localStorage.getItem(DRAFT_KEY(me)) ?? 'null')
    return x?.workout ? x : null
  } catch {
    return null
  }
}
function writeLive(me: PersonId, d: LiveDraft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY(me), JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY(me))
  } catch {
    /* sin almacenamiento */
  }
}

const REST_KEY = 'nitakitos.rest'
const readRest = () => {
  try {
    return Number(localStorage.getItem(REST_KEY)) || 90
  } catch {
    return 90
  }
}

/**
 * El entreno a pantalla completa: cada ejercicio con lo de la última vez, series con kilos y
 * repeticiones (✓ al hacerlas), descanso con aviso y cronómetro. `live` = entreno en curso
 * (se guarda en el móvil mientras tanto); sin él, se edita uno ya hecho.
 */
export function WorkoutLogger({
  initial,
  startedAt,
  history,
  me,
  onClose,
  onError,
}: {
  initial: WorkoutDraft
  /** Solo en un entreno en curso. */
  startedAt: number | null
  history: Workout[]
  me: PersonId
  onClose: () => void
  onError: (m: string) => void
}) {
  const close = useLayer('workout', onClose)
  useWakeLock()
  const live = startedAt !== null
  const [w, setW] = useState(initial)
  const [picking, setPicking] = useState(false)
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null)
  const [restSecs, setRestSecs] = useState(readRest)
  const [now, setNow] = useState(Date.now())
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null)
  const beeped = useRef(false)
  const mine = history.filter((x) => x.owner === w.owner && x.id !== w.id)

  useEffect(() => {
    if (startedAt !== null) writeLive(me, { workout: w, startedAt })
  }, [live, me, w, startedAt])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const restLeft = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0
  useEffect(() => {
    if (!rest || restLeft > 0 || beeped.current) return
    beeped.current = true
    navigator.vibrate?.([300, 150, 300])
    beep()
    const t = setTimeout(() => setRest(null), 4000)
    return () => clearTimeout(t)
  }, [rest, restLeft])

  const setEntry = (i: number, e: Entry) =>
    setW((x) => ({
      ...x,
      entries: x.entries.map((y, j) => (j === i ? e : y)),
    }))
  const startRest = (secs = restSecs) => {
    beeped.current = false
    setRest({ end: Date.now() + secs * 1000, total: secs })
  }
  const toggleSet = (i: number, k: number) => {
    const e = w.entries[i]
    const done = !e.sets[k].done
    setEntry(i, {
      ...e,
      sets: e.sets.map((s, j) => (j === k ? { ...s, done } : s)),
    })
    if (done) startRest()
  }

  const hasData = w.entries.some((e) => e.sets.some((s) => s.done) || e.minutes)
  const finish = () => {
    const entries = w.entries
      // Cuentan las series marcadas con ✓ (los ejercicios de la rutina que no se hicieron no se guardan).
      .map((e) => (e.group === 'cardio' ? e : { ...e, sets: e.sets.filter((s) => s.done) }))
      .filter((e) => e.sets.length || e.minutes || e.km)
    const duration = startedAt !== null ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : w.duration
    saveWorkout({ ...w, entries, duration }, onError)
    if (live) writeLive(me, null)
    onError(live ? '💪 ¡Entreno guardado!' : 'Guardado')
    close()
  }
  const discard = () => {
    writeLive(me, null)
    close()
  }

  const elapsed = startedAt !== null ? Math.floor((now - startedAt) / 1000) : 0

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={w.name}>
      <div className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-cream/90 px-3 pb-2 backdrop-blur-xl">
        <button onClick={close} aria-label={live ? 'Salir (el entreno sigue guardado en el móvil)' : 'Cerrar'} className="grid size-10 place-items-center rounded-full bg-surface shadow-sm">
          <CloseIcon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <input
            value={w.name}
            onChange={(e) => setW({ ...w, name: e.target.value })}
            aria-label="Nombre del entreno"
            maxLength={60}
            className="w-full truncate bg-transparent font-extrabold outline-none"
          />
          <p className="text-xs text-muted first-letter:uppercase">{live ? <span className="tabular font-bold text-ink">⏱️ {clock(elapsed)}</span> : dateFmt.format(parse(w.date))}</p>
        </div>
        <button onClick={finish} disabled={!hasData} className="rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-cream disabled:opacity-30">
          {live ? 'Terminar' : 'Guardar'}
        </button>
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 pb-40 pt-1">
        {!live && (
          <input
            type="date"
            value={w.date}
            max={ymd(new Date())}
            onChange={(e) => e.target.value && setW({ ...w, date: e.target.value })}
            aria-label="Fecha"
            className="h-11 rounded-xl border border-stone-200 bg-surface px-3 font-semibold"
          />
        )}
        {w.entries.length === 0 && <p className="rounded-3xl bg-surface p-5 text-center text-sm text-muted">Añade el primer ejercicio 👇</p>}
        {w.entries.map((e, i) => (
          <EntryCard
            key={`${e.name}-${i}`}
            entry={e}
            last={lastTime(mine, e.name, live ? undefined : w.date)}
            best={e.group === 'cardio' ? null : bestSet(mine, e.name)}
            onChange={(x) => setEntry(i, x)}
            onToggle={(k) => toggleSet(i, k)}
            onRemove={() => setW({ ...w, entries: w.entries.filter((_, j) => j !== i) })}
          />
        ))}
        <button
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
        >
          <PlusIcon className="size-4" /> Añadir ejercicio
        </button>
        <textarea
          value={w.notes}
          onChange={(e) => setW({ ...w, notes: e.target.value })}
          rows={2}
          placeholder="Notas: cómo te has sentido, molestias…"
          aria-label="Notas del entreno"
          className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both"
        />

        <div className="flex items-center justify-between gap-2 pt-2 text-xs text-muted">
          <label className="flex items-center gap-2 font-semibold">
            Descanso
            <select
              value={restSecs}
              onChange={(e) => {
                const v = Number(e.target.value)
                setRestSecs(v)
                try {
                  localStorage.setItem(REST_KEY, String(v))
                } catch {
                  /* nada */
                }
              }}
              aria-label="Segundos de descanso"
              className="rounded-lg border border-stone-200 bg-surface px-2 py-1 font-bold text-ink"
            >
              {[45, 60, 90, 120, 150, 180].map((s) => (
                <option key={s} value={s}>
                  {clock(s)}
                </option>
              ))}
            </select>
          </label>
          {live ? (
            <button onClick={() => setConfirm('discard')} className="font-bold text-rose-600">
              Descartar entreno
            </button>
          ) : (
            w.id && (
              <button onClick={() => setConfirm('delete')} className="flex items-center gap-1 font-bold text-rose-600">
                <TrashIcon className="size-3.5" /> Borrar entreno
              </button>
            )
          )}
        </div>
        {confirm && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
            <p className="flex-1 text-sm font-semibold text-rose-700">{confirm === 'discard' ? '¿Descartar sin guardar?' : '¿Borrar este entreno?'}</p>
            <button onClick={() => setConfirm(null)} className="px-2 text-sm font-semibold text-muted">
              No
            </button>
            <button
              onClick={() => {
                if (confirm === 'delete' && w.id) deleteWorkout(w.id).catch((e: Error) => onError(e.message))
                if (confirm === 'discard') discard()
                else close()
              }}
              className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
            >
              Sí
            </button>
          </div>
        )}
      </main>

      {rest && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-20 px-4 pb-4">
          <div className={`mx-auto flex max-w-2xl items-center gap-3 rounded-3xl p-3 shadow-xl ${restLeft === 0 ? 'bg-emerald-600 text-white' : 'bg-ink text-cream'}`} role="timer" aria-live="polite">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold opacity-80">{restLeft === 0 ? '¡A por la siguiente serie!' : 'Descanso'}</p>
              <p className="tabular text-2xl font-extrabold">{clock(restLeft)}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-white/80 transition-[width] duration-1000" style={{ width: `${(restLeft / rest.total) * 100}%` }} />
              </div>
            </div>
            <button
              onClick={() =>
                setRest({
                  ...rest,
                  end: rest.end + 30_000,
                  total: rest.total + 30,
                })
              }
              className="rounded-full bg-white/15 px-3 py-2 text-sm font-bold"
            >
              +30 s
            </button>
            <button onClick={() => setRest(null)} aria-label="Quitar descanso" className="grid size-9 place-items-center rounded-full bg-white/15">
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>
      )}

      {picking && (
        <BottomSheet open onClose={() => setPicking(false)} title="Añadir ejercicio">
          <ExercisePicker
            initialGroup={w.entries[w.entries.length - 1]?.group}
            exclude={w.entries.map((e) => e.name)}
            onPick={(name, group) => {
              setW((x) => ({
                ...x,
                entries: [...x.entries, newEntry(name, group, mine)],
              }))
              setPicking(false)
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}

function Num({ value, onChange, label, step = 1, className = '' }: { value: number | null; onChange: (v: number | null) => void; label: string; step?: number; className?: string }) {
  const [text, setText] = useState(value === null ? '' : String(value).replace('.', ','))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value === null ? '' : String(value).replace('.', ','))
  }, [value, focused])
  return (
    <input
      value={text}
      inputMode={step < 1 ? 'decimal' : 'numeric'}
      aria-label={label}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '')
        setText(t)
        const n = Number(t.replace(',', '.'))
        onChange(t === '' || !Number.isFinite(n) ? null : n)
      }}
      className={`tabular h-11 w-full rounded-xl border border-stone-200 bg-surface text-center text-lg font-bold outline-none focus:border-both ${className}`}
    />
  )
}

function EntryCard({
  entry,
  last,
  best,
  onChange,
  onToggle,
  onRemove,
}: {
  entry: Entry
  last: { date: string; entry: Entry } | null
  best: { kg: number; reps: number } | null
  onChange: (e: Entry) => void
  onToggle: (k: number) => void
  onRemove: () => void
}) {
  const cardio = entry.group === 'cardio'
  const top = Math.max(0, ...entry.sets.filter((s) => s.done).map((s) => s.kg ?? 0))
  const record = best && top > best.kg
  return (
    <section className="rounded-3xl bg-surface p-3.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <div className="mb-2 flex items-start gap-2">
        <span className="text-xl" aria-hidden>
          {GROUPS[entry.group].emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold leading-tight">{entry.name}</h3>
          <p className="text-xs text-muted">
            {last ? (
              <>
                Última vez ({shortFmt.format(parse(last.date))}): <b className="text-ink">{summarize(last.entry)}</b>
              </>
            ) : (
              'Primera vez'
            )}
            {best && !record && ` · Mejor: ${best.kg.toLocaleString('es-ES')} kg × ${best.reps}`}
          </p>
          {record && <p className="mt-0.5 text-xs font-bold text-amber-700">🏆 ¡Nueva marca! (antes {best!.kg.toLocaleString('es-ES')} kg)</p>}
        </div>
        <button onClick={onRemove} aria-label={`Quitar ${entry.name}`} className="grid size-8 place-items-center text-muted">
          <TrashIcon className="size-4" />
        </button>
      </div>

      {cardio ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            Minutos
            <Num value={entry.minutes} onChange={(v) => onChange({ ...entry, minutes: v })} label={`Minutos de ${entry.name}`} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Km (opcional)
            <Num value={entry.km} onChange={(v) => onChange({ ...entry, km: v })} label={`Kilómetros de ${entry.name}`} step={0.1} />
          </label>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            <span>Serie</span>
            <span className="text-center">Kg</span>
            <span className="text-center">Reps</span>
            <span />
          </div>
          {entry.sets.map((s, k) => (
            <div key={k} className={`grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-xl ${s.done ? 'bg-emerald-50' : ''}`}>
              <span className="text-center text-sm font-bold text-muted">{k + 1}</span>
              <Num
                value={s.kg}
                onChange={(v) =>
                  onChange({
                    ...entry,
                    sets: entry.sets.map((x, j) => (j === k ? { ...x, kg: v } : x)),
                  })
                }
                label={`Kilos serie ${k + 1} de ${entry.name}`}
                step={0.5}
              />
              <Num
                value={s.reps}
                onChange={(v) =>
                  onChange({
                    ...entry,
                    sets: entry.sets.map((x, j) => (j === k ? { ...x, reps: v } : x)),
                  })
                }
                label={`Repeticiones serie ${k + 1} de ${entry.name}`}
              />
              <button
                onClick={() => onToggle(k)}
                aria-pressed={s.done}
                aria-label={`Serie ${k + 1} de ${entry.name} hecha`}
                className={`grid size-11 place-items-center rounded-xl text-lg font-bold ${s.done ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-muted'}`}
              >
                ✓
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                const prev = entry.sets[entry.sets.length - 1]
                onChange({
                  ...entry,
                  sets: [
                    ...entry.sets,
                    {
                      kg: prev?.kg ?? null,
                      reps: prev?.reps ?? 10,
                      done: false,
                    },
                  ],
                })
              }}
              className="flex-1 rounded-xl bg-stone-100 py-2 text-xs font-bold"
            >
              + Serie
            </button>
            {entry.sets.length > 1 && (
              <button onClick={() => onChange({ ...entry, sets: entry.sets.slice(0, -1) })} className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-muted">
                − Serie
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
