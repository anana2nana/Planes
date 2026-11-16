import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addedPushes,
  cleanLink,
  dateState,
  dateText,
  distanceKm,
  endingPushes,
  guessKind,
  heartsText,
  history,
  linkLabel,
  matches,
  parseBbsItem,
  pickWeighted,
  sortPending,
  urgencyText,
  verdict,
  weight,
  type BbsItem,
} from '../src/lib/bbs.ts'

const item = (o: Partial<BbsItem> = {}): BbsItem => ({ ...parseBbsItem(o.id ?? 'a', { title: 'Plan' }), ...o })
const TODAY = '2026-11-16'
const SOL = { lat: 40.4169, lng: -3.7035 }

test('fechas: sin fechas, por empezar, abierto y pasado', () => {
  assert.equal(dateState(item(), TODAY), 'none')
  assert.equal(dateState(item({ from: '2026-11-20', to: '2026-11-30' }), TODAY), 'soon')
  assert.equal(dateState(item({ from: '2026-11-10', to: '2026-11-16' }), TODAY), 'open')
  assert.equal(dateState(item({ to: '2026-11-15' }), TODAY), 'over')
  assert.equal(dateText({ from: '2026-11-22', to: '2026-11-22' }), 'Solo el 22 nov')
  assert.equal(dateText({ from: '2026-12-01', to: '2026-12-15' }), 'Del 1 dic al 15 dic')
  assert.equal(dateText({ from: null, to: '2026-11-30' }), 'Hasta el 30 nov')
  assert.equal(urgencyText({ from: null, to: TODAY }, TODAY), 'Acaba hoy')
  assert.equal(urgencyText({ from: null, to: '2026-11-17' }, TODAY), 'Acaba mañana')
  assert.equal(urgencyText({ from: null, to: '2026-11-20' }, TODAY), 'Quedan 4 días')
  assert.equal(urgencyText({ from: null, to: '2027-01-20' }, TODAY), null)
  assert.equal(urgencyText({ from: '2026-11-22', to: '2026-11-22' }, TODAY), 'El 22 nov')
})

test('❤️: a los tres, a dos o solo a uno (y "ti")', () => {
  assert.equal(heartsText(item({ hearts: { nita: true, kitos: true, maria: true } })), 'Apetece a los tres')
  assert.equal(heartsText(item({ hearts: { nita: true, maria: true } }), 'nita'), 'Os apetece a ti y a María')
  assert.equal(heartsText(item({ hearts: { nita: true, maria: true } }), 'kitos'), 'Apetece a Nita y María')
  assert.equal(heartsText(item({ hearts: { kitos: true } }), 'kitos'), 'Solo te apetece a ti')
  assert.equal(heartsText(item({ hearts: { kitos: true } })), 'Solo le apetece a Kitos')
  assert.equal(heartsText(item()), '')
})

test('valoración: la que más se repite y, en empate, la mejor', () => {
  assert.equal(verdict({ nita: 'again', kitos: 'meh', maria: 'again' }), 'again')
  assert.equal(verdict({ nita: 'good', kitos: 'meh' }), 'good')
  assert.equal(verdict({}), null)
})

test('pendientes: primero lo que se acaba, luego lo que más apetece; histórico por fecha', () => {
  const a = item({ id: 'a', createdMs: 3 })
  const b = item({ id: 'b', hearts: { nita: true, kitos: true }, createdMs: 1 })
  const c = item({ id: 'c', to: '2026-11-18', createdMs: 2 })
  const d = item({ id: 'd', status: 'done', doneAt: '2026-10-01' })
  const e = item({ id: 'e', status: 'done', doneAt: '2026-11-01' })
  assert.deepEqual(sortPending([a, b, c, d], TODAY).map((i) => i.id), ['c', 'b', 'a'])
  assert.deepEqual(history([a, d, e]).map((i) => i.id), ['e', 'd'])
})

