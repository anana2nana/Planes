import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bothLike, chosenOf, guessCategory, guessRoom, isFurnitureLink, plannedByCategory, ranked, roomSummary, stage, type FurnItem, type FurnOption } from '../src/lib/furniture.ts'

const opt = (id: string, price: number | null, nita: -1 | 0 | 1 = 0, kitos: -1 | 0 | 1 = 0): FurnOption => ({
  id,
  title: id,
  store: '',
  url: '',
  image: '',
  price,
  prevPrice: null,
  priceAt: null,
  votes: { nita, kitos },
})
const item = (o: Partial<FurnItem>): FurnItem => ({
  id: 'x',
  name: 'Sofá',
  room: 'salon',
  category: 'muebles',
  status: 'open',
  options: [],
  chosenId: null,
  boughtPrice: null,
  boughtAt: null,
  homeItemId: null,
  notes: '',
  ...o,
})

test('muebles: etapas, votos y elegido', () => {
  assert.equal(stage(item({})), 'need')
  assert.equal(stage(item({ options: [opt('a', 899)] })), 'choosing')
  assert.equal(stage(item({ options: [opt('a', 899)], chosenId: 'a' })), 'chosen')
  assert.equal(stage(item({ status: 'bought' })), 'bought')
  assert.equal(chosenOf(item({ options: [opt('a', 1)], chosenId: 'b' })), null)
  const os = [opt('caro', 1200, 1, 1), opt('feo', 300, -1, -1), opt('barato', 700, 1, 1), opt('nada', 500)]
  assert.deepEqual(
    ranked(os).map((o) => o.id),
    ['barato', 'caro', 'nada', 'feo'],
  )
  assert.equal(bothLike(os[0]), true)
  assert.equal(bothLike(opt('x', 1, 1, 0)), false)
})

test('muebles: por habitación y lo elegido para el presupuesto', () => {
  const items = [
    item({ id: '1', options: [opt('a', 899)], chosenId: 'a' }),
    item({ id: '2', name: 'Lámpara', status: 'bought', boughtPrice: 59.9, options: [opt('b', 65)], chosenId: 'b' }),
    item({ id: '3', name: 'Nevera', room: 'cocina', category: 'electro', options: [opt('c', 650), opt('d', 720)], chosenId: 'd' }),
    item({ id: '4', name: 'Cama', room: 'dormitorio' }),
  ]
  assert.deepEqual(roomSummary(items), [
    { room: 'salon', count: 2, bought: 1, spent: 59.9, planned: 899 },
    { room: 'dormitorio', count: 1, bought: 0, spent: 0, planned: 0 },
    { room: 'cocina', count: 1, bought: 0, spent: 0, planned: 720 },
  ])
  assert.deepEqual(plannedByCategory(items), { muebles: 899, electro: 720, reforma: 0 })
})

test('muebles: tiendas y adivinar habitación', () => {
  assert.ok(isFurnitureLink('https://www.sklum.com/es/comprar-sofas/123-sofa.html'))
  assert.ok(isFurnitureLink('https://kavehome.com/es/es/p/sofa-dyna'))
  assert.ok(isFurnitureLink('https://www.ikea.com/es/es/p/kivik-sofa-3-plazas-s59440505/'))
  assert.ok(!isFurnitureLink('https://www.amazon.es/dp/B0'))
  assert.equal(guessRoom('Sofá Dyna 3 plazas'), 'salon')
  assert.equal(guessRoom('Colchón viscoelástico'), 'dormitorio')
  assert.equal(guessRoom('Frigorífico combi Bosch'), 'cocina')
  assert.equal(guessRoom('Jarrón'), 'otros')
  assert.equal(guessCategory('Lavadora Samsung 9 kg'), 'electro')
  assert.equal(guessCategory('Pintura blanca 15 L'), 'reforma')
  assert.equal(guessCategory('Mesa de comedor'), 'muebles')
})
