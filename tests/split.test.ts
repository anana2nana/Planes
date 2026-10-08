import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitMood, taskSplit } from '../src/lib/split.ts'

const at = (s: string) => ({ toDate: () => new Date(s) }) as never
const names = { nita: 'Nita', kitos: 'Kitos' }

test('reparto: cuenta tareas hechas por mes y por quién las marcó', () => {
  const plans = [
    { kind: 'task', done: true, doneBy: 'nita', doneAt: at('2026-10-02T10:00') },
    { kind: 'task', done: true, doneBy: 'nita', doneAt: at('2026-10-05T10:00') },
    { kind: 'task', done: true, doneBy: 'kitos', doneAt: at('2026-10-06T10:00') },
    { kind: 'task', done: true, doneBy: 'kitos', doneAt: at('2026-09-30T23:30') },
    { kind: 'plan', done: true, doneBy: 'kitos', doneAt: at('2026-10-06T10:00') },
    { kind: 'task', done: false, doneBy: null, doneAt: null },
    { kind: 'task', done: true, doneBy: 'nita', doneAt: at('2026-01-06T10:00') },
  ] as never[]
  const s = taskSplit(plans, new Date('2026-10-08T12:00'), 3)
  assert.deepEqual(s.map((m) => [m.key, m.label, m.nita, m.kitos]), [
    ['2026-10', 'octubre', 2, 1],
    ['2026-09', 'septiembre', 0, 1],
    ['2026-08', 'agosto', 0, 0],
  ])
})

test('reparto: frase del mes', () => {
  assert.equal(splitMood({ nita: 0, kitos: 0 }, names), 'Aún no hay tareas hechas este mes')
  assert.equal(splitMood({ nita: 10, kitos: 9 }, names), '¡Vais a la par! 🤝')
  assert.equal(splitMood({ nita: 3, kitos: 9 }, names), 'Kitos va por delante este mes 💪')
  assert.equal(splitMood({ nita: 1, kitos: 0 }, names), 'Nita va por delante este mes 💪')
  assert.equal(splitMood({ nita: 2, kitos: 2 }, names), '¡Vais a la par! 🤝')
})
