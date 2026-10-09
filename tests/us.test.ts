import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capsuleState, opensIn, spotifySearch, timeline, yearsBetween, youtubeSearch } from '../src/lib/us.ts'

const today = new Date(2026, 9, 9)

test('lo vuestro: canciones', () => {
  assert.equal(spotifySearch('Ojalá', 'Silvio Rodríguez'), 'https://open.spotify.com/search/Ojal%C3%A1%20Silvio%20Rodr%C3%ADguez')
  assert.equal(youtubeSearch('Ojalá', ''), 'https://www.youtube.com/results?search_query=Ojal%C3%A1')
})

test('lo vuestro: hitos', () => {
  const t = timeline(
    [
      { id: 'a', date: '2023-05-01', title: 'Primer viaje', emoji: '✈️', text: '' },
      { id: 'b', date: '2021-01-10', title: 'Primera cita', emoji: '💋', text: '' },
    ],
    '2021-02-14',
  )
  assert.deepEqual(
    t.map((m) => m.title),
    ['Primera cita', 'Empezamos', 'Primer viaje'],
  )
  assert.equal(timeline([{ id: 'x', date: '2021-02-14', title: 'Nuestro día', emoji: '💞', text: '' }], '2021-02-14').length, 1)
  assert.equal(yearsBetween('2021-10-09', today), 5)
  assert.equal(yearsBetween('2021-10-10', today), 4)
})

test('lo vuestro: cápsula del tiempo', () => {
  assert.deepEqual(capsuleState('2026-10-09', today), { open: true, days: 0 })
  assert.deepEqual(capsuleState('2026-10-10', today), { open: false, days: 1 })
  assert.equal(opensIn(1), 'Se abre mañana')
  assert.equal(opensIn(20), 'Se abre en 20 días')
  assert.equal(opensIn(128), 'Se abre en 4 meses')
  assert.equal(opensIn(1100), 'Se abre en 3 años')
  assert.equal(opensIn(0), 'Ya se puede abrir')
})
