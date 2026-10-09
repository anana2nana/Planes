// Lo vuestro: banda sonora, hitos y cápsula del tiempo. Puro y testeado (tests/us.test.ts).

import { daysTo } from './due.ts'

/** Buscar la canción en Spotify o YouTube (sin cuentas ni claves: se abre la app). */
export const spotifySearch = (title: string, artist: string) => `https://open.spotify.com/search/${encodeURIComponent([title, artist].filter(Boolean).join(' '))}`
export const youtubeSearch = (title: string, artist: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent([title, artist].filter(Boolean).join(' '))}`

export interface Milestone {
  id: string
  date: string
  title: string
  emoji: string
  text: string
  /** Puesto por la app (p. ej. el día que empezasteis), no se puede borrar. */
  auto?: boolean
}

export const MILESTONE_EMOJIS = ['💞', '💋', '✈️', '🏠', '🐱', '💍', '🎉', '🍾', '🎓', '💼', '🚗', '🏗️', '👶', '🌍', '⭐', '📸']

/** La línea del tiempo: de lo más antiguo a lo más reciente, con el día que empezasteis si se sabe. */
export function timeline(list: Milestone[], since: string | null): Milestone[] {
  const all = [...list]
  if (since && !list.some((m) => m.date === since)) all.push({ id: 'since', date: since, title: 'Empezamos', emoji: '💞', text: '', auto: true })
  return all.sort((a, b) => a.date.localeCompare(b.date))
}

/** Años completos entre dos fechas (para «hace 3 años»). */
export function yearsBetween(from: string, today: Date): number {
  const [y, m, d] = from.split('-').map(Number)
  let n = today.getFullYear() - y
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) n--
  return Math.max(0, n)
}

/** Una carta de la cápsula: se puede abrir desde el día indicado. */
export function capsuleState(openAt: string, today: Date): { open: boolean; days: number } {
  const days = daysTo(openAt, today)
  return { open: days <= 0, days }
}

/** «Se abre en 3 meses», «Se abre mañana». */
export function opensIn(days: number): string {
  if (days <= 0) return 'Ya se puede abrir'
  if (days === 1) return 'Se abre mañana'
  if (days < 60) return `Se abre en ${days} días`
  if (days < 730) return `Se abre en ${Math.round(days / 30.4)} meses`
  return `Se abre en ${Math.round(days / 365)} años`
}
