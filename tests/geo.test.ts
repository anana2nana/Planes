import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldKeep, decodePolyline, durationText, elevation, encodePolyline, isRouteLink, kmFmt, movingMinutes, paceText, parseGpx, profile, thin, trackKm, trackStats } from '../src/lib/geo.ts'

test('rutas: polilínea codificada (ejemplo de la documentación de Google)', () => {
  const pts = [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ]
  assert.equal(encodePolyline(pts), '_p~iF~ps|U_ulLnnqC_mqNvxq`@')
  assert.deepEqual(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), pts)
  assert.deepEqual(decodePolyline(''), [])
})

test('rutas: distancia, desnivel, tiempo y ritmo', () => {
  // ~1,5 km de la Puerta del Sol al Retiro
  const km = trackKm([
    { lat: 40.4169, lng: -3.7035 },
    { lat: 40.4153, lng: -3.6845 },
  ])
  assert.ok(km > 1.5 && km < 1.7, String(km))
  assert.deepEqual(elevation([600, 601, 599, 610, 612, 605, 620]), { gain: 25, loss: 5, min: 599, max: 620 })
  assert.deepEqual(elevation([null, null]), { gain: 0, loss: 0, min: null, max: null })
  const t0 = Date.UTC(2026, 9, 9, 9)
  const pts = [
    { lat: 40.0, lng: -3.0, ele: 600, t: t0 },
    { lat: 40.001, lng: -3.0, ele: 605, t: t0 + 60_000 },
    { lat: 40.001, lng: -3.0, ele: 605, t: t0 + 10 * 60_000 }, // parada de 9 min
    { lat: 40.002, lng: -3.0, ele: 612, t: t0 + 11 * 60_000 },
  ]
  assert.equal(movingMinutes(pts), 2)
  const s = trackStats(pts)
  assert.equal(s.minutes, 11)
  assert.equal(s.moving, 2)
  assert.equal(s.gain, 12)
  assert.equal(paceText(5, 62), '12:24 min/km')
  assert.equal(paceText(0, 10), '')
  assert.equal(durationText(85), '1 h 25 min')
  assert.equal(durationText(120), '2 h')
  assert.equal(durationText(45), '45 min')
  assert.equal(kmFmt(5.256), '5,26 km')
  assert.equal(kmFmt(12.34), '12,3 km')
})

test('rutas: aligerar puntos y perfil', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ lat: 40 + i * 0.00001, lng: -3 }))
  const th = thin(many, 8)
  assert.ok(th.length < 20 && th[0] === many[0] && th[th.length - 1] === many[99])
  const p = profile([
    { lat: 40, lng: -3, ele: 600, t: null },
    { lat: 40.01, lng: -3, ele: 650, t: null },
  ])
  assert.deepEqual(p, [
    { km: 0, ele: 600 },
    { km: 1.11, ele: 650 },
  ])
  assert.deepEqual(profile([{ lat: 40, lng: -3, ele: null, t: null }]), [])
})

test('rutas: leer un GPX', () => {
  const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><metadata><name><![CDATA[Cuerda Larga & Bola del Mundo]]></name></metadata>
  <trk><name>otra</name><trkseg>
    <trkpt lat="40.78" lon="-3.95"><ele>1800.5</ele><time>2026-10-04T09:00:00Z</time></trkpt>
    <trkpt lon="-3.951" lat="40.781"><ele>1820</ele><time>2026-10-04T09:05:00Z</time></trkpt>
    <trkpt lat="40.782" lon="-3.952"/>
  </trkseg></trk></gpx>`
  const r = parseGpx(gpx)
  assert.equal(r.name, 'Cuerda Larga & Bola del Mundo')
  assert.equal(r.points.length, 3)
  assert.deepEqual(r.points[1], { lat: 40.781, lng: -3.951, ele: 1820, t: Date.parse('2026-10-04T09:05:00Z') })
  assert.deepEqual(r.points[2], { lat: 40.782, lng: -3.952, ele: null, t: null })
  // Rutas (rtept) cuando no hay track
  assert.equal(parseGpx('<gpx><rte><name>Plan</name><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2"/></rte></gpx>').points.length, 2)
  assert.deepEqual(parseGpx('<gpx></gpx>'), { name: '', points: [] })
  assert.ok(isRouteLink('https://es.wikiloc.com/rutas-senderismo/la-pedriza-123'))
  assert.ok(!isRouteLink('https://www.amazon.es/x'))
})

test('rutas: qué lecturas del GPS se guardan', () => {
  const t0 = Date.UTC(2026, 9, 9, 9)
  const a = { lat: 40, lng: -3, ele: null, t: t0 }
  assert.equal(shouldKeep(null, a, 12), true)
  assert.equal(shouldKeep(null, a, 80), false) // imprecisa
  assert.equal(shouldKeep(a, { lat: 40.00002, lng: -3, ele: null, t: t0 + 5000 }, 10), false) // 2 m: quieto
  assert.equal(shouldKeep(a, { lat: 40.0001, lng: -3, ele: null, t: t0 + 5000 }, 10), true) // 11 m en 5 s
  assert.equal(shouldKeep(a, { lat: 40.001, lng: -3, ele: null, t: t0 + 5000 }, 10), false) // 111 m en 5 s: salto
  assert.ok(!isRouteLink('https://example.com/rutas-de-tapas'))
})
