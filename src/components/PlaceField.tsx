import { useEffect, useRef, useState } from 'react'
import { isMapsConfigured, loadMap, loadPlaces, resolvePlace, searchPlaces, type Suggestion } from '../lib/maps'
import type { PlaceInfo } from '../lib/types'
import { CloseIcon, NavigateIcon, PinIcon } from './Icons'
import { DirectionsLink } from './DirectionsLink'

/** Campo "Dónde": sugiere sitios de Google Maps mientras escribes. Sin conexión o sin clave, vale texto libre. */
export function PlaceField({ value, onChange }: { value: PlaceInfo | null; onChange: (p: PlaceInfo | null) => void }) {
  const [text, setText] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(!isMapsConfigured)
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const near = useRef<{ lat: number; lng: number } | null>(null)

  // Sugerencias cerca de donde estás, si el navegador ya tiene permiso de ubicación (no lo pedimos).
  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        if (p.state === 'granted')
          navigator.geolocation.getCurrentPosition((pos) => (near.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (failed || text.trim().length < 3) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const { AutocompleteSessionToken } = await loadPlaces()
        token.current ??= new AutocompleteSessionToken()
        const list = await searchPlaces(text.trim(), token.current, near.current)
        if (!cancelled) setSuggestions(list.slice(0, 5))
      } catch (e) {
        console.warn('Google Maps no disponible', e)
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [text, failed])

  const pick = async (s: Suggestion) => {
    setSuggestions([])
    setText('')
    try {
      onChange(await resolvePlace(s))
    } catch {
      onChange({ name: s.main, address: s.secondary, placeId: s.id, lat: null, lng: null })
    }
    token.current = null // la sesión de autocompletado termina al elegir
  }

  const useText = () => {
    if (!text.trim()) return
    onChange({ name: text.trim(), address: '', placeId: null, lat: null, lng: null })
    setText('')
    setSuggestions([])
  }

  if (value) {
    return (
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        {value.lat !== null && value.lng !== null && !failed && <MiniMap lat={value.lat} lng={value.lng} />}
        <div className="flex items-start gap-3 p-3">
          <PinIcon className="mt-0.5 size-5 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{value.name}</p>
            {value.address && <p className="truncate text-xs text-muted">{value.address}</p>}
          </div>
          <button type="button" onClick={() => onChange(null)} aria-label="Quitar sitio" className="grid size-8 shrink-0 place-items-center rounded-full bg-stone-100 text-muted">
            <CloseIcon className="size-4" />
          </button>
        </div>
        <DirectionsLink
          place={value}
          className="flex items-center justify-center gap-2 border-t border-stone-100 bg-sky-50 py-2.5 text-sm font-bold text-sky-700 active:bg-sky-100"
        >
          <NavigateIcon className="size-4" /> Cómo llegar
        </DirectionsLink>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 focus-within:border-both">
        <PinIcon className="size-5 shrink-0 text-stone-400" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (suggestions[0]) pick(suggestions[0])
              else useText()
            }
          }}
          onBlur={() => setTimeout(() => failed && useText(), 150)}
          placeholder={failed ? 'Dirección o sitio' : 'Busca un sitio o una dirección'}
          aria-label="Dónde"
          className="h-12 min-w-0 flex-1 bg-transparent outline-none"
        />
        {loading && <span className="size-4 animate-spin rounded-full border-2 border-stone-200 border-t-both" />}
      </div>
      {suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-xl" role="listbox">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left active:bg-stone-50" role="option">
                <PinIcon className="mt-0.5 size-4 shrink-0 text-stone-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{s.main}</span>
                  <span className="block truncate text-xs text-muted">{s.secondary}</span>
                </span>
              </button>
            </li>
          ))}
          <li className="px-3 py-1.5 text-right text-[10px] text-stone-400">con Google Maps</li>
        </ul>
      )}
      {failed && text.trim() && (
        <button type="button" onClick={useText} className="mt-2 text-sm font-semibold text-both">
          Usar «{text.trim()}»
        </button>
      )}
    </div>
  )
}

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    loadMap()
      .then(({ maps, marker }) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          gestureHandling: 'none',
          clickableIcons: false,
          mapId: 'DEMO_MAP_ID',
        })
        new marker.AdvancedMarkerElement({ map, position: { lat, lng } })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [lat, lng])
  return <div ref={ref} className="h-32 w-full bg-stone-100" aria-hidden />
}
