// Viajes: fechas, reservas, maleta y presupuesto. Puro y testeado (tests/trips.test.ts).

import type { AssignMode, PlaceInfo } from './types'

export type BookingKind = 'vuelo' | 'tren' | 'bus' | 'hotel' | 'coche' | 'actividad' | 'seguro' | 'otro'
export const BOOKING_KINDS: Record<BookingKind, { label: string; emoji: string }> = {
  vuelo: { label: 'Vuelo', emoji: '✈️' },
  tren: { label: 'Tren', emoji: '🚆' },
  bus: { label: 'Bus', emoji: '🚌' },
  hotel: { label: 'Alojamiento', emoji: '🏨' },
  coche: { label: 'Coche', emoji: '🚗' },
  actividad: { label: 'Actividad', emoji: '🎟️' },
  seguro: { label: 'Seguro', emoji: '🛡️' },
  otro: { label: 'Otro', emoji: '📎' },
}
export const BOOKING_ORDER = Object.keys(BOOKING_KINDS) as BookingKind[]

export interface Booking {
  id: string
  kind: BookingKind
  title: string
  /** yyyy-mm-dd */
  date: string | null
  /** HH:MM */
  time: string
  /** Localizador, nº de reserva… */
  ref: string
  link: string
  price: number | null
  notes: string
}
export interface PackItem {
  name: string
  who: AssignMode
  done: boolean
}
export interface Expense {
  title: string
  amount: number
}
export interface Trip {
  id: string
  title: string
  destination: PlaceInfo | null
  start: string | null
  end: string | null
  budget: number | null
  bookings: Booking[]
  packing: PackItem[]
  expenses: Expense[]
  notes: string
  createdAt: number
}

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const diff = (a: string, b: string) => Math.round((Date.UTC(...ymdParts(b)) - Date.UTC(...ymdParts(a))) / 86_400_000)
const ymdParts = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)
  return [y, m - 1, d]
}

export type TripStatus = 'idea' | 'upcoming' | 'now' | 'past'
export function tripStatus(t: Pick<Trip, 'start' | 'end'>, today: Date): TripStatus {
  if (!t.start) return 'idea'
  const now = ymd(today)
  const end = t.end ?? t.start
  if (now < t.start) return 'upcoming'
  if (now > end) return 'past'
  return 'now'
}

/** Días que faltan para salir (o null si no hay fecha o ya pasó). */
export function daysToTrip(t: Pick<Trip, 'start'>, today: Date): number | null {
  if (!t.start) return null
  const d = diff(ymd(today), t.start)
  return d >= 0 ? d : null
}

export const nights = (t: Pick<Trip, 'start' | 'end'>) => (t.start && t.end ? Math.max(0, diff(t.start, t.end)) : null)

/** Lo gastado: reservas con precio + gastos sueltos. */
export function spent(t: Pick<Trip, 'bookings' | 'expenses'>): number {
  return t.bookings.reduce((s, b) => s + (b.price ?? 0), 0) + t.expenses.reduce((s, e) => s + e.amount, 0)
}

export const packingProgress = (items: PackItem[]) => ({ done: items.filter((i) => i.done).length, total: items.length })

/** Reservas en orden de fecha y hora (las que no tienen fecha, al final). */
export const sortBookings = (list: Booking[]) => [...list].sort((a, b) => `${a.date ?? '9999'} ${a.time}`.localeCompare(`${b.date ?? '9999'} ${b.time}`))

/** Viajes ordenados: en curso, próximos (el más cercano primero), ideas y pasados (el más reciente primero). */
export function sortTrips(trips: Trip[], today: Date): Trip[] {
  const rank: Record<TripStatus, number> = { now: 0, upcoming: 1, idea: 2, past: 3 }
  return [...trips].sort((a, b) => {
    const ra = rank[tripStatus(a, today)]
    const rb = rank[tripStatus(b, today)]
    if (ra !== rb) return ra - rb
    if (ra === 3) return (b.start ?? '').localeCompare(a.start ?? '')
    return (a.start ?? '').localeCompare(b.start ?? '') || b.createdAt - a.createdAt
  })
}

/** Añade a la maleta lo de la lista de siempre que aún no esté. */
export function mergePacking(current: PackItem[], base: Pick<PackItem, 'name' | 'who'>[]): PackItem[] {
  const have = new Set(current.map((i) => i.name.trim().toLowerCase()))
  return [...current, ...base.filter((b) => !have.has(b.name.trim().toLowerCase())).map((b) => ({ ...b, done: false }))]
}

/** Para empezar si aún no tenéis lista de siempre. */
export const DEFAULT_PACKING: Pick<PackItem, 'name' | 'who'>[] = [
  { name: 'DNI / pasaporte', who: 'both' },
  { name: 'Cargadores', who: 'both' },
  { name: 'Cepillo de dientes', who: 'both' },
  { name: 'Pijama', who: 'both' },
  { name: 'Ropa interior', who: 'both' },
  { name: 'Neceser', who: 'both' },
  { name: 'Medicinas', who: 'both' },
  { name: 'Gafas de sol', who: 'both' },
  { name: 'Batería externa', who: 'both' },
  { name: 'Auriculares', who: 'both' },
]

/** «Del 3 al 7 de may» / «3 may – 2 jun». */
export function tripDates(t: Pick<Trip, 'start' | 'end'>): string {
  if (!t.start) return 'Sin fecha'
  const a = parse(t.start)
  const fmt = (d: Date, month = true) => d.toLocaleDateString('es-ES', month ? { day: 'numeric', month: 'short' } : { day: 'numeric' })
  if (!t.end || t.end === t.start) return fmt(a)
  const b = parse(t.end)
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear() ? `Del ${fmt(a, false)} al ${fmt(b)}` : `${fmt(a)} – ${fmt(b)}`
}
