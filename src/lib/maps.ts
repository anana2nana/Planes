import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import type { PlaceInfo } from './types'

const KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export const isMapsConfigured = Boolean(KEY)

let configured = false
function ensureOptions() {
  if (configured) return
  setOptions({ key: KEY, v: 'weekly', language: 'es', region: 'ES' })
  configured = true
}

export async function loadPlaces() {
  ensureOptions()
  return importLibrary('places')
}

export async function loadMap() {
  ensureOptions()
  const [maps, marker] = await Promise.all([importLibrary('maps'), importLibrary('marker')])
  return { maps, marker }
}

export interface Suggestion {
  id: string
  main: string
  secondary: string
  prediction: google.maps.places.PlacePrediction
}

/** Sugerencias de sitios mientras se escribe (Places API New). */
export async function searchPlaces(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
  near?: { lat: number; lng: number } | null,
): Promise<Suggestion[]> {
  const { AutocompleteSuggestion } = await loadPlaces()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    language: 'es',
    region: 'es',
    ...(near ? { origin: near, locationBias: { center: near, radius: 50_000 } } : {}),
  })
  return suggestions
    .map((s) => s.placePrediction)
    .filter((p): p is google.maps.places.PlacePrediction => !!p)
    .map((p) => ({
      id: p.placeId,
      main: p.mainText?.text ?? p.text.text,
      secondary: p.secondaryText?.text ?? '',
      prediction: p,
    }))
}

/** Datos del sitio elegido (cierra la sesión de autocompletado). */
export async function resolvePlace(s: Suggestion): Promise<PlaceInfo> {
  const place = s.prediction.toPlace()
  await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] })
  return {
    name: place.displayName ?? s.main,
    address: place.formattedAddress ?? s.secondary,
    placeId: place.id,
    lat: place.location?.lat() ?? null,
    lng: place.location?.lng() ?? null,
  }
}

/** Abre la ruta (la más rápida según Google, con tráfico) desde donde estés. En Android abre la app de Maps. */
export function directionsUrl(place: PlaceInfo): string {
  const params = new URLSearchParams({ api: '1', travelmode: 'driving' })
  const label = [place.name, place.address].filter(Boolean).join(', ')
  if (place.lat !== null && place.lng !== null && !place.placeId) params.set('destination', `${place.lat},${place.lng}`)
  else params.set('destination', label)
  if (place.placeId) params.set('destination_place_id', place.placeId)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
