import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysTo, expiryLevel, expiryText, monthlyCost, nextRenewal, warrantyEnd } from '../src/lib/due.ts'

const today = new Date(2026, 9, 9) // 9 oct 2026

test('vencimientos: días y nivel', () => {
  assert.equal(daysTo('2026-10-09', today), 0)
  assert.equal(daysTo('2026-11-08', today), 30)
  assert.equal(daysTo('2026-10-01', today), -8)
  assert.equal(daysTo('2027-03-29', today), 171) // cruza el cambio de hora
  assert.equal(expiryLevel(null), 'none')
  assert.equal(expiryLevel(-1), 'expired')
  assert.equal(expiryLevel(10), 'urgent')
  assert.equal(expiryLevel(45), 'soon')
  assert.equal(expiryLevel(200), 'ok')
  assert.equal(expiryText(0), 'Caduca hoy')
  assert.equal(expiryText(1), 'Caduca mañana')
  assert.equal(expiryText(12), 'Caduca en 12 días')
  assert.equal(expiryText(95), 'Caduca en 3 meses')
  assert.equal(expiryText(-400), 'Caducó hace 1 año')
  assert.equal(expiryText(5, ['Se renueva', 'Se renovó']), 'Se renueva en 5 días')
})

test('vencimientos: garantía y renovaciones', () => {
  assert.equal(warrantyEnd('2026-02-28'), '2029-02-28')
  assert.equal(warrantyEnd('2024-02-29', 2), '2026-03-01')
  assert.equal(nextRenewal('2026-01-31', 'month', today), '2026-10-31')
  assert.equal(nextRenewal('2025-10-09', 'year', today), '2026-10-09')
  assert.equal(nextRenewal('2025-10-08', 'year', today), '2027-10-08')
  assert.equal(nextRenewal('2026-12-01', 'month', today), '2026-12-01') // aún no ha llegado
  assert.equal(nextRenewal('2026-08-15', 'quarter', today), '2026-11-15')
  assert.equal(monthlyCost(120, 'year'), 10)
})
