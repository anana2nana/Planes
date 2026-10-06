// Repeticiones: ciertos días de la semana (gimnasio martes y sábados) o cada año (cumpleaños).
//
// ⚠️ Este archivo está copiado tal cual en functions/src/recurrence.ts (el servidor
// lo usa para pasar las citas repetidas a su siguiente fecha). Si lo cambias, cambia los dos.
//
// Modelo:
// - Planes y tareas: cada repetición es un documento. Al completar uno, se crea el
//   siguiente (con `spawnedFrom` apuntando al anterior); con turnos, el siguiente es
//   para la otra persona.
// - Citas: no se completan. Cuando pasa su fecha, el servidor la mueve a la siguiente.

/** Días de la semana como los da Date#getDay(): 0 = domingo … 6 = sábado. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Repeat {
  /** Días de la semana (si no es anual). */
  days: number[]
  /** Cada año, el mismo día (cumpleaños, aniversarios). */
  yearly: boolean
  /** Turnos: cada repetición le toca a la otra persona. */
  rotate: boolean
}

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

/** Lee una repetición guardada en Firestore (o null si no se repite). */
export function parseRepeat(raw: unknown): Repeat | null {
  const r = raw as Partial<Repeat> | null | undefined
  if (!r) return null
  const days = Array.isArray(r.days) ? r.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : []
  const yearly = r.yearly === true
  if (!yearly && days.length === 0) return null
  return { days: yearly ? [] : days, yearly, rotate: !yearly && r.rotate === true }
}

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

/** El mismo día y hora `years` años después (29 feb → 28 feb en años no bisiestos). */
function addYears(d: Date, years: number): Date {
  const y = d.getFullYear() + years
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate()
  return new Date(y, d.getMonth(), Math.min(d.getDate(), lastDay), d.getHours(), d.getMinutes(), d.getSeconds())
}

/**
 * Siguiente vez que toca algo repetido (al completarlo, o cuando pasa una cita).
 * - A tiempo (o antes): la siguiente repetición después de su fecha.
 * - Si ya pasó su día: la primera repetición a partir de hoy (no se acumulan atrasos).
 * Mantiene la hora original.
 */
export function nextOccurrence(due: Date, repeat: Repeat, now = new Date()): Date | null {
  const overdue = startOfDay(due).getTime() < startOfDay(now).getTime()
  if (repeat.yearly) {
    let next = addYears(due, 1)
    for (let n = 2; startOfDay(next).getTime() < startOfDay(now).getTime() && n < 200; n++) next = addYears(due, n)
    return next
  }
  const day = overdue ? nextMatchingDay(now, repeat.days, true) : nextMatchingDay(due, repeat.days, false)
  return day ? withTimeOf(day, due) : null
}

/** Primera fecha para algo nuevo que se repite por días: hoy si toca hoy, si no el siguiente. */
export function firstOccurrence(days: number[], now = new Date()): Date | null {
  return nextMatchingDay(now, days, true)
}

/** Repeticiones futuras (sin contar `due`) hasta `until`, para pintarlas en el calendario. */
export function upcomingOccurrences(due: Date, repeat: Repeat, until: Date, max = 60): Date[] {
  const out: Date[] = []
  if (repeat.yearly) {
    for (let n = 1; out.length < max; n++) {
      const occ = addYears(due, n)
      if (occ.getTime() > until.getTime()) break
      out.push(occ)
    }
    return out
  }
  let cursor = due
  while (out.length < max) {
    const day = nextMatchingDay(cursor, repeat.days, false)
    if (!day || day.getTime() > until.getTime()) break
    const occ = withTimeOf(day, due)
    out.push(occ)
    cursor = occ
  }
  return out
}

/** "Cada año", "Todos los días", "Entre semana", "Martes y sábados", "Lun, mié y vie"… */
export function describeRepeat(repeat: Pick<Repeat, 'days' | 'yearly'>): string {
  if (repeat.yearly) return 'Cada año'
  const set = new Set(repeat.days)
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
