// Todo lo que tiene fecha en los módulos (viajes, papeles, cobros, mantenimiento, la gata,
// médico, cartas…) para verlo en el calendario sin copiarlo. Puro y testeado (tests/timeline.test.ts).

import { nextRenewal, type Period } from './due.ts'
import { nextDue, type CareItem } from './pet.ts'
import type { PersonId } from './types'

export type TimelineArea = 'hogar' | 'bienestar' | 'nosotros'
export interface TimelineItem {
  /** yyyy-mm-dd */
  date: string
  emoji: string
  title: string
  detail: string
  area: TimelineArea
  section: string
  /** Para no repetir (y como key). */
  key: string
}

export interface TimelineSources {
  trips: { id: string; title: string; start: string | null; end: string | null }[]
  papers: { id: string; title: string; kind: string; owner: string; expires: string | null }[]
  subs: { id: string; name: string; price: number; period: Period; from: string; active: boolean; remind: boolean }[]
  upkeep: (Pick<CareItem, 'id' | 'title' | 'every' | 'last'> & { area: 'casa' | 'coche' })[]
  petCare: Pick<CareItem, 'id' | 'title' | 'every' | 'last'>[]
  petName: string
  /** Solo los de quien mira (son privados). */
  health: { id: string; title: string; kind: string; date: string | null; next: string | null }[]
  capsules: { id: string; from: PersonId; to: string; openAt: string; title: string }[]
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (s: string, n: number) => {
  const d = parse(s)
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}
const NAME: Record<PersonId, string> = { nita: 'Nita', kitos: 'Kitos' }
const PAPER: Record<string, string> = { garantia: '🧾', documento: '🪪', seguro: '🛡️', coche: '🚗', contrato: '📄' }
const HEALTH: Record<string, string> = { cita: '🩺', revision: '🦷', vacuna: '💉', analitica: '🧪', medicacion: '💊' }

/** Lo que cae entre `from` y `to` (yyyy-mm-dd, ambos incluidos), visto por `me`. */
export function timelineItems(src: TimelineSources, me: PersonId, from: string, to: string, today: Date): TimelineItem[] {
  const out: TimelineItem[] = []
  const inRange = (d: string | null): d is string => !!d && d >= from && d <= to
  const push = (i: TimelineItem) => inRange(i.date) && out.push(i)

  // Viajes: cada día del viaje (como mucho 60).
  for (const t of src.trips) {
    if (!t.start) continue
    const end = t.end && t.end >= t.start ? t.end : t.start
    for (let i = 0, d = t.start; d <= end && i < 60; i++, d = addDays(d, 1)) {
      if (d < from || d > to) continue
      push({ date: d, emoji: '✈️', title: t.title, detail: d === t.start ? (end === t.start ? 'Viaje' : 'Salida') : d === end ? 'Vuelta' : `Día ${i + 1} del viaje`, area: 'nosotros', section: 'viajes', key: `trip-${t.id}-${d}` })
    }
  }

  for (const p of src.papers) {
    if (!p.expires) continue
    const whose = p.owner === 'nita' || p.owner === 'kitos' ? ` de ${NAME[p.owner]}` : ''
    push({ date: p.expires, emoji: PAPER[p.kind] ?? '📎', title: p.kind === 'garantia' ? `Acaba la garantía: ${p.title}` : `Caduca: ${p.title}${whose}`, detail: 'Papeles', area: 'hogar', section: 'papeles', key: `paper-${p.id}` })
  }

  // Cobros: los anuales y trimestrales siempre; los mensuales solo si se pidió aviso (si no, llenarían cada mes).
  for (const s of src.subs) {
    if (!s.active || (s.period === 'month' && !s.remind)) continue
    let d = nextRenewal(s.from, s.period, parse(from))
    for (let i = 0; i < 24 && d <= to; i++) {
      push({ date: d, emoji: '💳', title: `Se cobra ${s.name}`, detail: s.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }), area: 'hogar', section: 'suscripciones', key: `sub-${s.id}-${d}` })
      d = nextRenewal(s.from, s.period, parse(addDays(d, 1)))
    }
  }

  // Lo que toca cada cierto tiempo: la próxima vez (lo atrasado, hoy).
  const t0 = ymd(today)
  for (const u of src.upkeep) {
    if (!u.last) continue
    const due = nextDue(u, today)
    push({ date: due < t0 ? t0 : due, emoji: u.area === 'casa' ? '🧰' : '🚗', title: u.title, detail: due < t0 ? 'Pendiente' : u.area === 'casa' ? 'Mantenimiento' : 'El coche', area: 'hogar', section: u.area === 'casa' ? 'mantenimiento' : 'coche', key: `upkeep-${u.id}` })
  }
  for (const c of src.petCare) {
    if (!c.last) continue
    const due = nextDue(c, today)
    push({ date: due < t0 ? t0 : due, emoji: '🐱', title: c.title, detail: due < t0 ? `${src.petName || 'La gata'} · pendiente` : src.petName || 'La gata', area: 'hogar', section: 'gata', key: `pet-${c.id}` })
  }

  for (const h of src.health) {
    if (h.date) push({ date: h.date, emoji: HEALTH[h.kind] ?? '📋', title: h.title, detail: 'Médico · solo tú', area: 'bienestar', section: 'medico', key: `health-${h.id}` })
    if (h.next && h.next !== h.date) push({ date: h.next, emoji: HEALTH[h.kind] ?? '📋', title: `${h.title} (próxima)`, detail: 'Médico · solo tú', area: 'bienestar', section: 'medico', key: `health-next-${h.id}` })
  }

  for (const c of src.capsules) {
    if (c.from === me) push({ date: c.openAt, emoji: '📬', title: `Se abre tu carta${c.title ? `: ${c.title}` : ''}`, detail: 'Cápsula del tiempo', area: 'nosotros', section: 'capsula', key: `cap-${c.id}` })
    else if (c.to === me || c.to === 'both') push({ date: c.openAt, emoji: '💌', title: `Carta de ${NAME[c.from]}`, detail: 'Ya se puede abrir', area: 'nosotros', section: 'capsula', key: `cap-${c.id}` })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'es'))
}
