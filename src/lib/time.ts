import type { Plan } from './types'

/** A partir de cuánto tiempo un plan se considera "cercano" y muestra cuenta atrás. */
export const NEAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

export function dueMillis(plan: Pick<Plan, 'dueAt'>): number | null {
  return plan.dueAt ? plan.dueAt.toMillis() : null
}

export type Urgency = 'overdue' | 'critical' | 'soon' | 'near' | 'far' | 'none'

export function urgencyOf(diffMs: number | null): Urgency {
  if (diffMs === null) return 'none'
  if (diffMs < 0) return 'overdue'
  if (diffMs < 6 * MS.h) return 'critical'
  if (diffMs < 2 * MS.d) return 'soon'
  if (diffMs < NEAR_WINDOW_MS) return 'near'
  return 'far'
}

export interface Parts {
  d: number
  h: number
  m: number
  s: number
}

export function splitDuration(ms: number): Parts {
  const abs = Math.abs(ms)
  return {
    d: Math.floor(abs / MS.d),
    h: Math.floor((abs % MS.d) / MS.h),
    m: Math.floor((abs % MS.h) / MS.m),
    s: Math.floor((abs % MS.m) / MS.s),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "2d 04:12:09" · "04:12:09" · "12:09" */
export function formatCountdown(ms: number): string {
  const { d, h, m, s } = splitDuration(ms)
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

/** "en 3 días", "hace 2 h"… */
export function formatRelative(ms: number): string {
  const { d, h, m } = splitDuration(ms)
  const amount = d > 0 ? `${d} ${d === 1 ? 'día' : 'días'}` : h > 0 ? `${h} h` : m > 0 ? `${m} min` : 'un momento'
  return ms >= 0 ? `en ${amount}` : `hace ${amount}`
}

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function formatDue(date: Date, allDay: boolean, now = Date.now()): string {
  const days = Math.round((startOfDay(date) - startOfDay(new Date(now))) / MS.d)
  const day =
    days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : days === -1 ? 'Ayer' : capitalize(dayFmt.format(date).replace('.', ''))
  return allDay ? day : `${day} · ${timeFmt.format(date)}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Convierte los inputs del formulario en una fecha. Sin hora = final del día. */
export function draftToDate(dueDate: string, dueTime: string): { date: Date | null; allDay: boolean } {
  if (!dueDate) return { date: null, allDay: false }
  const [y, mo, d] = dueDate.split('-').map(Number)
  if (dueTime) {
    const [h, mi] = dueTime.split(':').map(Number)
    return { date: new Date(y, mo - 1, d, h, mi), allDay: false }
  }
  return { date: new Date(y, mo - 1, d, 23, 59, 59), allDay: true }
}

export function dateToDraft(date: Date | null, allDay: boolean): { dueDate: string; dueTime: string } {
  if (!date) return { dueDate: '', dueTime: '' }
  const dueDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return { dueDate, dueTime: allDay ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}` }
}
