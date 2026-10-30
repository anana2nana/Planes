import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leaderText, monthRange, pastMonths, score, weekRange } from '../src/lib/chores.ts'

const names = { nita: 'Nita', kitos: 'Kitos' }
const chores = [
  { id: 'fregar', points: 1 },
  { id: 'bano', points: 3 },
]
const log = (choreId: string, by: 'nita' | 'kitos', date: string, points = 1) => ({ choreId, by, date, points })

test('reto: semanas y meses', () => {
  assert.deepEqual(weekRange(new Date(2026, 9, 30)), { from: '2026-10-26', to: '2026-11-01' })
  assert.deepEqual(weekRange(new Date(2026, 10, 1)), { from: '2026-10-26', to: '2026-11-01' })
  assert.deepEqual(monthRange(new Date(2026, 1, 10)), { from: '2026-02-01', to: '2026-02-28' })
})

test('reto: puntos, quién va ganando y meses anteriores', () => {
  const logs = [
    log('fregar', 'nita', '2026-10-27'),
    log('bano', 'kitos', '2026-10-28'),
    log('fregar', 'kitos', '2026-10-29'),
    log('borrada', 'nita', '2026-10-29', 2),
    log('bano', 'nita', '2026-09-30'),
  ]
  const s = score(chores, logs, '2026-10-01', '2026-10-31')
  assert.deepEqual(s, { nita: 3, kitos: 4, times: { nita: 2, kitos: 2 } })
  // Si cambian los puntos de una tarea (de acuerdo), se recalcula con los nuevos
  assert.equal(score([{ id: 'fregar', points: 2 }, chores[1]], logs, '2026-10-01', '2026-10-31').nita, 4)
  assert.equal(leaderText(s, names), 'Kitos va delante por 1 punto')
  assert.equal(leaderText({ nita: 10, kitos: 4 }, names, true), '¡Gana Nita por 6 puntos! 🏆')
  assert.equal(leaderText({ nita: 5, kitos: 5 }, names), 'Empate a 5')
  assert.equal(leaderText({ nita: 0, kitos: 0 }, names), 'Aún no hay nada apuntado')
  const past = pastMonths(chores, logs, new Date(2026, 9, 30))
  assert.deepEqual(
    past.map((p) => [p.key, p.score.nita, p.score.kitos]),
    [['2026-09', 3, 0]],
  )
})
