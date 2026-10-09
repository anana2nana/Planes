import { arr, millis, num, oneOf, place, str, useList } from '../../hooks/useList'
import type { TrackStats } from '../../lib/geo'
import type { PlaceInfo } from '../../lib/types'

export type RouteKind = 'paseo' | 'senderismo'
export const ROUTE_KINDS: Record<RouteKind, { emoji: string; label: string; color: string }> = {
  paseo: { emoji: '🚶', label: 'Paseo', color: '#0ea5e9' },
  senderismo: { emoji: '🥾', label: 'Senderismo', color: '#16a34a' },
}
export const DIFFICULTY = ['', 'Fácil', 'Media', 'Difícil'] as const

export interface Route {
  id: string
  title: string
  /** Hecha o por hacer. */
  status: 'done' | 'want'
  kind: RouteKind
  who: 'nita' | 'kitos' | 'both'
  /** Día en que se hizo (yyyy-mm-dd). */
  date: string | null
  /** Recorrido (polilínea codificada); vacío si no hay track. */
  polyline: string
  /** Perfil de altitud para la gráfica. */
  profile: { km: number; ele: number }[]
  start: { lat: number; lng: number } | null
  stats: TrackStats | null
  difficulty: 1 | 2 | 3 | null
  link: string
  notes: string
  /** Punto de salida (para las que no tienen track). */
  place: PlaceInfo | null
  source: 'app' | 'gpx' | 'manual'
  createdAt: number
}
export type RouteDraft = Omit<Route, 'id' | 'createdAt'> & { id?: string }

const parse = (id: string, x: Record<string, any>): Route => ({
  id,
  title: str(x.title),
  status: oneOf(x.status, ['done', 'want'] as const, 'done'),
  kind: oneOf(x.kind, ['paseo', 'senderismo'] as const, 'paseo'),
  who: oneOf(x.who, ['nita', 'kitos', 'both'] as const, 'both'),
  date: str(x.date) || null,
  polyline: str(x.polyline),
  profile: arr(x.profile)
    .map((p) => ({ km: num(p?.km) ?? 0, ele: num(p?.ele) ?? 0 }))
    .filter((p) => Number.isFinite(p.ele)),
  start: num(x.start?.lat) !== null && num(x.start?.lng) !== null ? { lat: x.start.lat, lng: x.start.lng } : null,
  stats: x.stats ? { km: num(x.stats.km) ?? 0, gain: num(x.stats.gain) ?? 0, loss: num(x.stats.loss) ?? 0, minutes: num(x.stats.minutes), moving: num(x.stats.moving) } : null,
  difficulty: x.difficulty === 1 || x.difficulty === 2 || x.difficulty === 3 ? x.difficulty : null,
  link: str(x.link),
  notes: str(x.notes),
  place: place(x.place),
  source: oneOf(x.source, ['app', 'gpx', 'manual'] as const, 'manual'),
  createdAt: millis(x.createdAt),
})

export const useRoutes = () => useList('routes', parse)

export const emptyRoute = (o: Partial<RouteDraft> = {}): RouteDraft => ({
  title: '',
  status: 'want',
  kind: 'senderismo',
  who: 'both',
  date: null,
  polyline: '',
  profile: [],
  start: null,
  stats: null,
  difficulty: null,
  link: '',
  notes: '',
  place: null,
  source: 'manual',
  ...o,
})

/** Km de las rutas hechas este mes y en total. */
export function routeTotals(routes: Route[], today: string) {
  const done = routes.filter((r) => r.status === 'done')
  const month = done.filter((r) => r.date?.slice(0, 7) === today.slice(0, 7))
  const km = (l: Route[]) => Math.round(l.reduce((s, r) => s + (r.stats?.km ?? 0), 0) * 10) / 10
  return { monthKm: km(month), monthCount: month.length, totalKm: km(done), doneCount: done.length, wantCount: routes.length - done.length }
}

/** Dónde empieza una ruta (para "Cómo llegar"). */
export const startPlace = (r: Pick<Route, 'place' | 'start' | 'title'>): PlaceInfo | null =>
  r.place ?? (r.start ? { name: `Inicio de ${r.title || 'la ruta'}`, address: '', placeId: null, lat: r.start.lat, lng: r.start.lng } : null)
