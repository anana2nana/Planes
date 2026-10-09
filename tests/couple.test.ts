import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysTogether, specialDay } from '../src/lib/couple.ts'
test('app: aniversario y 1.000 días', () => {
  assert.equal(specialDay('2020-10-06', new Date('2026-10-06T08:00')), '🎉 ¡Hoy hacéis 6 años juntos!')
  assert.equal(specialDay('2024-01-01', new Date('2026-09-27T08:00')), '💞 ¡Hoy hacéis 1.000 días juntos!')
  assert.equal(specialDay('2024-01-01', new Date('2026-09-28T08:00')), null)
  assert.equal(daysTogether('2024-01-01', new Date('2026-09-27T23:00')), 1000)
})

import { nextAnniversary, togetherBreakdown, togetherText } from '../src/lib/couple.ts'

test('juntos desde: años, meses, semanas y días', () => {
  assert.deepEqual(togetherBreakdown('2020-11-15', new Date('2026-10-09T10:00')), { years: 5, months: 10, weeks: 3, days: 3 })
  assert.equal(togetherText(togetherBreakdown('2020-11-15', new Date('2026-10-09T10:00'))), '5 años, 10 meses, 3 semanas y 3 días')
  assert.equal(togetherText(togetherBreakdown('2025-10-09', new Date('2026-10-09T10:00'))), '1 año')
  assert.equal(togetherText(togetherBreakdown('2026-10-01', new Date('2026-10-09T10:00'))), '1 semana y 1 día')
  assert.equal(togetherText(togetherBreakdown('2026-10-09', new Date('2026-10-09T10:00'))), 'Hoy empieza todo 💞')
  assert.deepEqual(nextAnniversary('2020-11-15', new Date('2026-10-09T10:00')), { days: 37, years: 6 })
  assert.deepEqual(nextAnniversary('2020-10-09', new Date('2026-10-09T10:00')), { days: 0, years: 6 })
})
