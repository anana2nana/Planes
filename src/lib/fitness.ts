// Salud: entrenos por grupos musculares y peso corporal. Puro y testeado (tests/fitness.test.ts).

import type { PersonId } from './types'

export type MuscleGroup = 'pecho' | 'espalda' | 'pierna' | 'gluteo' | 'hombro' | 'biceps' | 'triceps' | 'core' | 'cardio' | 'otro'

export const GROUPS: Record<MuscleGroup, { label: string; emoji: string }> = {
  pecho: { label: 'Pecho', emoji: '🏋️' },
  espalda: { label: 'Espalda', emoji: '🦅' },
  pierna: { label: 'Pierna', emoji: '🦵' },
  gluteo: { label: 'Glúteo', emoji: '🍑' },
  hombro: { label: 'Hombro', emoji: '🤷' },
  biceps: { label: 'Bíceps', emoji: '💪' },
  triceps: { label: 'Tríceps', emoji: '🦾' },
  core: { label: 'Core', emoji: '🧱' },
  cardio: { label: 'Cardio', emoji: '🏃' },
  otro: { label: 'Otro', emoji: '✨' },
}
export const GROUP_ORDER = Object.keys(GROUPS) as MuscleGroup[]

/** Ejercicios habituales por grupo (se pueden escribir otros). */
export const CATALOG: Record<MuscleGroup, string[]> = {
  pecho: ['Press banca', 'Press inclinado con mancuernas', 'Aperturas', 'Cruce de poleas', 'Fondos', 'Flexiones', 'Press en máquina'],
  espalda: ['Dominadas', 'Jalón al pecho', 'Remo con barra', 'Remo con mancuerna', 'Remo en polea baja', 'Peso muerto', 'Pullover'],
  pierna: ['Sentadilla', 'Prensa', 'Zancadas', 'Extensión de cuádriceps', 'Curl femoral', 'Peso muerto rumano', 'Gemelos', 'Sentadilla búlgara'],
  gluteo: ['Hip thrust', 'Puente de glúteo', 'Patada de glúteo', 'Abducción en máquina', 'Peso muerto sumo'],
  hombro: ['Press militar', 'Elevaciones laterales', 'Elevaciones frontales', 'Pájaros', 'Face pull'],
  biceps: ['Curl con barra', 'Curl con mancuernas', 'Curl martillo', 'Curl en polea'],
  triceps: ['Press francés', 'Extensión en polea', 'Fondos en banco', 'Patada de tríceps'],
  core: ['Plancha', 'Crunch', 'Elevación de piernas', 'Rueda abdominal', 'Russian twist'],
  cardio: ['Correr', 'Cinta', 'Bici', 'Elíptica', 'Remo (máquina)', 'Comba', 'Caminar', 'Nadar', 'Clase'],
  otro: ['Estiramientos', 'Yoga', 'Pilates', 'Movilidad'],
}

/** El grupo de un ejercicio del catálogo (o null si es uno propio). */
export function groupOf(exercise: string): MuscleGroup | null {
  const n = exercise.trim().toLowerCase()
  for (const g of GROUP_ORDER) if (CATALOG[g].some((e) => e.toLowerCase() === n)) return g
  return null
}

