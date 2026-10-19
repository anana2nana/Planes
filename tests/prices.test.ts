import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePrice, searchCatalog, shoppingTotal, thumb, unpackRows, type Product } from '../src/lib/prices.ts'

const p = (name: string, price = 1): Product => ({ store: 'mercadona', id: name, name, pack: '', price, ref: '', image: '' })

test('compra: buscar en el catálogo', () => {
  const list = [p('Bebida de avena con leche'), p('Leche semidesnatada Hacendado'), p('Leche entera Hacendado'), p('Huevos frescos L'), p('Café con leche soluble'), p('Plátano de Canarias')]
  assert.deepEqual(searchCatalog(list, 'leche').map((x) => x.name), ['Leche entera Hacendado', 'Leche semidesnatada Hacendado', 'Café con leche soluble', 'Bebida de avena con leche'])
  assert.deepEqual(searchCatalog(list, 'LECHE semi').map((x) => x.name), ['Leche semidesnatada Hacendado'])
  assert.deepEqual(searchCatalog(list, 'huevo').map((x) => x.name), ['Huevos frescos L'])
  assert.deepEqual(searchCatalog(list, 'platanos').map((x) => x.name), ['Plátano de Canarias'])
  assert.deepEqual(searchCatalog(list, ' '), [])
  assert.deepEqual(unpackRows('[["1","Leche","Brick 1 l",0.94,"0,94 €/L","x.jpg"]]', 'mercadona'), [{ store: 'mercadona', id: '1', name: 'Leche', pack: 'Brick 1 l', price: 0.94, ref: '0,94 €/L', image: 'x.jpg' }])
  assert.deepEqual(unpackRows('roto', 'mercadona'), [])
})

test('compra: total y precios', () => {
  const t = shoppingTotal([
    { price: 0.94, qty: 6, done: false },
    { price: 3.49, done: false },
    { price: null, done: false },
    { price: 10, done: true },
  ])
  assert.deepEqual(t, { total: 9.13, priced: 2, count: 3 })
  assert.equal(parsePrice('1,25'), 1.25)
  assert.equal(parsePrice('2.5 €'), 2.5)
  assert.equal(parsePrice(''), null)
  assert.equal(parsePrice('abc'), null)
  assert.equal(thumb('https://prod-mercadona.imgix.net/images/a.jpg?fit=crop&h=300&w=300'), 'https://prod-mercadona.imgix.net/images/a.jpg?fit=crop&h=96&w=96')
})

import { compareChosen, refValue, similarSize } from '../src/lib/prices.ts'

test('compra: comparar lo elegido a mano en Mercadona y Ahorramás', () => {
  assert.deepEqual(refValue({ ref: '0,94 €/L' }), { v: 0.94, unit: 'l' })
  assert.deepEqual(refValue({ ref: '1,95 €/kg' }), { v: 1.95, unit: 'kg' })
  assert.equal(refValue({ ref: '' }), null)
  const m = (name: string, price: number, ref: string, store: 'mercadona' | 'ahorramas' = 'ahorramas'): Product => ({ store, id: name, name, pack: '', price, ref, image: '' })
  const hacendado = m('Leche semidesnatada Hacendado', 0.94, '0,94 €/L', 'mercadona')
  assert.equal(similarSize(hacendado, m('Leche semidesnatada Alipende 1L', 0.83, '0,83 €/L')), true)
  assert.equal(similarSize(hacendado, m('Leche semidesnatada Alipende 6x1L', 4.8, '0,80 €/L')), false)
  assert.equal(similarSize(hacendado, m('Pan', 1, '')), true)
  const t = compareChosen([
    { qty: 6, done: false, options: { mercadona: hacendado, ahorramas: m('Leche Alipende 1L', 0.83, '0,83 €/L') } },
    { qty: 1, done: false, options: { mercadona: m('Pan', 1.2, '', 'mercadona'), ahorramas: m('Pan', 1.1, '') } },
    { qty: 1, done: false, options: { mercadona: m('Pienso', 10, '', 'mercadona') } },
    { qty: 1, done: false, options: {} },
    { qty: 1, done: true, options: { mercadona: m('X', 50, '', 'mercadona'), ahorramas: m('X', 1, '') } },
  ])
  assert.deepEqual(t, { compared: 2, mercadona: 6.84, ahorramas: 6.08, mixed: 6.08, cheaper: 'ahorramas', missing: { mercadona: 1, ahorramas: 2 } })
})
