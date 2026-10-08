import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseShared } from '../src/lib/share.ts'

test('compartir desde Google Maps: nombre, dirección y enlace', () => {
  const s = parseShared({ title: '', text: 'Casa Lucio\nCalle de la Cava Baja, 35, 28005 Madrid\nhttps://maps.app.goo.gl/AbC123', url: '' })
  assert.equal(s.name, 'Casa Lucio')
  assert.equal(s.detail, 'Calle de la Cava Baja, 35, 28005 Madrid')
  assert.equal(s.link, 'https://maps.app.goo.gl/AbC123')
  assert.equal(s.isMaps, true)
  assert.equal(s.suggested, 'idea')
  // Otra forma: título aparte y solo el enlace en el texto.
  const t = parseShared({ title: 'Museo del Prado', text: 'https://maps.app.goo.gl/xyz', url: null })
  assert.equal(t.name, 'Museo del Prado')
  assert.equal(t.isMaps, true)
})

test('compartir una tienda → regalo; una lista → compra; un texto largo → nota', () => {
  const g = parseShared({ title: 'Zapatillas Nike Air', text: 'Mira esto https://www.nike.com/es/t/air-123', url: '' })
  assert.equal(g.suggested, 'gift')
  assert.equal(g.name, 'Zapatillas Nike Air')
  assert.equal(g.link, 'https://www.nike.com/es/t/air-123')
  const c = parseShared({ text: '- leche\n- 2 huevos\n• pan de molde\n3) tomates' })
  assert.equal(c.suggested, 'shopping')
  assert.deepEqual(c.lines, ['leche', '2 huevos', 'pan de molde', 'tomates'])
  const n = parseShared({ text: 'Lo que dijo el administrador: la derrama de la comunidad se paga en dos plazos, en enero y en junio' })
  assert.equal(n.suggested, 'note')
  assert.equal(parseShared({ url: 'https://www.instagram.com/p/abc/' }).suggested, 'idea')
})

test('compartir un vídeo de TikTok o algo con "receta" → receta', () => {
  assert.equal(parseShared({ text: 'https://vm.tiktok.com/ZGabc123/' }).suggested, 'recipe')
  assert.equal(parseShared({ title: 'Receta de croquetas', text: 'https://www.instagram.com/reel/xyz/' }).suggested, 'recipe')
  assert.equal(parseShared({ text: 'https://www.instagram.com/reel/xyz/' }).suggested, 'idea')
})
