// Portadas para la hemeroteca, sin claves ni cuentas: libros en Open Library y pelis/series en Wikipedia.
// Si no hay conexión o no encuentra nada, se puede hacer una foto. El análisis de las respuestas es puro y testeado.

import type { MediaKind } from './media.ts'

export interface CoverHit {
  title: string
  subtitle: string
  image: string
}

/** Respuesta de openlibrary.org/search.json. */
export function parseOpenLibrary(json: unknown): CoverHit[] {
  const docs = (json as { docs?: { title?: string; author_name?: string[]; cover_i?: number; first_publish_year?: number }[] })?.docs ?? []
  return docs
    .filter((d) => d.cover_i && d.title)
    .map((d) => ({
      title: d.title!,
      subtitle: [d.author_name?.[0], d.first_publish_year].filter(Boolean).join(' · '),
      image: `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`,
    }))
}

/** Respuesta de la API de Wikipedia (generator=search + pageimages + description). */
export function parseWikipedia(json: unknown, kind: MediaKind): CoverHit[] {
  const pages = Object.values((json as { query?: { pages?: Record<string, { title: string; index?: number; description?: string; thumbnail?: { source: string } }> } })?.query?.pages ?? {})
  const want = kind === 'serie' ? /series|serie|sitcom|miniserie|programa/i : kind === 'docu' ? /document/i : kind === 'peli' ? /film|película|pel·lícula|movie/i : /./
  return pages
    .filter((p) => p.thumbnail?.source && (!p.description || want.test(p.description)))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => ({
      title: p.title.replace(/\s*\((película|film|serie de televisión|TV series|serie|\d{4} film|miniserie)[^)]*\)$/i, ''),
      subtitle: (p.description ?? '').replace(/^\w/, (c) => c.toUpperCase()),
      image: p.thumbnail!.source,
    }))
}

const HINT: Partial<Record<MediaKind, string>> = { peli: 'film', serie: 'TV series', docu: 'documentary' }

async function getJson(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

function wikiUrl(lang: 'es' | 'en', q: string) {
  const p = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: q, gsrlimit: '6', prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: '400', pilicense: 'any' })
  return `https://${lang}.wikipedia.org/w/api.php?${p}`
}

/** Busca portadas para un título. Nunca falla: si algo va mal, devuelve lo que haya (o nada). */
export async function searchCovers(kind: MediaKind, query: string, signal?: AbortSignal): Promise<CoverHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const tries: Promise<CoverHit[]>[] =
    kind === 'libro'
      ? [getJson(`https://openlibrary.org/search.json?${new URLSearchParams({ q, limit: '8', fields: 'title,author_name,cover_i,first_publish_year' })}`, signal).then(parseOpenLibrary)]
      : [
          // En inglés hay carteles (en la española casi nunca); en español, los títulos traducidos.
          getJson(wikiUrl('en', HINT[kind] ? `${q} ${HINT[kind]}` : q), signal).then((j) => parseWikipedia(j, kind)),
          getJson(wikiUrl('es', q), signal).then((j) => parseWikipedia(j, kind)),
        ]
  const results = await Promise.allSettled(tries)
  const seen = new Set<string>()
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((h) => !seen.has(h.image) && seen.add(h.image))
    .slice(0, 8)
}
