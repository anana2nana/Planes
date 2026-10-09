import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where, type Query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { GROUPS, type BodyLog, type Entry, type MuscleGroup, type Routine, type Workout } from '../lib/fitness'
import type { PersonId } from '../lib/types'

const routines = collection(db, 'routines')
const workouts = collection(db, 'workouts')
const bodyLogs = collection(db, 'bodyLogs')

const owner = (v: unknown): PersonId => (v === 'kitos' ? 'kitos' : 'nita')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const group = (v: unknown): MuscleGroup => (typeof v === 'string' && v in GROUPS ? (v as MuscleGroup) : 'otro')
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])

function useCollection<T>(ref: Query, parse: (id: string, x: Record<string, any>) => T, key?: string) {
  const [list, setList] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(ref, (snap) => {
        setList(snap.docs.map((d) => parse(d.id, d.data())))
        setLoading(false)
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key ?? ref],
  )
  return { list, loading }
}

const parseEntry = (e: any): Entry => ({
  name: typeof e?.name === 'string' ? e.name : '',
  group: group(e?.group),
  sets: arr(e?.sets).map((s) => ({
    kg: num(s?.kg),
    reps: num(s?.reps),
    done: s?.done === true,
  })),
  minutes: num(e?.minutes),
  km: num(e?.km),
})

export function useRoutines() {
  const { list, loading } = useCollection(
    routines,
    (id, x): Routine => ({
      id,
      owner: owner(x.owner),
      name: x.name ?? '',
      days: arr(x.days).filter((d) => typeof d === 'number'),
      exercises: arr(x.exercises).map((e) => ({
        name: e?.name ?? '',
        group: group(e?.group),
        sets: num(e?.sets) ?? 3,
        reps: num(e?.reps) ?? 10,
      })),
    }),
  )
  return {
    routines: list.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    loading,
  }
}

export function useWorkouts() {
  const { list, loading } = useCollection(
    workouts,
    (id, x): Workout => ({
      id,
      owner: owner(x.owner),
      date: typeof x.date === 'string' ? x.date : '1970-01-01',
      routineId: typeof x.routineId === 'string' ? x.routineId : null,
      name: x.name ?? '',
      entries: arr(x.entries).map(parseEntry),
      notes: x.notes ?? '',
      duration: num(x.duration),
    }),
  )
  return {
    workouts: list.sort((a, b) => b.date.localeCompare(a.date)),
    loading,
  }
}

/** Peso y medidas: cada uno solo ve los suyos (las reglas no dejan leer los de la pareja). */
export function useBodyLogs(me: PersonId) {
  const q = useMemo(() => query(bodyLogs, where('owner', '==', me)), [me])
  const { list, loading } = useCollection(
    q,
    (id, x): BodyLog => ({
      id,
      owner: owner(x.owner),
      date: typeof x.date === 'string' ? x.date : '1970-01-01',
      kg: num(x.kg),
      waist: num(x.waist),
      chest: num(x.chest),
      hip: num(x.hip),
      arm: num(x.arm),
      thigh: num(x.thigh),
    }),
    me,
  )
  return { logs: list.sort((a, b) => a.date.localeCompare(b.date)), loading }
}

/** Guarda (sin esperar: funciona sin conexión). Devuelve el id. */
function save<T extends { id?: string }>(ref: typeof routines, item: T, onError: (m: string) => void): string {
  const { id, ...data } = item
  const d = id ? doc(ref, id) : doc(ref)
  setDoc(d, { ...data, updatedAt: serverTimestamp() }).catch((e: Error) => onError(e.message))
  return d.id
}
export const saveRoutine = (r: Omit<Routine, 'id'> & { id?: string }, onError: (m: string) => void) => save(routines, r, onError)
export const saveWorkout = (w: Omit<Workout, 'id'> & { id?: string }, onError: (m: string) => void) => save(workouts, w, onError)
export const saveBodyLog = (l: Omit<BodyLog, 'id'> & { id?: string }, onError: (m: string) => void) => save(bodyLogs, l, onError)
export const deleteRoutine = (id: string) => deleteDoc(doc(routines, id))
export const deleteWorkout = (id: string) => deleteDoc(doc(workouts, id))
export const deleteBodyLog = (id: string) => deleteDoc(doc(bodyLogs, id))
