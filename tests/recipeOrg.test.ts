import { test } from 'node:test'
import assert from 'node:assert/strict'
import { authorOf, cookedCounts, forgotten, guessCategory, guessMinutes, guessTaper, matchPantry, sortRecipes } from '../src/lib/recipeOrg.ts'

test('recetario: categoría adivinada', () => {
  const g = (title: string, ingredients: string[] = []) => guessCategory({ title, ingredients })
  assert.equal(g('Lentejas con chorizo'), 'legumbres')
  assert.equal(g('Espaguetis carbonara'), 'pasta')
  assert.equal(g('Tarta de queso'), 'postre')
  assert.equal(g('Merluza en salsa verde'), 'pescado')
  assert.equal(g('Crema de calabaza'), 'sopa')
  assert.equal(g('Pollo al curry'), 'carne')
  assert.equal(g('Ensalada César'), 'ensalada')
  assert.equal(g('Cena rápida', ['300 g de salmón', 'limón']), 'pescado')
  assert.equal(g('Cosa rara'), null)
})

test('recetario: tiempo, táper y de quién', () => {
  assert.equal(guessMinutes({ tags: ['4 raciones', '45 min'] }), 45)
  assert.equal(guessMinutes({ tags: ['1 h 30'] }), 90)
  assert.equal(guessMinutes({ tags: ['2 h'] }), 120)
  assert.equal(guessMinutes({ phases: [{ steps: [{ timer: { seconds: 600 } }, { timer: null }, { timer: { seconds: 900 } }] }] }), 25)
  assert.equal(guessMinutes({ tags: [] }), null)
  assert.equal(guessTaper('legumbres', 'Lentejas'), true)
  assert.equal(guessTaper('postre', 'Tarta'), false)
  assert.equal(guessTaper('carne', 'Albóndigas en salsa'), true)
  assert.equal(authorOf({ url: 'https://www.tiktok.com/@diegodoal/video/1' }), 'Diego Doal')
  assert.equal(authorOf({ credit: 'Receta de Cocina con Carmen' }), 'Cocina con Carmen')
  assert.equal(authorOf({ url: 'https://www.instagram.com/p/x' }), 'De redes')
  assert.equal(authorOf({}), 'Vuestras')
})

test('recetario: con lo que tengo, las más hechas, olvidadas y orden', () => {
  const r = (id: string, title: string, ingredients: string[], o: object = {}) => ({
    id,
    title,
    ingredients,
    createdAt: 0,
    rating: { nita: null, kitos: null },
    lastPlanned: null as string | null,
    ...o,
  })
  const list = [
    r('a', 'Pollo con calabacín', ['2 pechugas de pollo', '1 calabacín', 'ajo']),
    r('b', 'Crema de calabacín', ['3 calabacines', 'patata', 'cebolla', 'quesitos']),
    r('c', 'Lentejas', ['lentejas', 'chorizo']),
  ]
  assert.deepEqual(
    matchPantry(list, 'pollo, calabacines').map((x) => [x.recipe.id, x.hits.length]),
    [
      ['a', 2],
      ['b', 1],
    ],
  )
  assert.deepEqual(matchPantry(list, ''), [])
  const cooked = cookedCounts(
    [
      { recipeId: 'b', date: '2026-11-01' },
      { recipeId: 'b', date: '2026-11-08' },
      { recipeId: 'a', date: '2026-11-02' },
      { recipeId: 'c', date: '2026-12-01' },
      { recipeId: null, date: '2026-11-01' },
    ],
    '2026-11-15',
  )
  assert.deepEqual(
    [...cooked.entries()],
    [
      ['b', 2],
      ['a', 1],
    ],
  )
  assert.deepEqual(
    sortRecipes(list, 'cooked', cooked).map((x) => x.id),
    ['b', 'a', 'c'],
  )
  assert.deepEqual(
    sortRecipes(list, 'name', cooked).map((x) => x.id),
    ['b', 'c', 'a'],
  )
  const rated = [r('x', 'X', [], { rating: { nita: 3, kitos: null } }), r('y', 'Y', [], { rating: { nita: 5, kitos: 4.5 } }), r('z', 'Z', [])]
  assert.deepEqual(
    sortRecipes(rated, 'rating', cooked).map((x) => x.id),
    ['y', 'x', 'z'],
  )
  const old = [r('1', 'A', [], { lastPlanned: '2026-06-01' }), r('2', 'B', [], { lastPlanned: '2026-11-01' }), r('3', 'C', [], { lastPlanned: '2026-03-01' })]
  assert.deepEqual(
    forgotten(old, '2026-11-15').map((x) => x.id),
    ['3', '1'],
  )
})
