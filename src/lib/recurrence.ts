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
  /** Cada cuántas semanas (1 = todas, 2 = una sí y otra no). Sin dato = 1. */
  every?: number
  /** Cada N meses (1, 3 o 6), el mismo día del mes. Sin dato = por días de la semana. */
  months?: number
}

export const MONTH_OPTIONS = [1, 3, 6] as const

/** Cada cuántas semanas se repite (1 o 2). */
export const everyOf = (r: Pick<Repeat, 'every'>) => (r.every === 2 ? 2 : 1)

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
  const rotate = r.rotate === true
  if (!yearly && typeof r.months === 'number' && (MONTH_OPTIONS as readonly number[]).includes(r.months)) return { days: [], yearly: false, rotate, months: r.months }
  if (!yearly && days.length === 0) return null
  if (yearly) return { days: [], yearly: true, rotate }
  return { days: yearly ? [] : days, yearly, rotate: !yearly && r.rotate === true, ...(!yearly && r.every === 2 ? { every: 2 } : {}) }
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

/** El mismo día y hora `months` meses después (31 → último día del mes; 29 feb → 28 feb). */
function addMonths(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay), d.getHours(), d.getMinutes(), d.getSeconds())
}

/** Cada cuántos meses, si se repite por meses (o cada año = 12); null si es por días de la semana. */
const monthStep = (r: Repeat): number | null => (r.yearly ? 12 : r.months ?? null)

/** Semanas entre los lunes de las semanas de `a` y `b` (sin líos con el cambio de hora). */
function weeksBetween(a: Date, b: Date): number {
  const monday = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return Math.round((monday(b) - monday(a)) / (7 * 86_400_000))
}

/** ¿Toca en la semana de `day`? (con "cada 2 semanas", solo en las semanas pares contando desde `anchor`). */
function inPhase(day: Date, anchor: Date, every: number): boolean {
  return every <= 1 || weeksBetween(anchor, day) % every === 0
}

/** Primer día desde `from` (incluido) que cae en `days` y en una semana que toca. */
function nextInPhase(from: Date, days: number[], anchor: Date, every: number): Date | null {
  if (days.length === 0) return null
  const start = startOfDay(from)
  for (let i = 0; i <= 7 * every; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    if (days.includes(d.getDay()) && inPhase(d, anchor, every)) return d
  }
  return null
}

/**
 * Siguiente vez que toca algo repetido (al completarlo, o cuando pasa una cita).
 * - A tiempo (o antes): la siguiente repetición después de su fecha.
 * - Si ya pasó su día: la primera repetición a partir de hoy (no se acumulan atrasos).
 * Mantiene la hora original. `anchor` es el día que tocaba antes de posponerlo:
 * el ritmo (día de la semana y semanas alternas) se cuenta desde ahí, no desde el día pospuesto.
 */
export function nextOccurrence(due: Date, repeat: Repeat, now = new Date(), anchor: Date | null = null): Date | null {
  const base = anchor ?? due
  const overdue = startOfDay(base).getTime() < startOfDay(now).getTime()
  const b = startOfDay(base)
  let from = overdue ? startOfDay(now) : new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1)
  // Si estaba pospuesto, nunca antes (ni el mismo día) que el día al que se pospuso.
  if (anchor && startOfDay(due).getTime() >= from.getTime()) from = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
  const step = monthStep(repeat)
  if (step) {
    // Siempre contando desde el día original (un 31 no se queda en 30 para siempre).
    const at = withTimeOf(base, due)
    for (let k = 1; k < 1200; k++) {
      const next = addMonths(at, k * step)
      if (startOfDay(next).getTime() >= from.getTime()) return next
    }
    return null
  }
  const day = nextInPhase(from, repeat.days, b, everyOf(repeat))
  return day ? withTimeOf(day, due) : null
}

/** Primera fecha para algo nuevo que se repite por días: hoy si toca hoy, si no el siguiente. */
export function firstOccurrence(days: number[], now = new Date()): Date | null {
  return nextMatchingDay(now, days, true)
}

/** Repeticiones futuras (sin contar `due`) hasta `until`, para pintarlas en el calendario. */
export function upcomingOccurrences(due: Date, repeat: Repeat, until: Date, max = 60, anchor: Date | null = null): Date[] {
  const out: Date[] = []
  const step = monthStep(repeat)
  if (step) {
    const at = withTimeOf(anchor ?? due, due)
    for (let k = 1; out.length < max; k++) {
      const occ = addMonths(at, k * step)
      if (occ.getTime() > until.getTime()) break
      if (startOfDay(occ).getTime() > startOfDay(due).getTime()) out.push(occ)
    }
    return out
  }
  const base = startOfDay(anchor ?? due)
  let cursor = new Date(Math.max(base.getTime(), startOfDay(due).getTime()))
  while (out.length < max) {
    const day = nextInPhase(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1), repeat.days, base, everyOf(repeat))
    if (!day || day.getTime() > until.getTime()) break
    out.push(withTimeOf(day, due))
    cursor = day
  }
  return out
}

/** "Cada año", "Todos los días", "Entre semana", "Martes y sábados", "Lun, mié y vie"… (y "cada 2 semanas"). */
export function describeRepeat(repeat: Pick<Repeat, 'days' | 'yearly' | 'every' | 'months'>): string {
  if (repeat.yearly) return 'Cada año'
  if (repeat.months) return repeat.months === 1 ? 'Cada mes' : `Cada ${repeat.months} meses`
  if (everyOf(repeat) === 2) {
    const one = describeRepeat({ days: repeat.days, yearly: false })
    return `${one.startsWith('Cada ') ? one.replace('Cada ', 'Un ') + ' sí y otro no' : `${one}, cada 2 semanas`}`
  }
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
