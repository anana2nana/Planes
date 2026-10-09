// Sitios: restaurantes, bares y planes a los que queréis ir o ya habéis ido. Puro y testeado (tests/spots.test.ts).

import type { PersonId, PlaceInfo } from './types'

export type SpotKind = 'restaurante' | 'bar' | 'cafe' | 'copas' | 'plan' | 'tienda' | 'otro'
export type SpotStatus = 'want' | 'been'

export const SPOT_KINDS: Record<SpotKind, { label: string; emoji: string }> = {
  restaurante: { label: 'Restaurante', emoji: '🍽️' },
  bar: { label: 'Bar y tapas', emoji: '🍻' },
  cafe: { label: 'Café y brunch', emoji: '☕' },
  copas: { label: 'Copas', emoji: '🍸' },
  plan: { label: 'Plan', emoji: '🎡' },
  tienda: { label: 'Tienda', emoji: '🛍️' },
  otro: { label: 'Otro', emoji: '📍' },
}
export const SPOT_ORDER = Object.keys(SPOT_KINDS) as SpotKind[]

export interface Spot {
  id: string
  name: string
  place: PlaceInfo | null
  kind: SpotKind
  status: SpotStatus
  /** "japonés", "pizza"… */
  cuisine: string
  /** 1 a 4 (€ a €€€€). */
  price: number | null
  rating: Record<PersonId, number | null>
  /** Qué pedir (o qué no). */
  order: string
  notes: string
  link: string
  /** Fechas de las visitas (yyyy-mm-dd). */
  visits: string[]
  createdAt: number
}

export const euros = (n: number | null) => (n ? '€'.repeat(n) : '')

export function avgSpot(s: Pick<Spot, 'rating'>): number | null {
  const r = [s.rating.nita, s.rating.kitos].filter((x): x is number => typeof x === 'number' && x > 0)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}

export const lastVisit = (s: Pick<Spot, 'visits'>) => [...s.visits].sort().pop() ?? null

/** Añade una visita (sin repetir el mismo día) y lo pasa a «hemos ido». */
export function addVisit<T extends Pick<Spot, 'visits' | 'status'>>(s: T, date: string): T {
  return { ...s, status: 'been', visits: s.visits.includes(date) ? s.visits : [...s.visits, date].sort() }
}

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const kmText = (km: number) => (km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km.toLocaleString('es-ES', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`)

/**
 * Orden de la lista. Con tu ubicación, lo más cerca primero; si no, en «queremos ir» lo último
 * apuntado y en «hemos ido» los mejor valorados (y luego el más reciente).
 */
export function sortSpots(list: Spot[], status: SpotStatus, here: { lat: number; lng: number } | null): Spot[] {
  const items = list.filter((s) => s.status === status)
  if (here) {
    const d = (s: Spot) => (s.place?.lat != null && s.place?.lng != null ? distanceKm(here, { lat: s.place.lat, lng: s.place.lng }) : Infinity)
    return items.sort((a, b) => d(a) - d(b))
  }
  if (status === 'want') return items.sort((a, b) => b.createdAt - a.createdAt)
  return items.sort((a, b) => (avgSpot(b) ?? 0) - (avgSpot(a) ?? 0) || (lastVisit(b) ?? '').localeCompare(lastVisit(a) ?? ''))
}

/** Desde un sitio de Google Maps, el tipo más probable por el nombre. */
export function guessSpotKind(name: string): SpotKind {
  const n = name.toLowerCase()
  if (/caf[eé]|coffee|brunch|churrer|panader|bakery|pasteler/.test(n)) return 'cafe'
  if (/\bbar\b|taberna|tasca|cervecer|vermut|tapas|bodega/.test(n)) return 'bar'
  if (/cocktail|c[oó]ctel|copas|pub|lounge/.test(n)) return 'copas'
  if (/museo|parque|teatro|cine|mirador|escape|bolera|karting|spa|exposici/.test(n)) return 'plan'
  if (/tienda|shop|store|mercado|librer/.test(n)) return 'tienda'
  return 'restaurante'
}
