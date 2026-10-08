import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PREFS, activityPushes, digestPush, formatRemaining, normalizePrefs, reminderPushes, rolloverDue, type PlanData } from './logic.js'

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
  assert.equal(pushes[0].title, '⏰ Cena')
  assert.match(pushes[0].body, /^Hoy a las \d\d:\d\d \(en 55 min\)$/)
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
  assert.match(r.pushes[0].body, /\(en 20 min\)$/)
})

test('respeta preferencias: sin recordatorios para quien los desactiva', () => {
  const r = reminderPushes(plan({ dueMs: NOW + 30 * 60_000 }), { ...prefs, kitos: { ...DEFAULT_PREFS, reminders: false } }, NOW)
  assert.deepEqual(r.pushes.map((p) => p.to), ['nita'])
})

test('aviso "a la hora" y nada para planes vencidos hace rato o hechos', () => {
  const atTime = { nita: { ...DEFAULT_PREFS, leads: [0] }, kitos: { ...DEFAULT_PREFS, leads: [0] } }
  assert.match(reminderPushes(plan({ assignee: 'nita', dueMs: NOW - 2 * 60_000 }), atTime, NOW).pushes[0].body, /\(ahora\)$/)
  assert.equal(reminderPushes(plan({ dueMs: NOW - 2 * H }), atTime, NOW).pushes.length, 0)
  assert.equal(reminderPushes(plan({ done: true, dueMs: NOW + 10 * 60_000 }), prefs, NOW).pushes.length, 0)
})