test('filtros de "No sabemos qué hacer"', () => {
  const cerca = item({ id: 'cerca', price: 1, place: { name: 'Bar', address: '', placeId: null, lat: 40.42, lng: -3.70 }, kind: 'bar' })
  const lejos = item({ id: 'lejos', price: 3, place: { name: 'Toledo', address: '', placeId: null, lat: 39.86, lng: -4.03 }, kind: 'escapada', setting: 'out' })
  const casa = item({ id: 'casa', kind: 'casa' })
  const ruta = item({ id: 'ruta', kind: 'ruta' })
  const luego = item({ id: 'luego', from: '2026-12-01', to: '2026-12-10' })
  const pasado = item({ id: 'pasado', to: '2026-11-01' })
  const hecho = item({ id: 'hecho', status: 'done' })
  const all = [cerca, lejos, casa, ruta, luego, pasado, hecho]
  const ids = (f: Parameters<typeof matches>[1], here = SOL) => all.filter((i) => matches(i, f, TODAY, here)).map((i) => i.id)
  assert.deepEqual(ids({}), ['cerca', 'lejos', 'casa', 'ruta', 'luego'])
  assert.deepEqual(ids({ today: true }), ['cerca', 'lejos', 'casa', 'ruta'])
  assert.deepEqual(ids({ near: true }), ['cerca', 'casa'])
  assert.deepEqual(ids({ cheap: true }), ['cerca', 'casa'])
  assert.deepEqual(ids({ rain: true }), ['cerca', 'casa'])
  assert.deepEqual(ids({ kinds: ['ruta', 'escapada'] }), ['lejos', 'ruta'])
  assert.ok(distanceKm(SOL, { lat: 39.86, lng: -4.03 }) > 60)
})

test('sorteo con peso: más ❤️, más papeletas (y nunca repite el de antes)', () => {
  const none = item({ id: 'none' })
  const three = item({ id: 'three', hearts: { nita: true, kitos: true, maria: true } })
  assert.equal(weight(none, TODAY), 1)
  assert.equal(weight(three, TODAY), 9)
  assert.equal(weight(item({ to: '2026-11-18' }), TODAY), 1.5)
  // 10 papeletas: la primera es de "none", las 9 siguientes de "three".
  assert.equal(pickWeighted([none, three], TODAY, 0.05)?.id, 'none')
  assert.equal(pickWeighted([none, three], TODAY, 0.5)?.id, 'three')
  assert.equal(pickWeighted([none, three], TODAY, 0.5, 'three')?.id, 'none')
  assert.equal(pickWeighted([three], TODAY, 0.5, 'three')?.id, 'three')
  assert.equal(pickWeighted([], TODAY, 0.5), null)
  // Con muchas tiradas, el de tres ❤️ sale ~9 de cada 10.
  let wins = 0
  for (let k = 0; k < 1000; k++) if (pickWeighted([none, three], TODAY, k / 1000)?.id === 'three') wins++
  assert.equal(wins, 900)
})

test('apuntar: tipo adivinado, enlace limpio y nombre de la web', () => {
  assert.equal(guessKind('Ruta de las Cascadas del Purgatorio'), 'ruta')
  assert.equal(guessKind('', 'https://es.wikiloc.com/rutas-senderismo/x'), 'ruta')
  assert.equal(guessKind('Exposición de Sorolla en el Prado'), 'expo')
  assert.equal(guessKind('Mercadillo navideño de la Plaza Mayor'), 'expo')
  assert.equal(guessKind('El mejor brunch de Madrid'), 'restaurante')
  assert.equal(guessKind('Coctelería escondida en Malasaña'), 'bar')
  assert.equal(guessKind('Casa rural en la Vera'), 'escapada')
  assert.equal(guessKind('Noche de juego de mesa'), 'casa')
  assert.equal(guessKind('Algo'), 'otro')
  assert.equal(cleanLink('https://www.instagram.com/reel/abc/?igsh=xyz&utm_source=ig'), 'https://www.instagram.com/reel/abc/')
  assert.equal(cleanLink('https://www.tiktok.com/@x/video/1?is_from_webapp=1&sender_device=pc&q=1'), 'https://www.tiktok.com/@x/video/1?q=1')
  assert.equal(cleanLink('sin enlace'), 'sin enlace')
  assert.equal(linkLabel('https://www.instagram.com/p/1'), 'Instagram')
  assert.equal(linkLabel('https://vm.tiktok.com/abc'), 'TikTok')
  assert.equal(linkLabel('https://maps.app.goo.gl/xyz'), 'Google Maps')
  assert.equal(linkLabel('https://www.esmadrid.com/agenda'), 'esmadrid.com')
})