export interface SetLog {
  kg: number | null
  reps: number | null
  done: boolean
}
export interface Entry {
  name: string
  group: MuscleGroup
  sets: SetLog[]
  /** Solo en cardio (o lo que se mida por tiempo). */
  minutes: number | null
  km: number | null
}
export interface Workout {
  id: string
  owner: PersonId
  date: string
  routineId: string | null
  name: string
  entries: Entry[]
  notes: string
  /** Minutos que duró (del cronómetro). */
  duration: number | null
}
export interface RoutineExercise {
  name: string
  group: MuscleGroup
  sets: number
  reps: number
}
export interface Routine {
  id: string
  owner: PersonId
  name: string
  /** Días de la semana (0 = domingo). */
  days: number[]
  exercises: RoutineExercise[]
}
export interface BodyLog {
  id: string
  owner: PersonId
  date: string
  kg: number | null
  waist: number | null
  chest: number | null
  hip: number | null
  arm: number | null
  thigh: number | null
}
export const MEASURES: {
  key: 'waist' | 'chest' | 'hip' | 'arm' | 'thigh'
  label: string
}[] = [
  { key: 'waist', label: 'Cintura' },
  { key: 'chest', label: 'Pecho' },
  { key: 'hip', label: 'Cadera' },
  { key: 'arm', label: 'Brazo' },
  { key: 'thigh', label: 'Muslo' },
]

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
/** Lunes a domingo, para elegir días. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const norm = (s: string) => s.trim().toLowerCase()
const isCardio = (e: Pick<Entry, 'group'>) => e.group === 'cardio'
/** Series que cuentan: las marcadas como hechas (o, si no se marcó ninguna, las que tienen datos). */
export function doneSets(e: Entry): SetLog[] {
  const marked = e.sets.filter((s) => s.done)
  return marked.length ? marked : e.sets.filter((s) => s.reps)
}

/** Lo último que hizo esa persona en un ejercicio (antes de `before`, si se da). */
export function lastTime(workouts: Workout[], exercise: string, before?: string): { date: string; entry: Entry } | null {
  const n = norm(exercise)
  const sorted = [...workouts].filter((w) => !before || w.date < before).sort((a, b) => b.date.localeCompare(a.date))
  for (const w of sorted) {
    const e = w.entries.find((x) => norm(x.name) === n && (doneSets(x).length || x.minutes))
    if (e) return { date: w.date, entry: e }
  }
  return null
}

/** "3×10 · 40 kg", "10, 8, 6 · 40–50 kg", "30 min · 5 km". */
export function summarize(e: Entry): string {
  if (isCardio(e) || (!e.sets.length && e.minutes)) {
    return [e.minutes ? `${fmt(e.minutes)} min` : '', e.km ? `${fmt(e.km)} km` : ''].filter(Boolean).join(' · ')
  }
  const sets = doneSets(e)
  if (!sets.length) return ''
  const reps = sets.map((s) => s.reps ?? 0)
  const kgs = sets.map((s) => s.kg).filter((k): k is number => k !== null && k > 0)
  const repsText = reps.every((r) => r === reps[0]) ? `${sets.length}×${reps[0]}` : reps.join(', ')
  const lo = Math.min(...kgs)
  const hi = Math.max(...kgs)
  const kgText = kgs.length ? (lo === hi ? `${fmt(hi)} kg` : `${fmt(lo)}–${fmt(hi)} kg`) : ''
  return [repsText, kgText].filter(Boolean).join(' · ')
}

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 })

/** Mejor marca de un ejercicio: el mayor peso movido (con sus repeticiones). */
export function bestSet(workouts: Workout[], exercise: string): { kg: number; reps: number; date: string } | null {
  const n = norm(exercise)
  let best: { kg: number; reps: number; date: string } | null = null
  for (const w of workouts)
    for (const e of w.entries)
      if (norm(e.name) === n)
        for (const s of doneSets(e)) if (s.kg && (!best || s.kg > best.kg || (s.kg === best.kg && (s.reps ?? 0) > best.reps))) best = { kg: s.kg, reps: s.reps ?? 0, date: w.date }
  return best
}

/** Si en este entreno se ha superado la mejor marca anterior. */
export function isRecord(workouts: Workout[], w: Workout, e: Entry): boolean {
  const before = bestSet(
    workouts.filter((x) => x.id !== w.id && x.date <= w.date),
    e.name,
  )
  const top = Math.max(0, ...doneSets(e).map((s) => s.kg ?? 0))
  return before !== null && top > before.kg
}

/** Un entreno nuevo a partir de una rutina, con los kilos y repeticiones de la última vez. */
export function startFromRoutine(routine: Pick<Routine, 'id' | 'name' | 'exercises'> | null, owner: PersonId, date: string, history: Workout[]): Omit<Workout, 'id'> {
  return {
    owner,
    date,
    routineId: routine?.id ?? null,
    name: routine?.name ?? 'Entreno libre',
    entries: (routine?.exercises ?? []).map((x) => newEntry(x.name, x.group, history, x.sets, x.reps)),
    notes: '',
    duration: null,
  }
}

