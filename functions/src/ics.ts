// Feed iCal (.ics) para suscribirse desde Google Calendar. Puro y testeado.

import type { Person, PlanData } from './logic.js'

export interface IcsPlan extends PlanData {
  notes: string
  place: { name: string; address: string } | null
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const WHO: Record<string, string> = { nita: 'Nita', kitos: 'Kitos', both: 'Los dos' }
const EMOJI = { event: '📅', plan: '💞', task: '🧹' } as const

const pad = (n: number) => String(n).padStart(2, '0')
/** Fecha local (hora de España en el servidor) como 20261008. */
const localDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
/** Instante en UTC como 20261008T170000Z. */
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Escapa el texto según RFC 5545 (comas, punto y coma, barras y saltos de línea). */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Corta las líneas a 75 octetos (las siguientes empiezan con un espacio), sin partir caracteres UTF-8. */
export function fold(line: string): string {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = Buffer.byteLength(ch)
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n ')
}

/** Qué entra en el calendario de cada uno: citas siempre; planes y tareas pendientes con fecha. */
export function feedPlans(plans: IcsPlan[], who: Person | null): IcsPlan[] {
  const seen = new Set<string>()
  return plans.filter((p) => {
    if (p.dueMs === null) return false
    if (p.done && p.kind !== 'event') return false
    if (who && p.assignee !== who && p.assignee !== 'both') return false
    // Las copias duplicadas (una para cada uno) salen una sola vez en el calendario común.
    if (!who && p.groupId) {
      if (seen.has(p.groupId)) return false
      seen.add(p.groupId)
    }
    return true
  })
}

export function buildIcs(plans: IcsPlan[], nowMs: number, calName = 'Nitakitos'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nitakitos//Planes//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
    'X-WR-TIMEZONE:Europe/Madrid',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  for (const p of plans) {
    if (p.dueMs === null) continue
    const start = new Date(p.dueMs)
    lines.push('BEGIN:VEVENT', `UID:${p.id}@nitakitos`, `DTSTAMP:${utc(nowMs)}`)
    if (p.allDay) {
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1)
      lines.push(`DTSTART;VALUE=DATE:${localDate(start)}`, `DTEND;VALUE=DATE:${localDate(end)}`)
    } else {
      lines.push(`DTSTART:${utc(p.dueMs)}`, `DTEND:${utc(p.dueMs + 60 * 60_000)}`)
    }
    // Solo las citas llevan repetición: los planes y tareas crean su siguiente al completarse.
    if (p.kind === 'event' && p.repeat) {
      if (p.repeat.yearly) lines.push('RRULE:FREQ=YEARLY')
      else if (p.repeat.days.length > 0) lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${[...p.repeat.days].sort().map((d) => DAYS[d]).join(',')}`)
    }
    const prefix = p.kind === 'event' ? '' : `${EMOJI[p.kind]} `
    lines.push(`SUMMARY:${escapeText(prefix + p.title)}`)
    const desc = [`Para: ${WHO[p.assignee] ?? 'Los dos'}`, p.notes.trim()].filter(Boolean).join('\n')
    lines.push(`DESCRIPTION:${escapeText(desc)}`)
    if (p.place) lines.push(`LOCATION:${escapeText([p.place.name, p.place.address].filter(Boolean).join(', '))}`)
    lines.push('TRANSP:' + (p.kind === 'event' ? 'OPAQUE' : 'TRANSPARENT'), 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
