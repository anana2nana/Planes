import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ageText, daysUntil, describeEvery, nextDue } from '../src/lib/pet.ts'

const today = new Date('2026-10-08T10:00')
test('próxima vez según el intervalo', () => {
  assert.equal(nextDue({ every: { n: 1, unit: 'week' }, last: '2026-10-05' }, today), '2026-10-12')
  assert.equal(nextDue({ every: { n: 3, unit: 'month' }, last: '2026-08-31' }, today), '2026-11-30')
  assert.equal(nextDue({ every: { n: 1, unit: 'year' }, last: '2024-02-29' }, today), '2025-02-28')
  assert.equal(nextDue({ every: { n: 1, unit: 'month' }, last: null }, today), '2026-10-08')
})
test('días que faltan (negativo = atrasado)', () => {
  assert.equal(daysUntil('2026-10-12', today), 4)
  assert.equal(daysUntil('2026-10-01', today), -7)
})
test('edad y textos', () => {
  assert.equal(ageText('2024-07-15', today), '2 años y 2 meses')
  assert.equal(ageText('2026-05-08', today), '5 meses')
  assert.equal(ageText('2026-09-20', today), '2 semanas')
  assert.equal(describeEvery({ n: 3, unit: 'month' }), 'Cada 3 meses')
  assert.equal(describeEvery({ n: 2, unit: 'week' }), 'Cada 2 semanas')
})
