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
