import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeRepeat, nextOccurrence, parseRepeat, upcomingOccurrences } from '../src/lib/recurrence.ts'

const at = (s: string) => new Date(`${s}T19:00`)
const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : null)
const tue = { days: [2], yearly: false, rotate: false }
const tue2 = { ...tue, every: 2 }

test('cada 2 semanas', () => {
  // Martes 6 oct 2026 → el siguiente, martes 20 (no el 13)
  assert.equal(ymd(nextOccurrence(at('2026-10-06'), tue2, at('2026-10-06'))), '2026-10-20')
  assert.equal(ymd(nextOccurrence(at('2026-10-06'), tue, at('2026-10-06'))), '2026-10-13')
  // Atrasada y completada el jueves 15: sigue en su ritmo (martes 20), no el 13 ni el 27
  assert.equal(ymd(nextOccurrence(at('2026-10-06'), tue2, at('2026-10-15'))), '2026-10-20')
  // Completada el jueves 8 (atrasada 2 días): la siguiente sigue siendo el martes 20
  assert.equal(ymd(nextOccurrence(at('2026-10-06'), tue2, at('2026-10-08'))), '2026-10-20')
  // Martes y sábado cada 2 semanas: mar 6 → sáb 10 → mar 20
  const ts2 = { days: [2, 6], yearly: false, rotate: false, every: 2 }
  assert.equal(ymd(nextOccurrence(at('2026-10-06'), ts2, at('2026-10-06'))), '2026-10-10')
  assert.equal(ymd(nextOccurrence(at('2026-10-10'), ts2, at('2026-10-10'))), '2026-10-20')
  // Cambio de hora (25 oct) por medio
  assert.equal(ymd(nextOccurrence(at('2026-10-20'), tue2, at('2026-10-20'))), '2026-11-03')
  assert.deepEqual(upcomingOccurrences(at('2026-10-06'), tue2, at('2026-11-30')).map(ymd), ['2026-10-20', '2026-11-03', '2026-11-17'])
  assert.equal(nextOccurrence(at('2026-10-06'), tue2, at('2026-10-06'))!.getHours(), 19)
})

test('posponer sin cambiar el día de la semana', () => {
  // Tocaba el martes 6, se pospuso al jueves 8 y se hace el jueves: la siguiente, el martes 13
  assert.equal(ymd(nextOccurrence(at('2026-10-08'), tue, at('2026-10-08'), at('2026-10-06'))), '2026-10-13')
  // Cada 2 semanas: martes 20
  assert.equal(ymd(nextOccurrence(at('2026-10-08'), tue2, at('2026-10-08'), at('2026-10-06'))), '2026-10-20')
  // Hecha antes del día pospuesto (el miércoles 7): igual, martes 13
  assert.equal(ymd(nextOccurrence(at('2026-10-08'), tue, at('2026-10-07'), at('2026-10-06'))), '2026-10-13')
  // Pospuesta más allá de la siguiente (al miércoles 14): después de ese día
  assert.equal(ymd(nextOccurrence(at('2026-10-14'), tue, at('2026-10-14'), at('2026-10-06'))), '2026-10-20')
  // Calendario: lo pospuesto el jueves 8, y luego martes 13, 20…
  assert.deepEqual(upcomingOccurrences(at('2026-10-08'), tue, at('2026-10-21'), 60, at('2026-10-06')).map(ymd), ['2026-10-13', '2026-10-20'])
})

test('textos y lectura', () => {
  assert.equal(describeRepeat(tue2), 'Un martes sí y otro no')
  assert.equal(describeRepeat({ days: [2, 6], yearly: false, every: 2 }), 'Martes y sábados, cada 2 semanas')
  assert.equal(describeRepeat(tue), 'Cada martes')
  assert.deepEqual(parseRepeat({ days: [2], every: 2 }), { days: [2], yearly: false, rotate: false, every: 2 })
  assert.deepEqual(parseRepeat({ days: [2] }), { days: [2], yearly: false, rotate: false })
})

test('cada mes, cada 3 o 6 meses y cada año', () => {
  const m1 = { days: [], yearly: false, rotate: false, months: 1 }
  assert.equal(ymd(nextOccurrence(at('2026-10-15'), m1, at('2026-10-15'))), '2026-11-15')
  // El 31 cae en el último día de los meses cortos, pero vuelve al 31 cuando se puede
  assert.equal(ymd(nextOccurrence(at('2027-01-31'), m1, at('2027-01-31'))), '2027-02-28')
  assert.equal(ymd(nextOccurrence(at('2027-02-28'), m1, at('2027-02-28'), at('2027-01-31'))), '2027-03-31')
  // Atrasada (no se hizo el 15) y hecha el 20: la siguiente, el 15 del mes que viene
  assert.equal(ymd(nextOccurrence(at('2026-10-15'), m1, at('2026-10-20'))), '2026-11-15')
  // Atrasada más de un mes: no se acumulan
  assert.equal(ymd(nextOccurrence(at('2026-08-15'), m1, at('2026-10-20'))), '2026-11-15')
  const m3 = { days: [], yearly: false, rotate: false, months: 3 }
  assert.equal(ymd(nextOccurrence(at('2026-10-15'), m3, at('2026-10-15'))), '2027-01-15')
  // Pospuesta del 15 al 18: la siguiente sigue siendo el 15
  assert.equal(ymd(nextOccurrence(at('2026-10-18'), m3, at('2026-10-18'), at('2026-10-15'))), '2027-01-15')
  assert.deepEqual(upcomingOccurrences(at('2026-10-15'), { ...m3, months: 6 }, at('2027-12-31')).map(ymd), ['2027-04-15', '2027-10-15'])
  const y = { days: [], yearly: true, rotate: false }
  assert.equal(ymd(nextOccurrence(at('2024-02-29'), y, at('2026-10-10'))), '2027-02-28')
  assert.equal(ymd(nextOccurrence(at('2026-10-15'), y, at('2026-10-15'))), '2027-10-15')
  assert.equal(describeRepeat(m1), 'Cada mes')
  assert.equal(describeRepeat(m3), 'Cada 3 meses')
  assert.deepEqual(parseRepeat({ days: [], months: 6, rotate: true }), { days: [], yearly: false, rotate: true, months: 6 })
  assert.equal(parseRepeat({ days: [], months: 5 }), null)
})
