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

import { ideaToModule } from '../src/lib/ideas.ts'

test('algún día: las ideas antiguas van a su módulo', () => {
  const base = { id: 'x1', place: null, notes: 'nos lo dijo Ana', addedBy: 'nita' as const }
  const s = ideaToModule({ ...base, title: 'Japonés de Lavapiés', category: 'comer' })!
  assert.equal(s.collection, 'spots')
  assert.equal(s.id, 'idea-x1')
  assert.equal(s.data.name, 'Japonés de Lavapiés')
  assert.equal(s.data.status, 'want')
  assert.equal(s.data.createdBy, 'nita')
  assert.equal(ideaToModule({ ...base, title: 'Ver The Bear (serie)', category: 'peli' })!.data.kind, 'serie')
  assert.equal(ideaToModule({ ...base, title: 'Albarracín', category: 'escapada' })!.collection, 'trips')
  assert.equal(ideaToModule({ ...base, title: 'Escape room', category: 'plan' }), null)
})
