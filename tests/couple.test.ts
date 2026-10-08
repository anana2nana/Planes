import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysTogether, specialDay } from '../src/lib/couple.ts'
test('app: aniversario y 1.000 días', () => {
  assert.equal(specialDay('2020-10-06', new Date('2026-10-06T08:00')), '🎉 ¡Hoy hacéis 6 años juntos!')
  assert.equal(specialDay('2024-01-01', new Date('2026-09-27T08:00')), '💞 ¡Hoy hacéis 1.000 días juntos!')
  assert.equal(specialDay('2024-01-01', new Date('2026-09-28T08:00')), null)
  assert.equal(daysTogether('2024-01-01', new Date('2026-09-27T23:00')), 1000)
})
