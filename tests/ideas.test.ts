import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickRandom } from '../src/lib/ideas.ts'

test('ruleta: elige una, no repite la anterior y sin ideas no elige nada', () => {
  const ideas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  assert.equal(pickRandom([], null), null)
  assert.equal(pickRandom([{ id: 'a' }], 'a')?.id, 'a')
  for (const r of [0, 0.5, 0.99]) assert.notEqual(pickRandom(ideas, 'b', () => r)?.id, 'b')
  assert.equal(pickRandom(ideas, null, () => 0.99)?.id, 'c')
})
