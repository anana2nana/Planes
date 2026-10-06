import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PREFS, activityPushes, formatRemaining, reminderPushes, rolloverDue, type PlanData } from './logic.js'

const H = 3_600_000
const NOW = Date.parse('2026-10-06T10:00:00+02:00')
const plan = (o: Partial<PlanData> = {}): PlanData => ({
  id: 'p1',
  title: 'Cena',
  assignee: 'both',
  groupId: null,
  dueMs: NOW + 3 * H,
  allDay: false,
  done: false,
  doneBy: null,
  createdBy: 'nita',
  remindersSent: [],
  spawnedFrom: null,
  kind: 'plan',
  repeat: null,
  remindWeekBefore: false,
  ...o,
})
const prefs = { nita: DEFAULT_PREFS, kitos: DEFAULT_PREFS }

test('crear un plan para los dos avisa solo a la pareja', () => {
  const r = activityPushes(null, plan(), NOW)
  assert.equal(r.length, 1)
  assert.equal(r[0].to, 'kitos')
  assert.match(r[0].title, /Nita ha añadido un plan para los dos/)
  assert.match(r[0].body, /Cena · hoy a las 13:00/)
})

test('crear un plan para mí misma no avisa a nadie', () => {
  assert.deepEqual(activityPushes(null, plan({ assignee: 'nita' }), NOW), [])
})

test('asignar un plan a la pareja la avisa', () => {
  const r = activityPushes(null, plan({ assignee: 'kitos' }), NOW)
  assert.equal(r[0].to, 'kitos')
  assert.match(r[0].title, /te ha asignado/)
})

test('duplicar: solo la copia de la pareja genera aviso', () => {
  assert.equal(activityPushes(null, plan({ assignee: 'nita', groupId: 'g' }), NOW).length, 0)
  const r = activityPushes(null, plan({ assignee: 'kitos', groupId: 'g' }), NOW)
  assert.match(r[0].title, /para cada uno/)
})

test('completar avisa a la pareja de quien lo completa', () => {
  const r = activityPushes(plan(), plan({ done: true, doneBy: 'kitos' }), NOW)
  assert.equal(r[0].to, 'nita')
  assert.match(r[0].title, /Kitos ha completado un plan/)
})

test('la siguiente repetición automática no avisa como plan nuevo', () => {
  assert.deepEqual(activityPushes(null, plan({ assignee: 'kitos', spawnedFrom: 'p0' }), NOW), [])
})

test('completar una repetición sí avisa', () => {
  const r = activityPushes(plan({ spawnedFrom: 'p0' }), plan({ spawnedFrom: 'p0', done: true, doneBy: 'nita' }), NOW)
  assert.equal(r[0].to, 'kitos')
})

test('editar o borrar no genera avisos', () => {
  assert.deepEqual(activityPushes(plan(), plan({ title: 'Otra' }), NOW), [])
  assert.deepEqual(activityPushes(plan(), null, NOW), [])
})

test('recordatorio de 1 h llega a ambos cuando toca', () => {
  const { pushes, markSent } = reminderPushes(plan({ dueMs: NOW + 55 * 60_000 }), prefs, NOW)
  assert.deepEqual(pushes.map((p) => p.to).sort(), ['kitos', 'nita'])
  assert.equal(pushes[0].title, '⏰ Quedan 55 min')
  // El de 1 día también se marca como enviado para que no llegue después.
  assert.deepEqual(markSent.sort(), ['kitos:1440', 'kitos:60', 'nita:1440', 'nita:60'])
})

test('no repite un recordatorio ya enviado', () => {
  const sent = ['nita:60', 'nita:1440', 'kitos:60', 'kitos:1440']
  const r = reminderPushes(plan({ dueMs: NOW + 30 * 60_000, remindersSent: sent }), prefs, NOW)
  assert.equal(r.pushes.length, 0)
  assert.equal(r.markSent.length, 0)
})

test('plan creado con poca antelación: un solo aviso, no "queda 1 día"', () => {
  const r = reminderPushes(plan({ assignee: 'nita', dueMs: NOW + 20 * 60_000 }), prefs, NOW)
  assert.equal(r.pushes.length, 1)
  assert.equal(r.pushes[0].title, '⏰ Quedan 20 min')
})

test('respeta preferencias: sin recordatorios para quien los desactiva', () => {
  const r = reminderPushes(plan({ dueMs: NOW + 30 * 60_000 }), { ...prefs, kitos: { ...DEFAULT_PREFS, reminders: false } }, NOW)
  assert.deepEqual(r.pushes.map((p) => p.to), ['nita'])
})

test('aviso "a la hora" y nada para planes vencidos hace rato o hechos', () => {
  const atTime = { nita: { ...DEFAULT_PREFS, leads: [0] }, kitos: { ...DEFAULT_PREFS, leads: [0] } }
  assert.equal(reminderPushes(plan({ assignee: 'nita', dueMs: NOW - 2 * 60_000 }), atTime, NOW).pushes[0].title, '⏰ Es ahora')
  assert.equal(reminderPushes(plan({ dueMs: NOW - 2 * H }), atTime, NOW).pushes.length, 0)
  assert.equal(reminderPushes(plan({ done: true, dueMs: NOW + 10 * 60_000 }), prefs, NOW).pushes.length, 0)
})

