import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clock, flatIngredients, parseServings, richFromSimple, scaleQty, secondsIn, shoppingName, splitQty } from '../src/lib/recipe.ts'

test('receta: separar cantidad y nombre', () => {
  assert.deepEqual(splitQty('300 g de lentejas'), { q: '300 g', name: 'lentejas' })
  assert.deepEqual(splitQty('2 a 3 g pimienta negra'), { q: '2 a 3 g', name: 'pimienta negra' })
  assert.deepEqual(splitQty('1 pizca sal'), { q: '1 pizca', name: 'sal' })
  assert.deepEqual(splitQty('3 huevos'), { q: '3', name: 'huevos' })
  assert.deepEqual(splitQty('Sal'), { q: '', name: 'Sal' })
  assert.deepEqual(splitQty('al gusto parmesano'), { q: 'al gusto', name: 'parmesano' })
  assert.deepEqual(splitQty('1,5 l de caldo'), { q: '1,5 l', name: 'caldo' })
})

test('receta: escalar raciones', () => {
  assert.equal(scaleQty('300 g', 2 / 3), '200 g')
  assert.equal(scaleQty('3', 2 / 3), '2')
  assert.equal(scaleQty('2 a 3 g', 2), '4 a 6 g')
  assert.equal(scaleQty('1 pizca', 3), '1 pizca')
  assert.equal(scaleQty('al gusto', 2), 'al gusto')
  assert.equal(scaleQty('350 ml', 0.5), '175 ml')
  assert.equal(scaleQty('1 nuez', 2), '1 nuez')
  assert.equal(scaleQty('½ limón', 2), '1 limón')
  assert.equal(scaleQty('4', 0.75), '3')
  assert.equal(scaleQty('1', 0.5), '0,5')
})

test('receta: nombre para la compra', () => {
  assert.equal(shoppingName('huevos M o L, a temperatura ambiente (unos 150 g sin cáscara)'), 'huevos M o L')
  assert.equal(shoppingName('harina o maicena para espolvorear'), 'harina o maicena')
  assert.equal(shoppingName('caldo de ternera (o pollo, o cocido)'), 'caldo de ternera')
  assert.equal(shoppingName('Parmesano rallado, para servir'), 'parmesano rallado')
  assert.equal(shoppingName('guanciale'), 'guanciale')
})

test('receta: raciones, tiempos y conversión desde texto', () => {
  assert.equal(parseServings(['Unas 2 h', '3 personas, raciones contundentes']), 3)
  assert.equal(parseServings(['rápida']), null)
  assert.equal(secondsIn('30 min'), 1800)
  assert.equal(secondsIn('12 a 15 min'), 720)
  assert.equal(secondsIn('2 h'), 7200)
  assert.equal(secondsIn('60 a 120 s'), 60)
  assert.equal(secondsIn('posición 0'), null)
  assert.equal(clock(1800), '30:00')
  assert.equal(clock(7200), '2:00:00')
  const r = richFromSimple({ title: 'Tortilla', ingredients: ['4 huevos', '2 patatas'], steps: '1. Freír\n2. Cuajar' })
  assert.deepEqual(r.groups[0].items, [{ q: '4', name: 'huevos' }, { q: '2', name: 'patatas' }])
  assert.deepEqual(r.phases[0].steps.map((s) => s.text), ['Freír', 'Cuajar'])
  assert.deepEqual(flatIngredients(r), ['4 huevos', '2 patatas'])
})