test('avisos: lo nuevo va a los otros dos, nunca a quien lo apunta', () => {
  const r = addedPushes(item({ id: 'x', title: 'Casa Lucio', kind: 'restaurante', addedBy: 'maria', place: { name: 'Casa Lucio', address: '', placeId: null, lat: null, lng: null } }))
  assert.deepEqual(r.map((p) => p.to), ['nita', 'kitos'])
  assert.equal(r[0].title, '🍽️ María ha apuntado algo en bbs')
  assert.equal(r[0].body, 'Casa Lucio')
  const e = addedPushes(item({ title: 'Expo', kind: 'expo', addedBy: 'nita', to: '2026-12-01' }))
  assert.deepEqual(e.map((p) => p.to), ['kitos', 'maria'])
  assert.equal(e[0].body, 'Expo · Hasta el 1 dic')
})

test('avisos de "se acaba": 7 y 2 días antes y el último día, sin repetir', () => {
  const expo = item({ id: 'expo', title: 'Sorolla', kind: 'expo', from: '2026-10-01', to: '2026-11-23', hearts: { maria: true } })
  const [r] = endingPushes([expo], TODAY)
  assert.equal(r.step, '7')
  assert.equal(r.pushes.length, 3)
  assert.equal(r.pushes[0].title, '⏳ Se acaba en una semana: Sorolla')
  assert.equal(r.pushes[0].body, 'Del 1 oct al 23 nov · ❤️ María')
  assert.deepEqual(endingPushes([{ ...expo, endingSent: ['7'] }], TODAY), [])
  assert.deepEqual(endingPushes([expo], '2026-11-18'), [])
  assert.equal(endingPushes([expo], '2026-11-21')[0].pushes[0].title, '⏳ Se acaba pasado mañana: Sorolla')
  assert.equal(endingPushes([expo], '2026-11-23')[0].pushes[0].title, '⏳ Último día: Sorolla')
  assert.deepEqual(endingPushes([{ ...expo, status: 'done' }], '2026-11-23'), [])
  // Un solo día (mercadillo): avisa una semana y dos días antes, aunque aún no haya empezado.
  const dia = item({ id: 'dia', title: 'Mercadillo', kind: 'expo', from: '2026-11-23', to: '2026-11-23' })
  assert.equal(endingPushes([dia], TODAY)[0].pushes[0].title, '🖼️ Dentro de una semana: Mercadillo')
  assert.equal(endingPushes([dia], '2026-11-21')[0].pushes[0].title, '🖼️ Pasado mañana: Mercadillo')
  assert.deepEqual(endingPushes([dia], '2026-11-23'), [])
  // Una expo que aún no ha empezado no avisa de que se acaba.
  assert.deepEqual(endingPushes([item({ from: '2026-11-20', to: '2026-11-23' })], TODAY), [])
})

test('leer documentos: valores raros se quedan en algo seguro', () => {
  const i = parseBbsItem('z', { title: '', kind: 'nave', price: 7, addedBy: 'pepe', status: 'x', hearts: { nita: true, pepe: true, kitos: 'sí' }, ratings: { maria: 'again', nita: 'genial' }, from: 'mañana', to: '2026-11-30' })
  assert.equal(i.title, 'Sin título')
  assert.equal(i.kind, 'otro')
  assert.equal(i.price, 0)
  assert.equal(i.addedBy, 'nita')
  assert.equal(i.status, 'pending')
  assert.deepEqual(i.hearts, { nita: true })
  assert.deepEqual(i.ratings, { maria: 'again' })
  assert.equal(i.from, null)
  assert.equal(i.to, '2026-11-30')
})
