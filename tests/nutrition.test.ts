import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dishNutrition, estimateRecipe, findFood, gramsOf, guessFromTitle, weekBalance } from '../src/lib/nutrition.ts'
import { splitQty } from '../src/lib/recipe.ts'

const grams = (line: string) => {
  const it = splitQty(line)
  return gramsOf(it, findFood(it.name)!).grams
}

test('nutrición: reconoce ingredientes (el nombre más largo gana)', () => {
  assert.equal(findFood('pechuga de pollo')?.kcal, 110)
  assert.equal(findFood('Pollo de corral troceado')?.kcal, 190)
  assert.equal(findFood('garbanzos cocidos (escurridos)')?.kcal, 120)
  assert.equal(findFood('garbanzos')?.cat, 'leg')
  assert.equal(findFood('Tomates maduros')?.cat, 'veg')
  assert.equal(findFood('AOVE')?.cat, 'fat')
  assert.equal(findFood('salsa de soja')?.cat, 'misc')
  assert.equal(findFood('sal')?.kcal, 0)
  assert.equal(findFood('mantequilla o aceite')?.kcal, 740)
  assert.equal(findFood('panceta')?.cat, 'proc')
  assert.equal(findFood('xilofón'), null)
})

test('nutrición: cantidades a gramos', () => {
  assert.equal(grams('300 g de lentejas'), 300)
  assert.equal(grams('1 kg patatas'), 1000)
  assert.equal(grams('2 huevos'), 110)
  assert.equal(grams('2 a 3 g pimienta'), 2.5)
  assert.equal(Math.round(grams('2 cdas aceite de oliva')), 28)
  assert.equal(grams('500 ml leche'), 500)
  assert.equal(grams('½ cebolla'), 75)
  assert.equal(grams('1 nuez mantequilla'), 10)
  assert.equal(grams('1 bote de garbanzos cocidos'), 400)
  assert.equal(grams('Una cebolla'), 150)
  assert.equal(gramsOf({ q: 'al gusto', name: 'parmesano' }, findFood('parmesano')!).grams, 0)
})

test('nutrición: platos de siempre', () => {
  const carbonara = estimateRecipe({
    title: 'Carbonara',
    servings: 2,
    ingredients: ['200 g espaguetis', '100 g guanciale', '2 yemas', '1 huevo', '50 g pecorino', 'Pimienta negra'],
  })
  assert.ok(carbonara.kcal > 650 && carbonara.kcal < 900, String(carbonara.kcal))
  assert.equal(carbonara.color, 'red')
  assert.ok(carbonara.confident)

  const ensalada = estimateRecipe({ title: 'Ensalada de pollo', servings: 2, ingredients: ['1 pechuga de pollo', 'Lechuga', '2 tomates', '1 cda AOVE', 'Sal'] })
  assert.ok(ensalada.kcal < 350, String(ensalada.kcal))
  assert.equal(ensalada.color, 'green')

  const crema = estimateRecipe({ title: 'Crema de calabacín', servings: 4, ingredients: ['3 calabacines', '1 puerro', '1 patata', '1 l caldo de verduras', '1 quesito', '2 cdas aceite'] })
  assert.equal(crema.color, 'green')
  assert.deepEqual(crema.unknown, ['quesito'])

  // Lo frito suma aceite aunque no esté en la lista.
  const plain = estimateRecipe({ servings: 2, ingredients: ['400 g merluza'] })
  const fried = estimateRecipe({ title: 'Merluza rebozada', servings: 2, ingredients: ['400 g merluza'] })
  assert.ok(fried.kcal > plain.kcal + 80)

  // Recetas ricas (grupos) y sin ingredientes.
  const rich = estimateRecipe({ servings: 2, groups: [{ items: [{ q: '200 g', name: 'arroz' }] }] })
  assert.equal(rich.kcal, 350)
  assert.equal(estimateRecipe({ servings: 2, ingredients: [] }).color, null)
})

test('nutrición: lo corregido a mano manda', () => {
  const r = { servings: 2, ingredients: ['200 g espaguetis', '100 g guanciale', '50 g pecorino'] }
  assert.equal(dishNutrition({ color: null }, r).color, 'red')
  assert.equal(dishNutrition({ color: null }, { ...r, nutrition: { color: 'yellow', kcal: 700 } }).color, 'yellow')
  assert.equal(dishNutrition({ color: null }, { ...r, nutrition: { color: null, kcal: 700 } }).kcal, 700)
  assert.equal(dishNutrition({ color: 'green' }, r).color, 'green')
  assert.deepEqual(dishNutrition({ color: 'green' }, null), { color: 'green', kcal: null, manual: true })
})

test('nutrición: resumen de la semana', () => {
  assert.equal(weekBalance(['green', null]).verdict, null)
  assert.equal(weekBalance(['red', 'red', 'red', 'green', 'green', 'green']).verdict, 'heavy')
  assert.equal(weekBalance(['green', 'green', 'yellow', 'red']).verdict, 'light')
  assert.equal(weekBalance(['green', 'yellow', 'yellow', 'red', 'yellow']).verdict, 'balanced')
  const b = weekBalance(['green', 'yellow', null])
  assert.equal(b.unknown, 1)
})

test('nutrición: pista por el nombre del plato', () => {
  assert.equal(guessFromTitle('Pizza casera'), 'red')
  assert.equal(guessFromTitle('Ensalada César'), 'green')
  assert.equal(guessFromTitle('Merluza a la plancha'), 'green')
  assert.equal(guessFromTitle('Arroz a la cubana'), null)
  assert.equal(dishNutrition({ color: null, title: 'Croquetas de la abuela' }, null).color, 'red')
})
