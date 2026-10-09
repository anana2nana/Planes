import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avgRating, disagreement, isMediaLink, mediaFromShare, roulettePool, sortMedia, yearStats, type Media } from '../src/lib/media.ts'
import { parseOpenLibrary, parseWikipedia } from '../src/lib/covers.ts'

const m = (o: Partial<Media>): Media => ({
  id: o.title ?? 'x',
  kind: 'peli',
  title: 'x',
  subtitle: '',
  cover: null,
  status: 'done',
  where: '',
  recommendedBy: '',
  progress: '',
  rating: { nita: null, kitos: null },
  comment: '',
  finishedAt: '2026-05-01',
  createdAt: 0,
  ...o,
})

test('hemeroteca: notas', () => {
  assert.equal(avgRating(m({ rating: { nita: 5, kitos: 3 } })), 4)
  assert.equal(avgRating(m({ rating: { nita: 4, kitos: null } })), 4)
  assert.equal(avgRating(m({})), null)
  assert.equal(disagreement(m({ rating: { nita: 5, kitos: 2 } })), 3)
  assert.equal(disagreement(m({ rating: { nita: 5, kitos: null } })), null)
})

test('hemeroteca: vuestro año', () => {
  const items = [
    m({ title: 'A', rating: { nita: 5, kitos: 5 } }),
    m({ title: 'B', kind: 'serie', rating: { nita: 5, kitos: 1 } }),
    m({ title: 'C', kind: 'libro', rating: { nita: 3, kitos: null } }),
    m({ title: 'D', finishedAt: '2025-12-30', rating: { nita: 5, kitos: 5 } }),
    m({ title: 'E', status: 'want', finishedAt: null }),
  ]
  const s = yearStats(items, 2026)
  assert.equal(s.total, 3)
  assert.deepEqual(s.byKind, [
    { kind: 'peli', n: 1 },
    { kind: 'serie', n: 1 },
    { kind: 'libro', n: 1 },
  ])
  assert.equal(s.best?.title, 'A')
  assert.equal(s.argued?.title, 'B')
  assert.equal(yearStats(items, 2024).total, 0)
  assert.deepEqual(
    roulettePool(items, 'all').map((x) => x.title),
    ['E'],
  )
  assert.deepEqual(
    sortMedia(items, 'done').map((x) => x.title),
    ['A', 'B', 'C', 'D'],
  )
})

test('hemeroteca: compartir desde otras apps', () => {
  assert.deepEqual(mediaFromShare('Interstellar (2014) - FilmAffinity', 'https://www.filmaffinity.com/es/film563439.html'), { title: 'Interstellar', subtitle: '2014', kind: 'peli' })
  assert.deepEqual(mediaFromShare('Breaking Bad (TV Series 2008–2013) - IMDb', 'https://www.imdb.com/title/tt0903747/'), { title: 'Breaking Bad', subtitle: '', kind: 'serie' })
  assert.deepEqual(mediaFromShare('Sapiens by Yuval Noah Harari', 'https://www.goodreads.com/book/show/1'), { title: 'Sapiens', subtitle: 'Yuval Noah Harari', kind: 'libro' })
  assert.equal(mediaFromShare('Mira El juego del calamar en Netflix\nhttps://www.netflix.com/title/81040344', 'https://www.netflix.com/title/81040344').title, 'El juego del calamar en Netflix')
  assert.ok(isMediaLink('https://www.filmaffinity.com/es/film1.html'))
  assert.ok(!isMediaLink('https://www.amazon.es/x'))
})

test('portadas: respuestas de Open Library y Wikipedia', () => {
  assert.deepEqual(parseOpenLibrary({ docs: [{ title: 'Sapiens', author_name: ['Harari'], cover_i: 42, first_publish_year: 2011 }, { title: 'Sin portada' }] }), [
    { title: 'Sapiens', subtitle: 'Harari · 2011', image: 'https://covers.openlibrary.org/b/id/42-M.jpg' },
  ])
  const wiki = {
    query: {
      pages: {
        '2': { title: 'Interstellar (soundtrack)', index: 2, description: 'album by Hans Zimmer', thumbnail: { source: 'b.jpg' } },
        '1': { title: 'Interstellar (film)', index: 1, description: '2014 film by Christopher Nolan', thumbnail: { source: 'a.jpg' } },
        '3': { title: 'Sin imagen', index: 3, description: 'film' },
      },
    },
  }
  assert.deepEqual(parseWikipedia(wiki, 'peli'), [{ title: 'Interstellar', subtitle: '2014 film by Christopher Nolan', image: 'a.jpg' }])
  assert.deepEqual(parseWikipedia({}, 'serie'), [])
})
