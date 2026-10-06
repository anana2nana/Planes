// Lógica pura (sin Firebase) para decidir qué notificaciones enviar.
// Separada de index.ts para poder probarla con tests.
//
// Las fechas se calculan en hora local: index.ts fija process.env.TZ = 'Europe/Madrid'
// (y los tests se ejecutan con TZ=Europe/Madrid).

import { nextOccurrence, type Repeat } from './recurrence.js'

export type Person = 'nita' | 'kitos'
export type Assignee = Person | 'both'
export type Kind = 'event' | 'plan' | 'task'

export const NAME: Record<Person, string> = { nita: 'Nita', kitos: 'Kitos' }

/** Zona horaria en la que se muestran las fechas de las notificaciones. */
export const TIME_ZONE = 'Europe/Madrid'

export interface PlanData {
  id: string
  kind: Kind
  title: string
  assignee: Assignee
  groupId: string | null
  dueMs: number | null
  allDay: boolean
  done: boolean
  doneBy: Person | null
  createdBy: Person
  remindersSent: string[]
  /** Si es la siguiente repetición creada automáticamente al completar la anterior. */
  spawnedFrom: string | null
  repeat: Repeat | null
  /** Citas: avisar también una semana antes. */
  remindWeekBefore: boolean
}

const NOUN: Record<Kind, string> = { event: 'una cita', plan: 'un plan', task: 'una tarea' }
const WEEK_MIN = 7 * 24 * 60

export interface NotifPrefs {
  /** Avisarme cuando mi pareja crea un plan para mí o completa uno. */
  activity: boolean
  /** Recordatorios antes de la fecha tope. */
  reminders: boolean
  /** Con cuántos minutos de antelación (0 = a la hora). */
  leads: number[]
}

export const DEFAULT_PREFS: NotifPrefs = { activity: true, reminders: true, leads: [60, 1440] }

export interface Push {
  to: Person
  kind: 'activity' | 'reminder'
  title: string
  body: string
  /** Notificaciones con el mismo tag se reemplazan en lugar de apilarse. */
  tag: string
}

export const partnerOf = (p: Person): Person => (p === 'nita' ? 'kitos' : 'nita')

export const targetsOf = (a: Assignee): Person[] => (a === 'both' ? ['nita', 'kitos'] : [a])

export function normalizePrefs(raw: Partial<NotifPrefs> | undefined): NotifPrefs {
  return {
    activity: raw?.activity ?? DEFAULT_PREFS.activity,
    reminders: raw?.reminders ?? DEFAULT_PREFS.reminders,
    leads: Array.isArray(raw?.leads) ? raw.leads.filter((n) => typeof n === 'number' && n >= 0) : DEFAULT_PREFS.leads,
  }
}

// ─── Formato ────────────────────────────────────────────────────────────────

const dayKey = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)

export function formatDue(dueMs: number, allDay: boolean, nowMs: number): string {
  const diffDays = Math.round((Date.parse(dayKey(dueMs)) - Date.parse(dayKey(nowMs))) / 86_400_000)
  const day =
    diffDays === 0
      ? 'hoy'
      : diffDays === 1
        ? 'mañana'
        : new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'short' }).format(dueMs)
  if (allDay) return day
  const time = new Intl.DateTimeFormat('es-ES', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(dueMs)
  return `${day} a las ${time}`
}

