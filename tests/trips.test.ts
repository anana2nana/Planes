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
