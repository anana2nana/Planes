import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultEat, defaultSlots, ingredientName, isPantry, portions, sourceOf, splitRecipeText, weekDays, weekIngredients, weekStart } from '../src/lib/menu.ts'

test('menú: semana de lunes a domingo, cena solo el finde, táper martes y miércoles', () => {
  const mon = weekStart(new Date('2026-10-08T12:00')) // jueves
  assert.deepEqual(weekDays(mon), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'])
  assert.deepEqual(weekDays(weekStart(new Date('2026-10-11T22:00'))), weekDays(mon)) // domingo: misma semana
  assert.deepEqual(defaultSlots('2026-10-08'), ['comida'])
  assert.deepEqual(defaultSlots('2026-10-10'), ['comida', 'cena'])
  assert.deepEqual(defaultEat('2026-10-06', 'comida'), { nita: 'taper', kitos: 'taper' })
  assert.deepEqual(defaultEat('2026-10-08', 'comida'), { nita: 'casa', kitos: 'casa' })
  assert.equal(portions({ nita: 'taper', kitos: 'fuera' }), 1)
})

test('ingredientes: sin cantidades ni unidades', () => {
  const cases: [string, string][] = [
    ['200 g de garbanzos cocidos', 'garbanzos cocidos'],
    ['2 dientes de ajo', 'ajo'],
    ['1 cebolla', 'cebolla'],
    ['Una cebolla morada', 'cebolla morada'],
    ['unas zanahorias', 'zanahorias'],
    ['1/2 limón', 'limón'],
    ['medio pimiento rojo', 'pimiento rojo'],
    ['- 1 cucharada de pimentón de la Vera', 'pimentón de la Vera'],
    ['Sal al gusto', 'sal'],
    ['Aceite de oliva virgen extra', 'aceite de oliva virgen extra'],
    ['400gr de pechuga de pollo (en tiras)', 'pechuga de pollo'],
    ['1 lata de tomate triturado', 'tomate triturado'],
    ['2 huevos', 'huevos'],
    ['1,5 l de caldo de verduras', 'caldo de verduras'],
    ['Uvas', 'uvas'],
  ]
  for (const [a, b] of cases) assert.equal(ingredientName(a), b, a)
  assert.ok(isPantry('sal') && isPantry('aceite de oliva virgen extra') && isPantry('pimienta negra'))
  assert.ok(!isPantry('salmón') && !isPantry('garbanzos cocidos'))
})

test('ingredientes de la semana: sin repetir y el plato repetido (táper) cuenta una vez', () => {
  const recipes = [
    { id: 'a', title: 'Lentejas', ingredients: ['300 g de lentejas', '1 cebolla', '2 zanahorias', 'Sal'] },
    { id: 'b', title: 'Pollo al curry', ingredients: ['500 g de pollo', 'Una cebolla', '1 cucharadita de curry'] },
  ]
  const meals = [
    { recipeId: 'a', title: 'Lentejas' },
    { recipeId: 'a', title: 'Lentejas' },
    { recipeId: 'b', title: 'Pollo al curry' },
    { recipeId: null, title: 'Cena fuera' },
  ]
  const w = weekIngredients(meals, recipes)
  assert.deepEqual(w.map((i) => i.name), ['lentejas', 'cebolla', 'zanahorias', 'sal', 'pollo', 'curry'])
  assert.deepEqual(w.find((i) => i.name === 'cebolla')!.dishes, ['Lentejas', 'Pollo al curry'])
  assert.equal(w.find((i) => i.name === 'sal')!.pantry, true)
})

test('pegar la descripción de un vídeo: ingredientes y pasos', () => {
  const text = `Las mejores lentejas de la abuela 😍
INGREDIENTES:
- 300 g de lentejas pardinas
- 1 cebolla
- 2 zanahorias
👉 1 chorizo
PREPARACIÓN
1. Sofreír la cebolla.
2. Añadir las lentejas y cubrir de agua.
#recetas #lentejas`
  const r = splitRecipeText(text)
  assert.deepEqual(r.ingredients, ['300 g de lentejas pardinas', '1 cebolla', '2 zanahorias', '1 chorizo'])
  assert.equal(r.steps, 'Las mejores lentejas de la abuela 😍\n1. Sofreír la cebolla.\n2. Añadir las lentejas y cubrir de agua.')
  const noHeaders = splitRecipeText('2 huevos\n200 ml de leche\nBatir todo y cuajar.')
  assert.deepEqual(noHeaders.ingredients, ['2 huevos', '200 ml de leche'])
  assert.equal(noHeaders.steps, 'Batir todo y cuajar.')
})

test('origen del enlace', () => {
  assert.equal(sourceOf('https://www.tiktok.com/@diegodoal/video/123')?.label, 'TikTok')
  assert.equal(sourceOf('https://www.instagram.com/reel/abc/')?.label, 'Instagram')
  assert.equal(sourceOf('https://www.cocinaconcarmen.com/receta')?.label, 'cocinaconcarmen.com')
  assert.equal(sourceOf(''), null)
})