export function formatRemaining(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min <= 0) return 'Es ahora'
  if (min < 60) return `Quedan ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? 'Queda 1 hora' : `Quedan ${h} horas`
  const d = Math.round(h / 24)
  return d === 1 ? 'Queda 1 día' : `Quedan ${d} días`
}

// ─── Actividad: crear / completar ───────────────────────────────────────────

/** Qué avisos genera un cambio en un plan (before/after = null si no existía / se borró). */
export function activityPushes(before: PlanData | null, after: PlanData | null, nowMs: number): Push[] {
  if (!after) return []

  // Plan nuevo: avisar a la pareja si le afecta.
  // (La siguiente repetición de un plan que se repite no es un plan "nuevo".)
  if (!before) {
    if (after.spawnedFrom) return []
    const actor = after.createdBy
    const partner = partnerOf(actor)
    if (!targetsOf(after.assignee).includes(partner)) return []
    const noun = NOUN[after.kind]
    const prefix = after.kind === 'event' ? '📅 ' : ''
    const title = after.groupId
      ? `${NAME[actor]} ha creado ${noun} para cada uno`
      : after.assignee === 'both'
        ? `${prefix}${NAME[actor]} ha añadido ${noun} para los dos`
        : after.kind === 'event'
          ? `${prefix}${NAME[actor]} te ha apuntado una cita`
          : `${NAME[actor]} te ha asignado ${noun}`
    const when = after.dueMs !== null ? ` · ${formatDue(after.dueMs, after.allDay, nowMs)}` : ''
    return [{ to: partner, kind: 'activity', title, body: `${after.title}${when}`, tag: `new:${after.groupId ?? after.id}` }]
  }

  // Plan completado: avisar a la pareja.
  if (!before.done && after.done && after.doneBy) {
    const actor = after.doneBy
    const own = after.groupId ? ' su parte de' : ''
    return [
      {
        to: partnerOf(actor),
        kind: 'activity',
        title: `${NAME[actor]} ha completado${own} ${NOUN[after.kind]} ✓`,
        body: after.title,
        tag: `done:${after.id}`,
      },
    ]
  }

  return []
}

// ─── Recordatorios ──────────────────────────────────────────────────────────

/** Un recordatorio "a la hora" solo se envía si no han pasado más de estos minutos. */
export const LATE_GRACE_MIN = 15

/** Hora de referencia de los avisos de una cita de todo el día (cumpleaños): las 9:00. */
export const ALL_DAY_EVENT_HOUR = 9

/**
 * Momento al que se refieren los avisos. Para tareas y planes es la fecha tope;
 * para una cita de todo el día, las 9:00 de ese día (no las 23:59 a las que se guarda).
 */
export function reminderAnchor(plan: Pick<PlanData, 'kind' | 'allDay' | 'dueMs'>): number | null {
  if (plan.dueMs === null) return null
  if (plan.kind !== 'event' || !plan.allDay) return plan.dueMs
  const d = new Date(plan.dueMs)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), ALL_DAY_EVENT_HOUR).getTime()
}

/** Días naturales (en hora local) entre dos instantes. */
function calendarDaysBetween(fromMs: number, toMs: number): number {
  const a = new Date(fromMs)
  const b = new Date(toMs)
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((db - da) / 86_400_000)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Decide qué recordatorios tocan ahora para un plan.
 * Por persona se envía como mucho uno (el de menor antelación que ya aplique),
 * y se marcan como enviados todos los que ya aplican, para no mandar
 * "queda 1 día" a un plan creado 10 minutos antes de su hora.
 */
export function reminderPushes(
  plan: PlanData,
  prefs: Record<Person, NotifPrefs>,
  nowMs: number,
): { pushes: Push[]; markSent: string[] } {
  const pushes: Push[] = []
  const markSent: string[] = []
  const due = reminderAnchor(plan)
  if (plan.done || due === null || plan.dueMs === null) return { pushes, markSent }
  if (nowMs - due > LATE_GRACE_MIN * 60_000) return { pushes, markSent }

  for (const person of targetsOf(plan.assignee)) {
    const p = prefs[person]
    if (!p.reminders) continue
    const leads = plan.kind === 'event' && plan.remindWeekBefore ? [...p.leads, WEEK_MIN] : p.leads
    const applicable = leads.filter((lead) => nowMs >= due - lead * 60_000).sort((a, b) => a - b)
    if (applicable.length === 0) continue
    const keys = applicable.map((lead) => `${person}:${lead}`)
    const fresh = keys.filter((k) => !plan.remindersSent.includes(k))
    if (fresh.length === 0) continue
    markSent.push(...fresh)
    // Solo enviamos si el más próximo aún no se había enviado.
    if (fresh.includes(keys[0])) {
      if (plan.kind === 'event') {
        // Citas: "🎂 Cumple de Laura" · "Dentro de 7 días · domingo, 18 oct"
        const days = calendarDaysBetween(nowMs, plan.dueMs)
        const when = capitalize(formatDue(plan.dueMs, plan.allDay, nowMs))
        pushes.push({
          to: person,
          kind: 'reminder',
          title: `${plan.repeat?.yearly ? '🎂' : '📅'} ${plan.title}`,
          body: days >= 2 ? `Dentro de ${days} días · ${when}` : when,
          tag: `due:${plan.id}`,
        })
      } else {
        pushes.push({
          to: person,
          kind: 'reminder',
          title: `⏰ ${formatRemaining(due - nowMs)}`,
          body: `${plan.title} · ${formatDue(due, plan.allDay, nowMs)}`,
          tag: `due:${plan.id}`,
        })
      }
    }
  }
  return { pushes, markSent }
}

// ─── Citas que se repiten ───────────────────────────────────────────────────

/**
 * Si una cita repetida (cumpleaños, clase semanal…) ya pasó, devuelve su siguiente fecha.
 * Así los avisos funcionan cada año/semana aunque nadie abra la app.
 */
export function rolloverDue(plan: Pick<PlanData, 'kind' | 'repeat' | 'dueMs' | 'allDay'>, nowMs: number): number | null {
  if (plan.kind !== 'event' || !plan.repeat || plan.dueMs === null) return null
  // Las de todo el día terminan al acabar el día (se guardan a las 23:59:59).
  const endMs = plan.dueMs
  if (nowMs - endMs < LATE_GRACE_MIN * 60_000) return null
  const next = nextOccurrence(new Date(plan.dueMs), plan.repeat, new Date(nowMs))
  return next ? next.getTime() : null
}
