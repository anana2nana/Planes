// Hemeroteca: pelis, series, libros… que queréis ver o habéis visto juntos. Puro y testeado (tests/media.test.ts).

import type { PersonId } from './types'

export type MediaKind = 'peli' | 'serie' | 'libro' | 'docu' | 'teatro' | 'concierto' | 'otro'
export type MediaStatus = 'want' | 'doing' | 'done'

export const MEDIA_KINDS: Record<MediaKind, { label: string; plural: string; emoji: string; doing: string; done: string }> = {
  peli: { label: 'Peli', plural: 'Pelis', emoji: '🎬', doing: 'Viendo', done: 'Vista' },
  serie: { label: 'Serie', plural: 'Series', emoji: '📺', doing: 'Viendo', done: 'Vista' },
  libro: { label: 'Libro', plural: 'Libros', emoji: '📚', doing: 'Leyendo', done: 'Leído' },
  docu: { label: 'Documental', plural: 'Documentales', emoji: '🎥', doing: 'Viendo', done: 'Visto' },
  teatro: { label: 'Teatro', plural: 'Teatro', emoji: '🎭', doing: 'Con entradas', done: 'Visto' },
  concierto: { label: 'Concierto', plural: 'Conciertos', emoji: '🎤', doing: 'Con entradas', done: 'Visto' },
  otro: { label: 'Otro', plural: 'Otros', emoji: '✨', doing: 'En marcha', done: 'Hecho' },
}
export const MEDIA_ORDER = Object.keys(MEDIA_KINDS) as MediaKind[]
export const STATUS: Record<MediaStatus, { label: string }> = { want: { label: 'Pendientes' }, doing: { label: 'En marcha' }, done: { label: 'Vistas' } }

/** Dónde se ve (sugerencias; se puede escribir otro). */
export const WHERE = ['Netflix', 'HBO Max', 'Prime Video', 'Disney+', 'Movistar+', 'Filmin', 'Apple TV+', 'SkyShowtime', 'RTVE Play', 'Atresplayer', 'Cine', 'Kindle', 'Papel', 'Audible', 'Biblioteca']

export interface Media {
  id: string
  kind: MediaKind
  title: string
  /** Año, autor/director o lo que ayude a reconocerla. */
  subtitle: string
  cover: string | null
  status: MediaStatus
  where: string
  recommendedBy: string
  /** "T2 E5", "pág. 120"… */
  progress: string
  rating: Record<PersonId, number | null>
  comment: string
  /** yyyy-mm-dd en que se terminó (o se fue). */
  finishedAt: string | null
  createdAt: number
}

/** Media de las notas que haya (1 a 5), o null. */
export function avgRating(m: Pick<Media, 'rating'>): number | null {
  const r = [m.rating.nita, m.rating.kitos].filter((x): x is number => typeof x === 'number' && x > 0)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}

/** Diferencia entre las notas de los dos (solo si los dos la han puntuado). */
export function disagreement(m: Pick<Media, 'rating'>): number | null {
  const { nita, kitos } = m.rating
  return nita && kitos ? Math.abs(nita - kitos) : null
}

export interface YearStats {
  total: number
  byKind: { kind: MediaKind; n: number }[]
  best: Media | null
  /** En la que menos coincidís. */
  argued: Media | null
}

