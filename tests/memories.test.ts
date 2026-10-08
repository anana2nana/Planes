import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byMonth, eventPrompts, onThisDay } from '../src/lib/memories.ts'

test('diario: tal día como hoy', () => {
  const ms = [{ date: '2025-10-08' }, { date: '2023-10-08' }, { date: '2026-10-08' }, { date: '2025-10-09' }]
  const r = onThisDay(ms, new Date('2026-10-08T10:00'))
  assert.deepEqual(r.map((x) => [x.memory.date, x.years]), [['2025-10-08', 1], ['2023-10-08', 3]])
})

test('diario: preguntar por citas que ya pasaron', () => {
  const now = new Date('2026-10-08T10:00')
  const at = (s: string) => new Date(s).getTime()
  const events = [
    { id: 'boda', kind: 'event' as const, title: 'Boda de Ana', dueMs: at('2026-10-07T18:00'), repeat: null },
    { id: 'hoy', kind: 'event' as const, title: 'Hoy', dueMs: at('2026-10-08T18:00'), repeat: null },
    { id: 'vieja', kind: 'event' as const, title: 'Vieja', dueMs: at('2026-09-20T18:00'), repeat: null },
    // Cumpleaños de ayer: el servidor ya lo movió al año que viene.
    { id: 'cumple', kind: 'event' as const, title: 'Cumple de Kitos', dueMs: at('2027-10-06T00:00'), repeat: { yearly: true, days: [] } },
    { id: 'gym', kind: 'event' as const, title: 'Pilates', dueMs: at('2026-10-07T19:00'), repeat: { yearly: false, days: [3] } },
    { id: 'plan', kind: 'plan' as const, title: 'Cine', dueMs: at('2026-10-07T19:00'), repeat: null },
  ]
  const r = eventPrompts(events, [], new Set(), now)
  assert.deepEqual(r.map((x) => [x.id, x.date]), [['boda', '2026-10-07'], ['cumple', '2026-10-06']])
  assert.equal(eventPrompts(events, [{ planId: 'boda', date: '2026-10-07' }], new Set(['cumple@2026-10-06']), now).length, 0)
})

test('diario: agrupado por meses', () => {
  const g = byMonth([{ date: '2026-09-01' }, { date: '2026-10-05' }, { date: '2026-10-01' }])
  assert.deepEqual(g.map((x) => [x.label, x.items.length]), [['octubre de 2026', 2], ['septiembre de 2026', 1]])
})
