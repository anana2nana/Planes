// Rutas: puntos GPS, distancia, desnivel, ritmo y archivos GPX. Puro y testeado (tests/geo.test.ts).

import { distanceKm } from './spots.ts'

export interface TrackPoint {
  lat: number
  lng: number
  /** Altitud en metros (si se sabe). */
  ele: number | null
  /** Milisegundos (si se sabe). */
  t: number | null
}

// ─── Polilínea codificada (formato de Google): ocupa ~6 veces menos que la lista de puntos ───

function encodeNumber(n: number): string {
  let v = n < 0 ? ~(n << 1) : n << 1
  let out = ''
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
    v >>= 5
  }
  return out + String.fromCharCode(v + 63)
}

/** Codifica lat/lng (precisión ~1 m). */
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  let lat = 0
  let lng = 0
  let out = ''
  for (const p of points) {
    const la = Math.round(p.lat * 1e5)
    const ln = Math.round(p.lng * 1e5)
    out += encodeNumber(la - lat) + encodeNumber(ln - lng)
    lat = la
    lng = ln
  }
  return out
}

export function decodePolyline(s: string): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = []
  let i = 0
  let lat = 0
  let lng = 0
  const next = () => {
    let shift = 0
    let result = 0
    let b: number
    do {
      b = s.charCodeAt(i++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20 && i < s.length + 1)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (i < s.length) {
    lat += next()
    lng += next()
    out.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return out
}

// ─── Cálculos ───────────────────────────────────────────────────────────────

/** Distancia total en km. */
export function trackKm(points: { lat: number; lng: number }[]): number {
  let km = 0
  for (let i = 1; i < points.length; i++) km += distanceKm(points[i - 1], points[i])
  return km
}

/** Desnivel positivo y negativo (con un umbral para no sumar el ruido del GPS). */
export function elevation(eles: (number | null)[], threshold = 4): { gain: number; loss: number; min: number | null; max: number | null } {
  const list = eles.filter((e): e is number => e !== null && Number.isFinite(e))
  if (!list.length) return { gain: 0, loss: 0, min: null, max: null }
  let gain = 0
  let loss = 0
  let ref = list[0]
  for (const e of list) {
    if (e - ref >= threshold) {
      gain += e - ref
      ref = e
    } else if (ref - e >= threshold) {
      loss += ref - e
      ref = e
    }
  }
  return { gain: Math.round(gain), loss: Math.round(loss), min: Math.round(Math.min(...list)), max: Math.round(Math.max(...list)) }
}

/** Minutos en movimiento: no cuenta las paradas (tramos de más de 1 min sin avanzar 10 m). */
export function movingMinutes(points: TrackPoint[]): number | null {
  const timed = points.filter((p) => p.t !== null)
  if (timed.length < 2) return null
  let ms = 0
  for (let i = 1; i < timed.length; i++) {
    const dt = timed[i].t! - timed[i - 1].t!
    const d = distanceKm(timed[i - 1], timed[i]) * 1000
    if (dt > 0 && !(dt > 60_000 && d < 10)) ms += dt
  }
  return Math.round(ms / 60_000)
}

export interface TrackStats {
  km: number
  gain: number
  loss: number
  /** Minutos totales (de la primera a la última hora), si las hay. */
  minutes: number | null
  moving: number | null
}

export function trackStats(points: TrackPoint[]): TrackStats {
  const e = elevation(points.map((p) => p.ele))
  const times = points.map((p) => p.t).filter((t): t is number => t !== null)
  return {
    km: Math.round(trackKm(points) * 100) / 100,
    gain: e.gain,
    loss: e.loss,
    minutes: times.length >= 2 ? Math.round((times[times.length - 1] - times[0]) / 60_000) : null,
    moving: movingMinutes(points),
  }
}

/** "12:30 min/km" (ritmo de paseo/senderismo). */
export function paceText(km: number, minutes: number | null): string {
  if (!minutes || km < 0.05) return ''
  const pace = minutes / km
  const m = Math.floor(pace)
  const s = Math.round((pace - m) * 60)
  return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, '0')} min/km`
}

/** "1 h 25 min" / "45 min". */
export function durationText(minutes: number | null): string {
  if (minutes === null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

export const kmFmt = (km: number) => `${km.toLocaleString('es-ES', { maximumFractionDigits: km < 10 ? 2 : 1 })} km`

/** Quita puntos de sobra (a menos de `minMeters` del anterior) para que la ruta pese poco. */
export function thin<T extends { lat: number; lng: number }>(points: T[], minMeters = 8, max = 4000): T[] {
  if (points.length <= 2) return points
  let out: T[] = [points[0]]
  for (const p of points.slice(1, -1)) if (distanceKm(out[out.length - 1], p) * 1000 >= minMeters) out.push(p)
  out.push(points[points.length - 1])
  if (out.length > max) {
    const step = out.length / max
    out = Array.from({ length: max }, (_, i) => out[Math.floor(i * step)]).concat(out[out.length - 1])
  }
  return out
}

/** Perfil de altitud: puntos (km recorridos, altitud) para la gráfica, como mucho `n`. */
export function profile(points: TrackPoint[], n = 60): { km: number; ele: number }[] {
  const withEle = points.some((p) => p.ele !== null)
  if (!withEle || points.length < 2) return []
  const out: { km: number; ele: number }[] = []
  let km = 0
  const step = Math.max(1, Math.floor(points.length / n))
  for (let i = 0; i < points.length; i++) {
    if (i) km += distanceKm(points[i - 1], points[i])
    if ((i % step === 0 || i === points.length - 1) && points[i].ele !== null) out.push({ km: Math.round(km * 100) / 100, ele: Math.round(points[i].ele!) })
  }
  return out
}

/**
 * ¿Guardamos esta lectura del GPS? Se descartan las imprecisas (> 35 m), las que casi no se
 * han movido (< 5 m: el GPS "baila" estando quieto) y los saltos imposibles andando (> 25 km/h).
 */
export function shouldKeep(prev: TrackPoint | null, next: TrackPoint, accuracy: number): boolean {
  if (!(accuracy <= 35)) return false
  if (!prev) return true
  const m = distanceKm(prev, next) * 1000
  if (m < 5) return false
  if (prev.t !== null && next.t !== null && next.t > prev.t) {
    const kmh = m / 1000 / ((next.t - prev.t) / 3_600_000)
    if (kmh > 25) return false
  }
  return true
}

// ─── GPX (Wikiloc, AllTrails, Strava, relojes…) ────────────────────────────

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1]
const inner = (block: string, name: string) => block.match(new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i'))?.[1]?.trim()
const unescape = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Lee un GPX: los puntos del track (o de la ruta, o los waypoints si no hay otra cosa) y el nombre. */
export function parseGpx(xml: string): { name: string; points: TrackPoint[] } {
  const pts: TrackPoint[] = []
  for (const tag of ['trkpt', 'rtept', 'wpt']) {
    const re = new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${tag}>)`, 'gi')
    for (const m of xml.matchAll(re)) {
      const lat = Number(attr(m[1], 'lat'))
      const lng = Number(attr(m[1], 'lon'))
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const body = m[2] ?? ''
      const ele = Number(inner(body, 'ele'))
      const time = inner(body, 'time')
      const t = time ? Date.parse(time) : NaN
      pts.push({ lat, lng, ele: inner(body, 'ele') && Number.isFinite(ele) ? ele : null, t: Number.isFinite(t) ? t : null })
    }
    if (pts.length) break
  }
  const meta = xml.match(/<(?:\w+:)?(?:metadata|trk|rte)\b[\s\S]*?<(?:\w+:)?name[^>]*>([\s\S]*?)<\/(?:\w+:)?name>/i)?.[1]
  return { name: meta ? unescape(meta).trim().slice(0, 100) : '', points: pts }
}

/** Enlaces de webs de rutas (para compartir una ruta por hacer). */
export const isRouteLink = (url: string) => /wikiloc\.com|alltrails\.com|komoot\.(com|de)|outdooractive\.com|strava\.com\/(routes|activities)|mendikat/i.test(url)