/** "Vuestro año": lo terminado en ese año. */
export function yearStats(items: Media[], year: number): YearStats {
  const done = items.filter((m) => m.status === 'done' && m.finishedAt?.startsWith(String(year)))
  const byKind = MEDIA_ORDER.map((kind) => ({ kind, n: done.filter((m) => m.kind === kind).length })).filter((x) => x.n > 0)
  const rated = done.filter((m) => avgRating(m) !== null).sort((a, b) => avgRating(b)! - avgRating(a)! || (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
  const argued = done
    .filter((m) => (disagreement(m) ?? 0) >= 2)
    .sort((a, b) => disagreement(b)! - disagreement(a)!)[0]
  return { total: done.length, byKind, best: rated[0] ?? null, argued: argued ?? null }
}

/** Para la ruleta: pendientes de un tipo (o de cualquiera). */
export const roulettePool = (items: Media[], kind: MediaKind | 'all') => items.filter((m) => m.status === 'want' && (kind === 'all' || m.kind === kind))

/** Orden de cada lista: lo que está en marcha y lo pendiente por fecha de alta; lo visto, lo último primero. */
export function sortMedia(items: Media[], status: MediaStatus): Media[] {
  const list = items.filter((m) => m.status === status)
  return status === 'done' ? list.sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '') || b.createdAt - a.createdAt) : list.sort((a, b) => b.createdAt - a.createdAt)
}

// ─── Compartir desde Filmaffinity, IMDb, Goodreads… ─────────────────────────

const SOURCES: { re: RegExp; kind: MediaKind | null }[] = [
  { re: /filmaffinity\./i, kind: null },
  { re: /imdb\.com/i, kind: null },
  { re: /letterboxd\.com/i, kind: 'peli' },
  { re: /justwatch\.com/i, kind: null },
  { re: /themoviedb\.org\/movie/i, kind: 'peli' },
  { re: /themoviedb\.org\/tv/i, kind: 'serie' },
  { re: /goodreads\.com/i, kind: 'libro' },
  { re: /casadellibro\.com/i, kind: 'libro' },
  { re: /todostuslibros\.com/i, kind: 'libro' },
  { re: /books\.google\./i, kind: 'libro' },
  { re: /(netflix|hbomax|max)\.com|primevideo\.com|disneyplus\.com|filmin\.es|movistarplus\.es|tv\.apple\.com/i, kind: null },
]

/** ¿Es un enlace de pelis, series o libros? */
export const isMediaLink = (url: string) => SOURCES.some((s) => s.re.test(url))

/**
 * Del título que mandan al compartir saca el nombre limpio y, si se puede, el tipo y el año.
 * "Interstellar (2014) - FilmAffinity" → { title: "Interstellar", subtitle: "2014", kind: "peli" }.
 */
export function mediaFromShare(text: string, url: string): { title: string; subtitle: string; kind: MediaKind } {
  const src = SOURCES.find((s) => s.re.test(url))
  let kind: MediaKind = src?.kind ?? 'peli'
  let t = text
    .replace(/https?:\/\/\S+/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)[0] ?? ''
  if (/\b(serie|tv series|miniserie|tv mini series|temporada)\b/i.test(text) || /\/tv\//i.test(url)) kind = 'serie'
  if (/\b(documental|documentary)\b/i.test(text)) kind = 'docu'
  t = t
    .replace(/^(mira|echa un vistazo a|check out)\s+/i, '')
    .replace(/\s*[-|–·]\s*(FilmAffinity|IMDb|Letterboxd|JustWatch|Goodreads|Casa del Libro|Netflix|Prime Video|HBO Max|Max|Disney\+|Filmin|Movistar Plus\+?)\b.*$/i, '')
    .replace(/\s*\((TV (Mini )?Series|Serie de TV|Miniserie de TV)[^)]*\)/i, '')
    .replace(/\s*⭐.*$/, '')
    .trim()
  const year = t.match(/\((\d{4})(?:[–-]\d{0,4})?\)\s*$/)
  if (year) t = t.slice(0, year.index).trim()
  // Goodreads: "Título by Autor"
  let subtitle = year?.[1] ?? ''
  const by = kind === 'libro' ? t.match(/^(.*?)\s+(?:by|de)\s+([^,]+)$/i) : null
  if (by) {
    t = by[1].trim()
    subtitle = by[2].trim()
  }
  return { title: t.replace(/^["'«“]+|["'»”]+$/g, '').slice(0, 120), subtitle, kind }
}
