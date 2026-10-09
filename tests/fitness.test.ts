import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bestSet,
  groupOf,
  groupsThisWeek,
  isRecord,
  lastTime,
  newEntry,
  routineForToday,
  startFromRoutine,
  streak,
  summarize,
  weightTrend,
  type BodyLog,
  type Routine,
  type Workout,
} from '../src/lib/fitness.ts'

const set = (kg: number | null, reps: number, done = true) => ({
  kg,
  reps,
  done,
})
const w = (id: string, date: string, entries: Workout['entries'], owner: 'nita' | 'kitos' = 'kitos'): Workout => ({
  id,
  owner,
  date,
  routineId: null,
  name: 'x',
  entries,
  notes: '',
  duration: null,
})
const press = (sets: ReturnType<typeof set>[]) => ({
  name: 'Press banca',
  group: 'pecho' as const,
  sets,
  minutes: null,
  km: null,
})

const history = [
  w('a', '2026-09-28', [press([set(40, 10), set(40, 10), set(40, 8)])]),
  w('b', '2026-10-05', [press([set(42.5, 10), set(45, 8), set(45, 6, false)])]),
  w('c', '2026-10-07', [
    { name: 'Correr', group: 'cardio', sets: [], minutes: 30, km: 5 },
    {
      name: 'Sentadilla',
      group: 'pierna',
      sets: [set(60, 8)],
      minutes: null,
      km: null,
    },
  ]),
]

test('salud: grupo de un ejercicio del catálogo', () => {
  assert.equal(groupOf('press banca'), 'pecho')
  assert.equal(groupOf('Hip thrust'), 'gluteo')
  assert.equal(groupOf('Mi invento'), null)
})

test('salud: la última vez y su resumen', () => {
  const last = lastTime(history, 'press banca')
  assert.equal(last?.date, '2026-10-05')
  assert.equal(summarize(last!.entry), '10, 8 · 42,5–45 kg') // la serie sin marcar no cuenta
  assert.equal(summarize(history[0].entries[0]), '10, 10, 8 · 40 kg')
  assert.equal(summarize(press([set(40, 10), set(40, 10), set(40, 10)])), '3×10 · 40 kg')
  assert.equal(summarize(history[2].entries[0]), '30 min · 5 km')
  assert.equal(lastTime(history, 'press banca', '2026-10-05')?.date, '2026-09-28')
  assert.equal(lastTime(history, 'Remo'), null)
})

test('salud: mejor marca y récord', () => {
  assert.deepEqual(bestSet(history, 'Press banca'), {
    kg: 45,
    reps: 8,
    date: '2026-10-05',
  })
  const today = w('d', '2026-10-09', [press([set(47.5, 5)])])
  assert.ok(isRecord([...history, today], today, today.entries[0]))
  assert.ok(!isRecord(history, history[1], press([set(40, 10)])))
})

test('salud: empezar desde la rutina con los kilos de la última vez', () => {
  const r = {
    id: 'r1',
    name: 'Pecho y tríceps',
    exercises: [
      { name: 'Press banca', group: 'pecho' as const, sets: 3, reps: 10 },
      { name: 'Correr', group: 'cardio' as const, sets: 1, reps: 1 },
      { name: 'Fondos', group: 'triceps' as const, sets: 4, reps: 12 },
    ],
  }
  const s = startFromRoutine(r, 'kitos', '2026-10-09', history)
  assert.equal(s.name, 'Pecho y tríceps')
  assert.deepEqual(s.entries[0].sets, [set(42.5, 10, false), set(45, 8, false), set(45, 8, false)])
  assert.deepEqual([s.entries[1].minutes, s.entries[1].km], [30, 5])
  assert.deepEqual(s.entries[2].sets, Array(4).fill(set(null, 12, false)))
  assert.equal(newEntry('Remo', 'espalda', []).sets.length, 3)
  assert.equal(startFromRoutine(null, 'nita', '2026-10-09', []).name, 'Entreno libre')
})

test('salud: la semana, lo que toca hoy y la racha', () => {
  const g = groupsThisWeek(history, '2026-10-09')
  assert.deepEqual([...g.keys()].sort(), ['cardio', 'pecho', 'pierna'])
  const routines: Routine[] = [
    { id: '1', owner: 'kitos', name: 'Pierna', days: [5], exercises: [] },
    { id: '2', owner: 'nita', name: 'Full body', days: [1, 4], exercises: [] },
  ]
  assert.equal(routineForToday(routines, history, 'kitos', '2026-10-09')?.name, 'Pierna') // viernes
  assert.equal(routineForToday(routines, history, 'nita', '2026-10-09'), null)
  assert.equal(routineForToday(routines, [...history, w('z', '2026-10-09', [])], 'kitos', '2026-10-09'), null)
  assert.deepEqual(streak(history, '2026-10-09'), { thisWeek: 2, weeks: 2 })
  assert.deepEqual(streak(history, '2026-10-13'), { thisWeek: 0, weeks: 2 })
  assert.deepEqual(streak(history, '2026-10-20'), { thisWeek: 0, weeks: 0 })
})

test('salud: tendencia del peso', () => {
  const log = (date: string, kg: number | null): BodyLog => ({
    id: date,
    owner: 'nita',
    date,
    kg,
    waist: null,
    chest: null,
    hip: null,
    arm: null,
    thigh: null,
  })
  const logs = [log('2026-08-20', 62), log('2026-09-05', 61.4), log('2026-10-01', null), log('2026-10-08', 60.6)]
  assert.deepEqual(weightTrend(logs, '2026-10-09'), {
    last: { date: '2026-10-08', kg: 60.6 },
    change: -0.8,
    since: '2026-09-05',
  })
  assert.deepEqual(weightTrend([log('2026-10-08', 60)], '2026-10-09'), {
    last: { date: '2026-10-08', kg: 60 },
    change: null,
    since: null,
  })
  assert.equal(weightTrend([], '2026-10-09').last, null)
})