test('formato del tiempo restante', () => {
  assert.equal(formatRemaining(90 * 60_000), 'Quedan 2 horas')
  assert.equal(formatRemaining(60 * 60_000), 'Queda 1 hora')
  assert.equal(formatRemaining(26 * H), 'Queda 1 día')
})

// ─── Tipos (citas / tareas) ─────────────────────────────────────────────────

const YEARLY = { days: [], yearly: true, rotate: false }
/** Fin del día local (como guarda la app las cosas "de todo el día"). */
const allDayAt = (iso: string) => new Date(`${iso}T23:59:59`).getTime()

test('textos por tipo al crear', () => {
  assert.match(activityPushes(null, plan({ kind: 'task', assignee: 'kitos' }), NOW)[0].title, /Nita te ha asignado una tarea/)
  assert.match(activityPushes(null, plan({ kind: 'event', assignee: 'both' }), NOW)[0].title, /📅 Nita ha añadido una cita para los dos/)
  assert.match(activityPushes(null, plan({ kind: 'event', assignee: 'kitos' }), NOW)[0].title, /te ha apuntado una cita/)
  assert.match(activityPushes(plan({ kind: 'task' }), plan({ kind: 'task', done: true, doneBy: 'kitos' }), NOW)[0].title, /Kitos ha completado una tarea ✓/)
})

test('cumpleaños (todo el día): el aviso de 1 h es a las 8:00, no a las 22:59', () => {
  const bday = plan({ kind: 'event', allDay: true, dueMs: allDayAt('2026-10-06'), repeat: YEARLY, title: 'Cumple de Laura' })
  const at = (hhmm: string) => new Date(`2026-10-06T${hhmm}:00`).getTime()
  const prefs1h = { nita: { ...DEFAULT_PREFS, leads: [60] }, kitos: { ...DEFAULT_PREFS, leads: [60] } }
  assert.equal(reminderPushes(bday, prefs1h, at('07:50')).pushes.length, 0)
  const r = reminderPushes(bday, prefs1h, at('08:05'))
  assert.equal(r.pushes.length, 2)
  assert.equal(r.pushes[0].title, '🎂 Cumple de Laura')
  assert.match(r.pushes[0].body, /^Hoy$/)
})

test('cumpleaños: aviso una semana antes', () => {
  const bday = plan({ kind: 'event', assignee: 'nita', allDay: true, dueMs: allDayAt('2026-10-13'), repeat: YEARLY, remindWeekBefore: true, title: 'Cumple de mamá' })
  const r = reminderPushes(bday, prefs, new Date('2026-10-06T09:10:00').getTime())
  assert.equal(r.pushes.length, 1)
  assert.match(r.pushes[0].body, /^Dentro de 7 días · Martes/)
  // Sin la opción, una semana antes no avisa
  assert.equal(reminderPushes({ ...bday, remindWeekBefore: false }, prefs, new Date('2026-10-06T09:10:00').getTime()).pushes.length, 0)
})

test('cita con hora: aviso normal', () => {
  const dentist = plan({ kind: 'event', assignee: 'kitos', dueMs: new Date('2026-10-06T10:30:00').getTime(), title: 'Dentista' })
  const r = reminderPushes(dentist, prefs, new Date('2026-10-06T09:35:00').getTime())
  assert.equal(r.pushes[0].title, '📅 Dentista')
  assert.match(r.pushes[0].body, /^Hoy a las 10:30/)
})

test('cumpleaños que ya pasó → pasa al año siguiente', () => {
  const bday = { kind: 'event' as const, allDay: true, repeat: YEARLY, dueMs: allDayAt('2026-10-05') }
  const next = rolloverDue(bday, new Date('2026-10-06T00:30:00').getTime())
  assert.equal(new Date(next!).toDateString(), 'Tue Oct 05 2027')
  // El mismo día aún no se mueve
  assert.equal(rolloverDue({ ...bday, dueMs: allDayAt('2026-10-06') }, new Date('2026-10-06T20:00:00').getTime()), null)
})

test('cita semanal que pasó → siguiente semana a la misma hora; tareas y no repetidas no se mueven', () => {
  const english = { kind: 'event' as const, allDay: false, repeat: { days: [4], yearly: false, rotate: false }, dueMs: new Date('2026-10-01T18:00:00').getTime() }
  assert.equal(new Date(rolloverDue(english, new Date('2026-10-06T10:00:00').getTime())!).toString().slice(0, 21), 'Thu Oct 08 2026 18:00')
  assert.equal(rolloverDue({ ...english, kind: 'task' }, new Date('2026-10-06T10:00:00').getTime()), null)
  assert.equal(rolloverDue({ ...english, repeat: null }, new Date('2026-10-06T10:00:00').getTime()), null)
})

test('src/recurrence.ts es idéntico al de la app', () => {
  const here = fileURLToPath(new URL('../src/recurrence.ts', import.meta.url))
  const app = fileURLToPath(new URL('../../src/lib/recurrence.ts', import.meta.url))
  assert.equal(readFileSync(here, 'utf8'), readFileSync(app, 'utf8'))
})
