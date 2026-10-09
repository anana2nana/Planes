import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addVisit, avgSpot, distanceKm, euros, guessSpotKind, kmText, lastVisit, sortSpots, type Spot } from '../src/lib/spots.ts'

const s = (o: Partial<Spot>): Spot => ({
  id: o.name ?? 'x',
  name: 'x',
  place: null,
  kind: 'restaurante',
  status: 'been',
  cuisine: '',
  price: null,
  rating: { nita: null, kitos: null },
  order: '',
  notes: '',
  link: '',
  visits: [],
  createdAt: 0,
  ...o,
})
const at = (lat: number, lng: number) => ({ name: 'p', address: '', placeId: null, lat, lng })

test('sitios: visitas y notas', () => {
  const v = addVisit(s({ status: 'want' }), '2026-10-09')
  assert.equal(v.status, 'been')
  assert.deepEqual(addVisit(v, '2026-10-09').visits, ['2026-10-09'])
  assert.deepEqual(addVisit(v, '2026-09-01').visits, ['2026-09-01', '2026-10-09'])
  assert.equal(lastVisit(addVisit(v, '2026-09-01')), '2026-10-09')
  assert.equal(avgSpot(s({ rating: { nita: 4, kitos: 5 } })), 4.5)
  assert.equal(euros(3), '€€€')
  assert.equal(euros(null), '')
})

test('sitios: distancia y orden', () => {
  // Puerta del Sol → Retiro (≈ 1,5 km)
  const km = distanceKm({ lat: 40.4169, lng: -3.7035 }, { lat: 40.4153, lng: -3.6845 })
  assert.ok(km > 1.4 && km < 1.8, String(km))
  assert.equal(kmText(0.33), '350 m')
  assert.equal(kmText(2.345), '2,3 km')
  const list = [s({ name: 'lejos', place: at(40.5, -3.7), rating: { nita: 5, kitos: 5 } }), s({ name: 'cerca', place: at(40.417, -3.704), rating: { nita: 3, kitos: 3 } }), s({ name: 'sin sitio' })]
  assert.deepEqual(
    sortSpots(list, 'been', { lat: 40.4169, lng: -3.7035 }).map((x) => x.name),
    ['cerca', 'lejos', 'sin sitio'],
  )
  assert.deepEqual(
    sortSpots(list, 'been', null).map((x) => x.name),
    ['lejos', 'cerca', 'sin sitio'],
  )
})

test('sitios: tipo por el nombre', () => {
  assert.equal(guessSpotKind('Café de Oriente'), 'cafe')
  assert.equal(guessSpotKind('Taberna La Concha'), 'bar')
  assert.equal(guessSpotKind('Museo del Prado'), 'plan')
  assert.equal(guessSpotKind('Sushi Kai'), 'restaurante')
})
