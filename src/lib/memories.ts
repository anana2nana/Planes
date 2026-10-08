// Diario de recuerdos: qué recordar hoy y de qué citas preguntar "¿qué tal fue?".
// Puro y testeado (tests/memories.test.ts).

import type { Kind, PersonId, PlaceInfo } from './types'

export interface Memory {
  id: string
  title: string
  /** yyyy-mm-dd */
  date: string
  /** De qué viene: un plan, una cita, una tarea o un recuerdo suelto. */
  kind: Kind | 'free'
  planId: string | null
  place: PlaceInfo | null
  text: string
  /** Miniatura de la primera foto (JPEG pequeño en data URL), o null. */
  thumb: string | null
  photoCount: number
  by: PersonId | null
  createdAt: number
}

export const MAX_PHOTOS = 6

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** "MM-DD" de una fecha yyyy-mm-dd (para buscar "tal día como hoy"). */
export const monthDay = (date: string) => date.slice(5)

/** Recuerdos de este mismo día en años anteriores, del más reciente al más antiguo. */
export function onThisDay<T extends Pick<Memory, 'date'>>(memories: T[], today: Date): { memory: T; years: number }[] {
  const md = ymd(today).slice(5)
  const y = today.getFullYear()
  return memories
    .filter((m) => monthDay(m.date) === md && Number(m.date.slice(0, 4)) < y)
    .map((m) => ({ memory: m, years: y - Number(m.date.slice(0, 4)) }))
    .sort((a, b) => a.years - b.years)
}

export const yearsAgo = (n: number) => (n === 1 ? 'hace un año' : `hace ${n} años`)

interface EventLike {
  id: string
  kind: Kind
  title: string
  dueMs: number | null
  repeat: { yearly: boolean; days: number[] } | null
}

/**
 * Citas que ya han pasado (ayer o hace 2-3 días) y de las que aún no hay recuerdo
 * ni se ha dicho "ahora no". Las anuales (cumpleaños) ya se han movido al año
 * siguiente, así que se mira la fecha de hace un año; las semanales no se preguntan.
 */
export function eventPrompts(events: EventLike[], memories: Pick<Memory, 'planId' | 'date'>[], dismissed: Set<string>, now: Date): { id: string; title: string; date: string; key: string }[] {
  const today = ymd(now)
  const from = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3))
  const out: { id: string; title: string; date: string; key: string }[] = []
  for (const e of events) {
    if (e.kind !== 'event' || e.dueMs === null) continue
    if (e.repeat && !e.repeat.yearly) continue
    const due = new Date(e.dueMs)
    const d = e.repeat?.yearly ? new Date(due.getFullYear() - 1, due.getMonth(), due.getDate()) : due
    const date = ymd(d)
    // Solo lo que ya terminó: hasta ayer (o antes de hoy) y no hace más de 3 días.
    if (date >= today || date < from) continue
    const key = `${e.id}@${date}`
    if (dismissed.has(key)) continue
    if (memories.some((m) => m.planId === e.id && m.date === date)) continue
    out.push({ id: e.id, title: e.title, date, key })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))
}

/** Agrupa por mes ("octubre de 2026") manteniendo el orden (más reciente primero). */
export function byMonth<T extends Pick<Memory, 'date'>>(memories: T[]): { key: string; label: string; items: T[] }[] {
  const fmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
  const sorted = [...memories].sort((a, b) => b.date.localeCompare(a.date))
  const groups: { key: string; label: string; items: T[] }[] = []
  for (const m of sorted) {
    const key = m.date.slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      const [y, mo] = key.split('-').map(Number)
      g = { key, label: fmt.format(new Date(y, mo - 1, 1)), items: [] }
      groups.push(g)
    }
    g.items.push(m)
  }
  return groups
}
