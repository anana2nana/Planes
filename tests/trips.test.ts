import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysToTrip, mergePacking, nights, packingProgress, sortBookings, sortTrips, spent, tripDates, tripStatus, type Booking, type Trip } from '../src/lib/trips.ts'

const today = new Date(2026, 9, 9)
const trip = (o: Partial<Trip>): Trip => ({ id: o.title ?? 'x', title: 'x', destination: null, start: null, end: null, budget: null, bookings: [], packing: [], expenses: [], notes: '', createdAt: 0, ...o })
const b = (o: Partial<Booking>): Booking => ({ id: 'b', kind: 'vuelo', title: '', date: null, time: '', ref: '', link: '', price: null, notes: '', ...o })

test('viajes: estado, cuenta atrás y noches', () => {
  assert.equal(tripStatus(trip({}), today), 'idea')
  assert.equal(tripStatus(trip({ start: '2026-10-20', end: '2026-10-25' }), today), 'upcoming')
  assert.equal(tripStatus(trip({ start: '2026-10-08', end: '2026-10-12' }), today), 'now')
  assert.equal(tripStatus(trip({ start: '2026-09-01', end: '2026-09-05' }), today), 'past')
  assert.equal(tripStatus(trip({ start: '2026-10-09' }), today), 'now')
  assert.equal(daysToTrip(trip({ start: '2026-10-20' }), today), 11)
  assert.equal(daysToTrip(trip({ start: '2026-10-01' }), today), null)
  assert.equal(nights(trip({ start: '2026-10-20', end: '2026-10-25' })), 5)
  assert.equal(nights(trip({ start: '2026-10-20' })), null)
})

test('viajes: gastos, maleta y orden', () => {
  assert.equal(spent(trip({ bookings: [b({ price: 120 }), b({ price: null })], expenses: [{ title: 'Cena', amount: 60.5 }] })), 180.5)
  const merged = mergePacking([{ name: 'Pijama', who: 'nita', done: true }], [{ name: 'pijama', who: 'both' }, { name: 'Cargadores', who: 'both' }])
  assert.deepEqual(merged, [
    { name: 'Pijama', who: 'nita', done: true },
    { name: 'Cargadores', who: 'both', done: false },
  ])
  assert.deepEqual(packingProgress(merged), { done: 1, total: 2 })
  assert.deepEqual(
    sortBookings([b({ id: '1', date: null }), b({ id: '2', date: '2026-10-20', time: '18:00' }), b({ id: '3', date: '2026-10-20', time: '07:30' })]).map((x) => x.id),
    ['3', '2', '1'],
  )
  const trips = [trip({ title: 'pasado', start: '2026-01-01' }), trip({ title: 'idea' }), trip({ title: 'lejos', start: '2027-05-01' }), trip({ title: 'pronto', start: '2026-11-01' }), trip({ title: 'ahora', start: '2026-10-08', end: '2026-10-10' })]
  assert.deepEqual(
    sortTrips(trips, today).map((t) => t.title),
    ['ahora', 'pronto', 'lejos', 'idea', 'pasado'],
  )
  assert.equal(tripDates(trip({ start: '2026-05-03', end: '2026-05-07' })), 'Del 3 al 7 may')
  assert.equal(tripDates(trip({})), 'Sin fecha')
})

import { docWarnings, memoriesDuring, spotsNear } from '../src/lib/trips.ts'

test('viajes: avisos de documentos, recuerdos y sitios cerca', () => {
  const t = trip({ start: '2026-11-01', end: '2026-11-08', destination: { name: 'Lisboa', address: '', placeId: null, lat: 38.72, lng: -9.14 } })
  const papers = [
    { title: 'Pasaporte', kind: 'documento', owner: 'kitos', expires: '2027-02-01' },
    { title: 'DNI', kind: 'documento', owner: 'nita', expires: '2026-11-05' },
    { title: 'Pasaporte', kind: 'documento', owner: 'nita', expires: '2030-01-01' },
    { title: 'Seguro', kind: 'seguro', owner: 'both', expires: '2026-11-02' },
  ]
  assert.deepEqual(
    docWarnings(t, papers).map((w) => `${w.owner} ${w.title} ${w.level} ${w.text}`),
    ['kitos Pasaporte amber caduca menos de 6 meses después de volver (algunos países lo piden)', 'nita DNI red caduca antes de volver'],
  )
  assert.deepEqual(docWarnings(trip({}), papers), [])
  assert.deepEqual(
    memoriesDuring(t, [{ date: '2026-10-31' }, { date: '2026-11-03' }, { date: '2026-11-08' }]).map((m) => m.date),
    ['2026-11-03', '2026-11-08'],
  )
  const at = (lat: number, lng: number) => ({ place: { lat, lng } })
  assert.equal(spotsNear(t, [at(38.71, -9.13), at(40.41, -3.70), { place: null }]).length, 1)
})
