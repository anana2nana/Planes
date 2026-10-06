// Planes que se repiten ciertos días de la semana (p. ej. martes y sábados).
//
// Modelo: cada repetición es un plan normal. Al completar uno que se repite,
// se crea automáticamente el siguiente (con `spawnedFrom` apuntando al anterior).
// Así el historial queda en "Hechos" y los recordatorios funcionan igual.

/** Días de la semana como los da Date#getDay(): 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Orden de la semana en España (lunes primero). */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]

export const DAY_SHORT: Record<Weekday, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 0: 'D' }
export const DAY_NAME: Record<Weekday, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  0: 'domingo',
}
const DAY_ABBR: Record<Weekday, string> = { 1: 'lun', 2: 'mar', 3: 'mié', 4: 'jue', 5: 'vie', 6: 'sáb', 0: 'dom' }

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Misma hora del día que `time`, en la fecha `day`. */
function withTimeOf(day: Date, time: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.getHours(), time.getMinutes(), time.getSeconds())
}

/** Primer día (desde `from`, incluido si `inclusive`) que cae en uno de `days`. */
function nextMatchingDay(from: Date, days: number[], inclusive: boolean): Date | null {
  if (days.length === 0) return null
  const start = startOfDay(from)
  for (let i = inclusive ? 0 : 1; i <= 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    if (days.includes(d.getDay())) return d
  }
  return null
}

/**
 * Siguiente vez que toca un plan repetido, al completarlo.
 * - Si se completa a tiempo (o antes): el siguiente día de repetición después de su fecha.
 * - Si estaba vencido: el primer día de repetición a partir de hoy (no se acumulan atrasos).
 * Mantiene la hora del plan original.
 */
export function nextOccurrence(due: Date, days: number[], now = new Date()): Date | null {
  const overdue = startOfDay(due).getTime() < startOfDay(now).getTime()
  const day = overdue ? nextMatchingDay(now, days, true) : nextMatchingDay(due, days, false)
  return day ? withTimeOf(day, due) : null
}

/** Primera fecha para un plan nuevo que se repite: hoy si toca hoy, si no el siguiente día que toque. */
export function firstOccurrence(days: number[], now = new Date()): Date | null {
  return nextMatchingDay(now, days, true)
}

/** Repeticiones futuras (sin contar `due`) hasta `until`, para pintarlas en el calendario. */
export function upcomingOccurrences(due: Date, days: number[], until: Date, max = 60): Date[] {
  const out: Date[] = []
  if (days.length === 0) return out
  let cursor = due
  while (out.length < max) {
    const day = nextMatchingDay(cursor, days, false)
    if (!day || day.getTime() > until.getTime()) break
    const occ = withTimeOf(day, due)
    out.push(occ)
    cursor = occ
  }
  return out
}

/** "Todos los días", "Entre semana", "Martes y sábados", "Lun, mié y vie"… */
export function describeRepeat(days: number[]): string {
  const set = new Set(days)
  if (set.size === 7) return 'Todos los días'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Entre semana'
  if (set.size === 2 && set.has(6) && set.has(0)) return 'Fines de semana'
  const ordered = WEEK_ORDER.filter((d) => set.has(d))
  if (ordered.length === 1) return `Cada ${DAY_NAME[ordered[0]]}`
  const names = ordered.map((d) => (ordered.length <= 2 ? `${DAY_NAME[d]}s`.replace('ss', 's') : DAY_ABBR[d]))
  const text = `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Clave yyyymmdd (hora local) para enlazar las dos copias de un plan duplicado que se repite. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