/** Un ejercicio para el entreno: series prellenadas con lo de la última vez. */
export function newEntry(name: string, group: MuscleGroup, history: Workout[], sets = 3, reps = 10): Entry {
  if (group === 'cardio') {
    const last = lastTime(history, name)?.entry
    return {
      name,
      group,
      sets: [],
      minutes: last?.minutes ?? null,
      km: last?.km ?? null,
    }
  }
  const last = lastTime(history, name)?.entry
  const prev = last ? doneSets(last) : []
  const n = Math.max(sets, prev.length || 0) || 3
  return {
    name,
    group,
    sets: Array.from({ length: n }, (_, i) => {
      const p = prev[i] ?? prev[prev.length - 1]
      return { kg: p?.kg ?? null, reps: p?.reps ?? reps, done: false }
    }),
    minutes: null,
    km: null,
  }
}

/** Lunes de la semana de una fecha. */
export function mondayOf(date: string): string {
  const d = parse(date)
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)))
}
export function weekDates(date: string): string[] {
  const m = parse(mondayOf(date))
  return Array.from({ length: 7 }, (_, i) => ymd(new Date(m.getFullYear(), m.getMonth(), m.getDate() + i)))
}

/** Grupos trabajados en la semana de `date`, con cuántas veces. */
export function groupsThisWeek(workouts: Workout[], date: string): Map<MuscleGroup, number> {
  const days = weekDates(date)
  const out = new Map<MuscleGroup, number>()
  for (const w of workouts) {
    if (w.date < days[0] || w.date > days[6]) continue
    for (const g of new Set(w.entries.filter((e) => doneSets(e).length || e.minutes).map((e) => e.group))) out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

/** La rutina que toca hoy (si hay y aún no se ha entrenado hoy). */
export function routineForToday(routines: Routine[], workouts: Workout[], owner: PersonId, date: string): Routine | null {
  if (workouts.some((w) => w.owner === owner && w.date === date)) return null
  const dow = parse(date).getDay()
  return routines.find((r) => r.owner === owner && r.days.includes(dow)) ?? null
}

/** Grupos que trabaja una rutina, en orden. */
export const routineGroups = (r: Pick<Routine, 'exercises'>) => [...new Set(r.exercises.map((e) => e.group))]

/** Peso: el último, y cuánto ha cambiado desde hace ~30 días. */
export function weightTrend(
  logs: BodyLog[],
  today: string,
): {
  last: { date: string; kg: number } | null
  change: number | null
  since: string | null
} {
  const ws = logs.filter((l) => l.kg !== null).sort((a, b) => a.date.localeCompare(b.date)) as (BodyLog & {
    kg: number
  })[]
  if (!ws.length) return { last: null, change: null, since: null }
  const last = ws[ws.length - 1]
  const t = parse(today)
  const limit = ymd(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 30))
  const ref = [...ws].reverse().find((w) => w.date <= limit) ?? (ws[0] !== last ? ws[0] : null)
  return {
    last: { date: last.date, kg: last.kg },
    change: ref ? Math.round((last.kg - ref.kg) * 10) / 10 : null,
    since: ref?.date ?? null,
  }
}

/** Entrenos de la semana y racha de semanas seguidas con al menos uno. */
export function streak(workouts: Workout[], today: string): { thisWeek: number; weeks: number } {
  const weeks = new Set(workouts.map((w) => mondayOf(w.date)))
  const thisMonday = mondayOf(today)
  const thisWeek = workouts.filter((w) => mondayOf(w.date) === thisMonday).length
  let n = 0
  let m = parse(thisMonday)
  // La semana en curso cuenta si ya hay entreno; si no, empieza a contar desde la anterior.
  if (!weeks.has(thisMonday)) m = new Date(m.getFullYear(), m.getMonth(), m.getDate() - 7)
  while (weeks.has(ymd(m))) {
    n++
    m = new Date(m.getFullYear(), m.getMonth(), m.getDate() - 7)
  }
  return { thisWeek, weeks: n }
}

/** Plantillas para empezar rápido (luego se cambia todo). */
export const TEMPLATES: {
  id: string
  name: string
  hint: string
  routines: Omit<Routine, 'id' | 'owner'>[]
}[] = [
  {
    id: 'grupos5',
    name: 'Por grupos, 5 días',
    hint: 'Un grupo muscular cada día y cardio libre',
    routines: [
      {
        name: 'Pecho y tríceps',
        days: [1],
        exercises: [ex('Press banca', 'pecho', 4, 8), ex('Press inclinado con mancuernas', 'pecho'), ex('Aperturas', 'pecho'), ex('Press francés', 'triceps'), ex('Extensión en polea', 'triceps')],
      },
      {
        name: 'Espalda y bíceps',
        days: [2],
        exercises: [ex('Dominadas', 'espalda', 4, 8), ex('Remo con barra', 'espalda'), ex('Jalón al pecho', 'espalda'), ex('Curl con barra', 'biceps'), ex('Curl martillo', 'biceps')],
      },
      {
        name: 'Pierna',
        days: [3],
        exercises: [ex('Sentadilla', 'pierna', 4, 8), ex('Prensa', 'pierna'), ex('Curl femoral', 'pierna'), ex('Extensión de cuádriceps', 'pierna'), ex('Gemelos', 'pierna', 4, 15)],
      },
      {
        name: 'Hombro y core',
        days: [4],
        exercises: [
          ex('Press militar', 'hombro', 4, 8),
          ex('Elevaciones laterales', 'hombro', 3, 12),
          ex('Pájaros', 'hombro', 3, 12),
          ex('Plancha', 'core', 3, 1),
          ex('Elevación de piernas', 'core', 3, 12),
        ],
      },
      { name: 'Cardio', days: [5], exercises: [ex('Cinta', 'cardio', 1, 1)] },
    ],
  },
  {
    id: 'grupos3',
    name: 'Por grupos, 3 días',
    hint: 'Torso, pierna y brazos: lo mismo con menos días',
    routines: [
      {
        name: 'Torso',
        days: [1],
        exercises: [ex('Press banca', 'pecho'), ex('Remo con mancuerna', 'espalda'), ex('Jalón al pecho', 'espalda'), ex('Press militar', 'hombro'), ex('Elevaciones laterales', 'hombro', 3, 12)],
      },
      {
        name: 'Pierna y glúteo',
        days: [3],
        exercises: [ex('Sentadilla', 'pierna'), ex('Hip thrust', 'gluteo'), ex('Peso muerto rumano', 'pierna'), ex('Abducción en máquina', 'gluteo', 3, 15), ex('Zancadas', 'pierna')],
      },
      {
        name: 'Brazos, core y cardio',
        days: [5],
        exercises: [ex('Curl con mancuernas', 'biceps'), ex('Extensión en polea', 'triceps'), ex('Plancha', 'core', 3, 1), ex('Crunch', 'core', 3, 15), ex('Elíptica', 'cardio', 1, 1)],
      },
    ],
  },
  {
    id: 'full2',
    name: 'Cuerpo completo, 2 días',
    hint: 'Todo el cuerpo cada día: ideal para empezar',
    routines: [
      {
        name: 'Cuerpo completo',
        days: [2, 4],
        exercises: [
          ex('Sentadilla', 'pierna'),
          ex('Press banca', 'pecho'),
          ex('Remo en polea baja', 'espalda'),
          ex('Hip thrust', 'gluteo'),
          ex('Press militar', 'hombro'),
          ex('Plancha', 'core', 3, 1),
        ],
      },
    ],
  },
]
function ex(name: string, group: MuscleGroup, sets = 3, reps = 10): RoutineExercise {
  return { name, group, sets, reps }
}
