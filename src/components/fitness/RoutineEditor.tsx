import { useState } from 'react'
import { deleteRoutine, saveRoutine } from '../../hooks/useFitness'
import { DAY_SHORT, GROUPS, WEEK_ORDER, type Routine, type RoutineExercise } from '../../lib/fitness'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { ChevronIcon, PlusIcon, TrashIcon } from '../Icons'
import { ExercisePicker } from './ExercisePicker'

export type RoutineDraft = Omit<Routine, 'id'> & { id?: string }
export const emptyRoutine = (owner: PersonId): RoutineDraft => ({
  owner,
  name: '',
  days: [],
  exercises: [],
})

const small = 'h-9 w-12 rounded-lg border border-stone-200 bg-surface text-center font-bold outline-none focus:border-both'

/** Crear o cambiar una rutina: nombre, qué días y sus ejercicios con series × repeticiones. */
export function RoutineEditor({ draft, onClose, onError }: { draft: RoutineDraft; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const [picking, setPicking] = useState(draft.exercises.length === 0)
  const [confirm, setConfirm] = useState(false)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const setEx = (i: number, e: RoutineExercise) => setD({ ...d, exercises: d.exercises.map((x, j) => (j === i ? e : x)) })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= d.exercises.length) return
    const ex = [...d.exercises]
    ;[ex[i], ex[j]] = [ex[j], ex[i]]
    setD({ ...d, exercises: ex })
  }
  const save = () => {
    if (!d.name.trim()) return
    saveRoutine({ ...d, name: d.name.trim(), days: [...d.days].sort() }, onError)
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={draft.id ? 'Editar rutina' : 'Nueva rutina'}
      footer={
        !draft.id || dirty ? (
          <button onClick={save} disabled={!d.name.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {draft.id ? 'Guardar cambios' : 'Guardar rutina'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <input
          autoFocus={!draft.id}
          value={d.name}
          onChange={(e) => setD({ ...d, name: e.target.value })}
          placeholder="Pecho y tríceps, Pierna…"
          aria-label="Nombre de la rutina"
          maxLength={60}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Qué días (opcional: así te digo «hoy toca»)</span>
          <div className="flex gap-1.5">
            {WEEK_ORDER.map((day) => {
              const on = d.days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day]}
                  onClick={() =>
                    setD({
                      ...d,
                      days: on ? d.days.filter((x) => x !== day) : [...d.days, day],
                    })
                  }
                  className={`size-10 rounded-full text-sm font-bold ${on ? 'bg-ink text-cream' : 'bg-stone-100'}`}
                >
                  {DAY_SHORT[day]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-xs font-semibold text-muted">Ejercicios</span>
          {d.exercises.map((e, i) => (
            <div key={`${e.name}-${i}`} className="flex items-center gap-2 rounded-2xl bg-stone-50 p-2.5">
              <span className="text-lg" aria-hidden>
                {GROUPS[e.group].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{e.name}</span>
                <span className="block text-[11px] text-muted">{GROUPS[e.group].label}</span>
              </span>
              {e.group === 'cardio' ? null : (
                <span className="flex items-center gap-1 text-xs font-semibold text-muted">
                  <input
                    value={e.sets || ''}
                    onChange={(x) =>
                      setEx(i, {
                        ...e,
                        sets: Math.min(10, Number(x.target.value) || 0),
                      })
                    }
                    inputMode="numeric"
                    aria-label={`Series de ${e.name}`}
                    className={small}
                  />
                  ×
                  <input
                    value={e.reps || ''}
                    onChange={(x) =>
                      setEx(i, {
                        ...e,
                        reps: Math.min(100, Number(x.target.value) || 0),
                      })
                    }
                    inputMode="numeric"
                    aria-label={`Repeticiones de ${e.name}`}
                    className={small}
                  />
                </span>
              )}
              <span className="flex flex-col">
                {i > 0 && (
                  <button type="button" onClick={() => move(i, -1)} aria-label="Subir" className="grid size-6 place-items-center text-muted">
                    <ChevronIcon className="size-3.5 -rotate-90" />
                  </button>
                )}
                {i < d.exercises.length - 1 && (
                  <button type="button" onClick={() => move(i, 1)} aria-label="Bajar" className="grid size-6 place-items-center text-muted">
                    <ChevronIcon className="size-3.5 rotate-90" />
                  </button>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  setD({
                    ...d,
                    exercises: d.exercises.filter((_, j) => j !== i),
                  })
                }
                aria-label={`Quitar ${e.name}`}
                className="grid size-8 place-items-center text-rose-600"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          ))}
          {picking ? (
            <div className="rounded-2xl border-2 border-dashed border-stone-200 p-3">
              <ExercisePicker
                initialGroup={d.exercises[d.exercises.length - 1]?.group}
                exclude={d.exercises.map((e) => e.name)}
                onPick={(name, group) =>
                  setD((x) => ({
                    ...x,
                    exercises: [
                      ...x.exercises,
                      {
                        name,
                        group,
                        sets: group === 'cardio' ? 1 : 3,
                        reps: group === 'cardio' ? 1 : 10,
                      },
                    ],
                  }))
                }
              />
              <button type="button" onClick={() => setPicking(false)} className="mt-3 w-full text-sm font-bold text-muted">
                Listo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-200 py-2.5 text-sm font-bold text-muted"
            >
              <PlusIcon className="size-4" /> Añadir ejercicio
            </button>
          )}
        </div>

        {draft.id &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar la rutina? (los entrenos hechos se quedan)</p>
              <button
                onClick={() => {
                  deleteRoutine(draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar rutina
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
