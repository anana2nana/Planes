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

import { bestMatch, compareQuery, compareTotals, refValue, sortByUnitPrice } from '../src/lib/prices.ts'

test('compra: comparar Mercadona y Ahorramás', () => {
  assert.deepEqual(refValue({ ref: '0,94 €/L' }), { v: 0.94, unit: 'l' })
  assert.deepEqual(refValue({ ref: '1,95 €/kg' }), { v: 1.95, unit: 'kg' })
  assert.equal(refValue({ ref: '' }), null)
  assert.equal(compareQuery('Leche semidesnatada Alipende 1L'), 'leche semidesnatada')
  assert.equal(compareQuery('Leche semidesnatada Hacendado'), 'leche semidesnatada')
  assert.equal(compareQuery('Pack 6 x 1 l Leche entera Hacendado'), 'leche entera')
  assert.equal(compareQuery('Huevos'), 'huevos')
  const m = (name: string, price: number, ref: string, store: 'mercadona' | 'ahorramas' = 'ahorramas'): Product => ({ store, id: name, name, pack: '', price, ref, image: '' })
  const cands = [m('Leche semidesnatada Alipende 1L', 0.83, '0,83 €/L'), m('Leche semidesnatada Pascual 1L', 1.35, '1,35 €/L'), m('Leche semidesnatada Alipende 6x1L', 4.8, '0,80 €/L'), m('Batido de leche', 0.5, '2,00 €/kg')]
  const like = m('Leche semidesnatada Hacendado', 0.94, '0,94 €/L', 'mercadona')
  assert.equal(bestMatch(cands, like)?.name, 'Leche semidesnatada Alipende 1L')
  assert.equal(bestMatch(cands)?.name, 'Leche semidesnatada Alipende 1L')
  assert.equal(bestMatch([cands[1], cands[0]])?.name, 'Leche semidesnatada Alipende 1L')
  assert.equal(bestMatch([], like), null)
  assert.deepEqual(sortByUnitPrice([cands[1], cands[0], like]).map((p) => p.price), [0.83, 0.94, 1.35])
  const t = compareTotals([
    { key: 'leche', qty: 6, mercadona: like, ahorramas: cands[0] },
    { key: 'pan', qty: 1, mercadona: m('Pan', 1.2, '', 'mercadona'), ahorramas: m('Pan', 1.1, '') },
    { key: 'gata', qty: 1, mercadona: m('Pienso', 10, '', 'mercadona'), ahorramas: null },
  ])
  assert.deepEqual(t, { compared: 2, mercadona: 6.84, ahorramas: 6.08, mixed: 6.08, cheaper: 'ahorramas' })
})