test('tarea de todo el día: "Vence hoy" (sin cuenta atrás que se quede vieja)', () => {
  const end = new Date(NOW)
  end.setHours(23, 59, 59, 0)
  const r = reminderPushes(plan({ assignee: 'nita', allDay: true, dueMs: end.getTime(), title: 'Arenero' }), { ...prefs, nita: { ...DEFAULT_PREFS, leads: [1440] } }, NOW)
  assert.equal(r.pushes[0].title, '⏰ Arenero')
  assert.equal(r.pushes[0].body, 'Vence hoy')
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

// ─── Euríbor ────────────────────────────────────────────────────────────────

import { parseEcbCsv } from './euribor.js'

test('lee el CSV del BCE (con títulos entre comillas que llevan comas)', () => {
  const csv = [
    'KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,PROVIDER_FM_ID,DATA_TYPE_FM,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE',
    'FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA,M,U2,EUR,RT,MM,EURIBOR1YD_,HSTA,2026-08,2.153,A,"Euribor 1-year - Historical close, average of observations through period"',
    'FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA,M,U2,EUR,RT,MM,EURIBOR1YD_,HSTA,2026-07,2.081,A,"Euribor 1-year - Historical close, average of observations through period"',
    'FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA,M,U2,EUR,RT,MM,EURIBOR1YD_,HSTA,2026-09,,A,"sin dato"',
    '',
  ].join('\r\n')
  assert.deepEqual(parseEcbCsv(csv), [
    { month: '2026-07', value: 2.081 },
    { month: '2026-08', value: 2.153 },
  ])
  assert.throws(() => parseEcbCsv('A,B\n1,2'), /Formato del BCE inesperado/)
})

// ─── Resumen del día ────────────────────────────────────────────────────────

test('resumen de la mañana: lo de hoy de cada uno, en orden, con atrasadas', () => {
  const at = (iso: string) => new Date(iso).getTime()
  const morning = at('2026-10-06T08:00:00')
  const plans = [
    plan({ id: 'a', kind: 'task', title: 'Arenero', assignee: 'nita', allDay: true, dueMs: allDayAt('2026-10-06') }),
    plan({ id: 'b', kind: 'event', title: 'Dentista', assignee: 'nita', dueMs: at('2026-10-06T10:30:00') }),
    plan({ id: 'c', kind: 'plan', title: 'Cena', assignee: 'both', dueMs: at('2026-10-06T21:00:00') }),
    plan({ id: 'd', kind: 'task', title: 'Bici', assignee: 'kitos', dueMs: at('2026-10-06T12:00:00') }),
    plan({ id: 'e', kind: 'task', title: 'Pagar luz', assignee: 'nita', dueMs: at('2026-10-04T12:00:00') }),
    plan({ id: 'f', kind: 'task', title: 'Hecho', assignee: 'nita', done: true, dueMs: at('2026-10-06T09:00:00') }),
    plan({ id: 'g', kind: 'event', title: 'Boda', assignee: 'both', dueMs: at('2026-10-07T12:00:00') }),
  ]
  const n = digestPush('nita', plans, morning)!
  assert.equal(n.title, '☀️ Buenos días, Nita')
  assert.equal(n.body, '📅 Dentista 10:30 · 💞 Cena 21:00 · 🧹 Arenero\n⚠️ 1 pendiente atrasada')
  assert.equal(digestPush('kitos', plans, morning)!.body, '🧹 Bici 12:00 · 💞 Cena 21:00')
  assert.equal(digestPush('kitos', [plans[6]], morning), null)
})

test('preferencias nuevas con valores por defecto', () => {
  assert.deepEqual(normalizePrefs({ leads: [15] }), { activity: true, reminders: true, leads: [15], digest: true, digestHour: 8, home: true })
  assert.equal(normalizePrefs({ digestHour: 30 }).digestHour, 8)
})

// ─── Avisos de la casa ──────────────────────────────────────────────────────

import { homePushes, paymentsTomorrow } from './homeAlerts.js'
import type { HomeConfig, HomeItem } from './home.js'

const homeCfg: HomeConfig = {
  name: 'Test', basePrice: 300000, vatRate: 0.1, handover: '2028-10',
  mortgage: { pct: 0.8, years: 30, type: 'fixed', fixedRate: 2, spread: 0.6, mixedYears: 10, manualEuribor: null },
  monthlySaving: { nita: 0, kitos: 0 },
}
const hItem = (o: Partial<HomeItem>): HomeItem => ({ id: 'x', title: 'x', category: 'cooperativa', amount: { type: 'fixed', value: 500 }, monthly: null, date: null, paid: false, countsTowardPrice: true, income: false, notes: '', ...o })
const homePrefs = { nita: DEFAULT_PREFS, kitos: DEFAULT_PREFS }

test('casa: la víspera de la cuota del día 5 avisa a los dos', () => {
  const items = [hItem({ title: 'Cuotas mensuales', monthly: { count: 24, day: 5, start: '2026-07', paidOverride: null } })]
  const eve = new Date('2026-11-04T20:00:00')
  assert.deepEqual(paymentsTomorrow(items, homeCfg, eve), [{ title: 'Cuotas mensuales', amount: 500, detail: 'cuota 5 de 24' }])
  const p = homePushes(items, [], homeCfg, homePrefs, eve)
  assert.deepEqual(p.map((x) => x.to), ['nita', 'kitos'])
  assert.equal(p[0].title.replace(/\s/g, ' '), '🏗️ Mañana se paga: 500 €')
  assert.equal(homePushes(items, [], homeCfg, homePrefs, new Date('2026-11-03T20:00:00')).length, 0)
  // Quien desactiva los avisos de la casa no lo recibe
  assert.deepEqual(homePushes(items, [], homeCfg, { ...homePrefs, kitos: { ...DEFAULT_PREFS, home: false } }, eve).map((x) => x.to), ['nita'])
})

test('casa: pagos sueltos con fecha y miles con punto', () => {
  const items = [hItem({ title: 'Notaría', amount: { type: 'fixed', value: 1300 }, date: '2026-11-05' }), hItem({ title: 'Ya pagado', date: '2026-11-05', paid: true })]
  const p = homePushes(items, [], homeCfg, homePrefs, new Date('2026-11-04T20:00:00'))
  assert.equal(p[0].title.replace(/\s/g, ' '), '🏗️ Mañana se paga: 1.300 €')
})

test('casa: el día 1, recordatorio de ahorro solo a quien no lo ha actualizado', () => {
  const now = new Date('2026-12-01T20:00:00')
  const funds = [
    { id: 'a', name: 'Cuenta Nita', owner: 'nita' as const, amount: 1000, updatedAt: now.getTime() - 3 * 86400000 },
    { id: 'b', name: 'Cuenta Kitos', owner: 'kitos' as const, amount: 1000, updatedAt: now.getTime() - 40 * 86400000 },
  ]
  const p = homePushes([], funds, homeCfg, homePrefs, now)
  assert.deepEqual(p.map((x) => x.to), ['kitos'])
  assert.equal(homePushes([], funds, homeCfg, homePrefs, new Date('2026-12-02T20:00:00')).length, 0)
})

test('src/home.ts es idéntico al de la app', () => {
  const here = fileURLToPath(new URL('../src/home.ts', import.meta.url))
  const app = fileURLToPath(new URL('../../src/lib/home.ts', import.meta.url))
  assert.equal(readFileSync(here, 'utf8'), readFileSync(app, 'utf8'))
})
