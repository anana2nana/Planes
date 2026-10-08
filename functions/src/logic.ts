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
  /** Resumen de cada mañana con lo de hoy. */
  digest: boolean
  /** Hora del resumen (0-23, hora de España). */
  digestHour: number
  /** Avisos de la casa (cuota de mañana, actualizar el ahorro). */
  home: boolean
  /** Avisos de regalos: unas semanas antes del cumple de la pareja, aniversario, Reyes… */
  gifts: boolean
}

export const DEFAULT_PREFS: NotifPrefs = { activity: true, reminders: true, leads: [60, 1440], digest: true, digestHour: 8, home: true, gifts: true }

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
    digest: raw?.digest ?? DEFAULT_PREFS.digest,
    digestHour: typeof raw?.digestHour === 'number' && raw.digestHour >= 0 && raw.digestHour <= 23 ? raw.digestHour : DEFAULT_PREFS.digestHour,
    home: raw?.home ?? DEFAULT_PREFS.home,
    gifts: raw?.gifts ?? DEFAULT_PREFS.gifts,
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

/** " (en 27 min)", " (en 2 horas)"… o " (ahora)". */
export function remainingHint(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min <= 0) return ' (ahora)'
  if (min < 60) return ` (en ${min} min)`
  const h = Math.round(min / 60)
  if (h < 24) return h === 1 ? ' (en 1 hora)' : ` (en ${h} horas)`
  return ''
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
        // La notificación no se actualiza sola, así que el texto principal es la HORA
        // (no caduca); "(en 27 min)" es solo orientativo en el momento de llegar.
        const when = capitalize(formatDue(due, plan.allDay, nowMs))
        const hint = plan.allDay ? '' : remainingHint(due - nowMs)
        pushes.push({
          to: person,
          kind: 'reminder',
          title: `⏰ ${plan.title}`,
          body: plan.allDay ? `Vence ${formatDue(due, true, nowMs)}` : `${when}${hint}`,
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

// ─── Resumen del día ────────────────────────────────────────────────────────

const timeOf = (ms: number) => new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(ms)
const EMOJI: Record<Kind, string> = { event: '📅', plan: '💞', task: '🧹' }

/**
 * Resumen de la mañana para una persona: lo de hoy (citas, planes, tareas suyas o de los dos)
 * y cuántas tareas/planes arrastra de días anteriores. null si no hay nada.
 */
export function digestPush(person: Person, plans: PlanData[], nowMs: number, extra: string | null = null): Push | null {
  const now = new Date(nowMs)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const mine = plans.filter((p) => !p.done && p.dueMs !== null && targetsOf(p.assignee).includes(person))
  const today = mine.filter((p) => p.dueMs! >= start && p.dueMs! < end).sort((a, b) => a.dueMs! - b.dueMs!)
  const overdue = mine.filter((p) => p.kind !== 'event' && p.dueMs! < start).length
  if (today.length === 0 && overdue === 0 && !extra) return null

  const MAX = 4
  const parts = today.slice(0, MAX).map((p) => {
    const emoji = p.kind === 'event' && p.repeat?.yearly ? '🎂' : EMOJI[p.kind]
    return `${emoji} ${p.title}${p.allDay ? '' : ` ${timeOf(p.dueMs!)}`}`
  })
  if (today.length > MAX) parts.push(`y ${today.length - MAX} más`)
  const late = overdue ? `⚠️ ${overdue} ${overdue === 1 ? 'pendiente atrasada' : 'pendientes atrasadas'}` : ''
  const body = [extra, parts.length ? parts.join(' · ') : extra ? '' : 'Nada para hoy.', late].filter(Boolean).join('\n')
  return { to: person, kind: 'reminder', title: `☀️ Buenos días, ${NAME[person]}`, body, tag: 'digest' }
}

// ─── Días especiales (misma lógica que src/lib/couple.ts) ───────────────────

/** Texto si hoy es un día especial: aniversario o múltiplo de 100 días juntos. */
export function specialDay(since: string, now: Date): string | null {
  const [y, m, d] = since.split('-').map(Number)
  if (!y || !m || !d) return null
  const years = now.getFullYear() - y
  if (years > 0 && now.getMonth() === m - 1 && now.getDate() === d) return `🎉 ¡Hoy hacéis ${years} ${years === 1 ? 'año' : 'años'} juntos!`
  const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000)
  if (days > 0 && days % 100 === 0) return `💞 ¡Hoy hacéis ${days.toLocaleString('es-ES', { useGrouping: 'always' })} días juntos!`
  return null
}

// ─── Menú de la semana ──────────────────────────────────────────────────────

export interface MealLite {
  slot: 'comida' | 'cena'
  title: string
  eat?: Partial<Record<Person, 'casa' | 'taper' | 'fuera'>>
}

/** Línea del resumen de la mañana con lo que come hoy esa persona (si no come fuera). */
export function mealLine(meals: MealLite[], person: Person): string | null {
  const mine = meals.filter((m) => m.title && m.eat?.[person] !== 'fuera').sort((a, b) => Number(a.slot === 'cena') - Number(b.slot === 'cena'))
  if (mine.length === 0) return null
  return '🍝 ' + mine.map((m) => `${m.slot === 'cena' ? 'Cena' : 'Comida'}: ${m.title}${m.eat?.[person] === 'taper' ? ' (🥡 táper)' : ''}`).join(' · ')
}

/** Domingo por la tarde: si la semana que viene está casi vacía, recordar hacer el menú. */
export function menuReminder(now: Date, plannedNextWeek: number, prefs: Record<Person, NotifPrefs>): Push[] {
  if (now.getDay() !== 0 || plannedNextWeek >= 3) return []
  return (['nita', 'kitos'] as Person[])
    .filter((p) => prefs[p].home)
    .map((p) => ({
      to: p,
      kind: 'reminder' as const,
      title: '🍝 ¿Hacemos el menú de la semana?',
      body: plannedNextWeek === 0 ? 'Aún no hay nada para la semana que viene. Apuntadlo en Comida → Menú y pasad los ingredientes a la compra.' : `Solo hay ${plannedNextWeek} ${plannedNextWeek === 1 ? 'comida apuntada' : 'comidas apuntadas'} para la semana que viene.`,
      tag: 'menu-week',
    }))
}

// ─── Diario ─────────────────────────────────────────────────────────────────

/** "📸 Tal día como hoy, hace un año: Ramen en Lavapiés" (el más reciente), o null. */
export function onThisDayLine(memories: { title: string; date: string }[], now: Date): string | null {
  const md = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const past = memories
    .filter((m) => m.date.slice(5) === md && Number(m.date.slice(0, 4)) < now.getFullYear())
    .sort((a, b) => b.date.localeCompare(a.date))
  if (past.length === 0) return null
  const years = now.getFullYear() - Number(past[0].date.slice(0, 4))
  const more = past.length > 1 ? ` (y ${past.length - 1} más)` : ''
  return `📸 Tal día como hoy, ${years === 1 ? 'hace un año' : `hace ${years} años`}: ${past[0].title}${more}`
}
