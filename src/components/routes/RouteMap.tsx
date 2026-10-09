import { useEffect, useRef, useState } from 'react'
import { decodePolyline } from '../../lib/geo'
import { loadMap } from '../../lib/maps'

export interface MapTrack {
  /** Polilínea codificada o lista de puntos. */
  path: string | { lat: number; lng: number }[]
  color: string
  /** Trazo discontinuo (la ruta planeada mientras grabas). */
  dashed?: boolean
  /** Marcar inicio y fin. */
  ends?: boolean
}

const toPath = (p: MapTrack['path']) => (typeof p === 'string' ? decodePolyline(p) : p)

/**
 * Mapa con una o varias rutas dibujadas. `follow` centra en el último punto (al grabar);
 * si no, encuadra todas las rutas.
 */
export function RouteMap({ tracks, height = 'h-72', follow = false, here = null, onReady }: { tracks: MapTrack[]; height?: string; follow?: boolean; here?: { lat: number; lng: number } | null; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const state = useRef<{ map: google.maps.Map; lines: google.maps.Polyline[]; marks: google.maps.marker.AdvancedMarkerElement[]; me: google.maps.marker.AdvancedMarkerElement | null; marker: typeof google.maps.marker } | null>(null)
  const [failed, setFailed] = useState(false)
  const fitted = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadMap()
      .then(({ maps, marker }) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, { center: { lat: 40.4168, lng: -3.7038 }, zoom: 13, disableDefaultUI: true, zoomControl: true, mapTypeControl: true, mapTypeControlOptions: { mapTypeIds: ['roadmap', 'terrain', 'hybrid'] }, mapTypeId: 'terrain', clickableIcons: false, mapId: 'DEMO_MAP_ID' })
        state.current = { map, lines: [], marks: [], me: null, marker }
        onReady?.()
        draw()
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = () => {
    const s = state.current
    if (!s) return
    s.lines.forEach((l) => l.setMap(null))
    s.marks.forEach((m) => (m.map = null))
    s.lines = []
    s.marks = []
    const bounds = new google.maps.LatLngBounds()
    let any = false
    for (const t of tracks) {
      const path = toPath(t.path)
      if (!path.length) continue
      any = true
      path.forEach((p) => bounds.extend(p))
      s.lines.push(
        new google.maps.Polyline({
          map: s.map,
          path,
          strokeColor: t.color,
          strokeOpacity: t.dashed ? 0 : 0.95,
          strokeWeight: 5,
          icons: t.dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: t.color, scale: 3 }, offset: '0', repeat: '14px' }] : undefined,
        }),
      )
      if (t.ends) {
        const dot = (bg: string, label: string) => {
          const el = document.createElement('div')
          el.textContent = label
          el.style.cssText = `background:${bg};color:#fff;font:700 11px sans-serif;border-radius:999px;padding:3px 7px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)`
          return el
        }
        s.marks.push(new s.marker.AdvancedMarkerElement({ map: s.map, position: path[0], content: dot('#16a34a', 'Inicio'), title: 'Inicio' }))
        if (path.length > 1) s.marks.push(new s.marker.AdvancedMarkerElement({ map: s.map, position: path[path.length - 1], content: dot('#e11d48', 'Fin'), title: 'Fin' }))
      }
    }
    if (here) {
      bounds.extend(here)
      any = true
      if (!s.me) {
        const el = document.createElement('div')
        el.style.cssText = 'width:16px;height:16px;border-radius:999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)'
        s.me = new s.marker.AdvancedMarkerElement({ map: s.map, position: here, content: el, title: 'Estás aquí' })
      } else s.me.position = here
    }
    if (follow && here) {
      s.map.panTo(here)
      if (!fitted.current) {
        s.map.setZoom(16)
        fitted.current = true
      }
    } else if (any && !fitted.current) {
      s.map.fitBounds(bounds, 30)
      fitted.current = true
    }
  }

  const key = JSON.stringify(tracks.map((t) => [typeof t.path === 'string' ? t.path : t.path.length, t.color])) + JSON.stringify(here)
  useEffect(() => {
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (failed) return <div className={`grid ${height} place-items-center rounded-3xl bg-stone-100 text-sm text-muted`}>No se ha podido cargar el mapa</div>
  return <div ref={ref} className={`${height} w-full overflow-hidden rounded-3xl bg-stone-100`} aria-label="Mapa de la ruta" />
}

/** La forma de la ruta en pequeñito (sin mapa), para las listas. */
export function TrackShape({ polyline, className = 'size-14', color = 'currentColor' }: { polyline: string; className?: string; color?: string }) {
  const pts = decodePolyline(polyline)
  if (pts.length < 2) return <span className={`grid place-items-center rounded-2xl bg-stone-100 text-2xl ${className}`}>🥾</span>
  const lats = pts.map((p) => p.lat)
  const lngs = pts.map((p) => p.lng)
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)]
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const w = (maxLng - minLng) * k || 1e-6
  const h = maxLat - minLat || 1e-6
  const s = 88 / Math.max(w, h)
  const ox = (100 - w * s) / 2
  const oy = (100 - h * s) / 2
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p.lng - minLng) * k * s).toFixed(1)},${(oy + (maxLat - p.lat) * s).toFixed(1)}`).join('')
  return (
    <svg viewBox="0 0 100 100" className={`rounded-2xl bg-emerald-50 ${className}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
