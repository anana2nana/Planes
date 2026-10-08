// Cuidados periódicos de la gata (vacunas, desparasitar…).
// ⚠️ Copia exacta en functions/src/pet.ts (avisos la víspera). Un test comprueba que son iguales.

export type IntervalUnit = 'week' | 'month' | 'year'

export interface CareItem {
  id: string
  title: string
  every: { n: number; unit: IntervalUnit }
  /** Última vez (yyyy-mm-dd), o null si nunca. */
  last: string | null
  /** Fechas anteriores (las más recientes al final). */
  history: string[]
}

export const INTERVALS: { label: string; n: number; unit: IntervalUnit }[] = [
  { label: 'Cada semana', n: 1, unit: 'week' },
  { label: 'Cada mes', n: 1, unit: 'month' },
  { label: 'Cada 3 meses', n: 3, unit: 'month' },
  { label: 'Cada 6 meses', n: 6, unit: 'month' },
  { label: 'Cada año', n: 1, unit: 'year' },
]

/** Cuidados típicos de un gato de casa (para empezar rápido). */
export const TYPICAL_CARE: { title: string; every: CareItem['every'] }[] = [
  { title: 'Vacuna anual', every: { n: 1, unit: 'year' } },
  { title: 'Desparasitación interna', every: { n: 3, unit: 'month' } },
  { title: 'Pipeta (desparasitación externa)', every: { n: 1, unit: 'month' } },
  { title: 'Cambio completo de arena', every: { n: 1, unit: 'week' } },
  { title: 'Cortar uñas', every: { n: 1, unit: 'month' } },
]

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function describeEvery(e: CareItem['every']): string {
  const found = INTERVALS.find((i) => i.n === e.n && i.unit === e.unit)
  if (found) return found.label
  const unit = { week: ['semana', 'semanas'], month: ['mes', 'meses'], year: ['año', 'años'] }[e.unit]
  return `Cada ${e.n} ${e.n === 1 ? unit[0] : unit[1]}`
}

/** Próxima fecha (yyyy-mm-dd): la última + el intervalo (fin de mes ajustado). Sin última vez → hoy. */
export function nextDue(item: Pick<CareItem, 'every' | 'last'>, today: Date): string {
  if (!item.last) return ymd(today)
  const d = parse(item.last)
  if (item.every.unit === 'week') return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * item.every.n))
  const months = item.every.unit === 'year' ? 12 * item.every.n : item.every.n
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return ymd(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)))
}

/** Días hasta la próxima vez (negativo = atrasado). */
export function daysUntil(date: string, today: Date): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - a) / 86_400_000)
}

/** "2 años y 3 meses", "5 meses", "3 semanas". */
export function ageText(birth: string, today: Date): string {
  const b = parse(birth)
  let months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth())
  if (today.getDate() < b.getDate()) months--
  if (months < 1) {
    const w = Math.max(0, Math.floor(daysUntil(ymd(today), b) / 7))
    return `${w} ${w === 1 ? 'semana' : 'semanas'}`
  }
  const y = Math.floor(months / 12)
  const m = months % 12
  const ys = y ? `${y} ${y === 1 ? 'año' : 'años'}` : ''
  const ms = m ? `${m} ${m === 1 ? 'mes' : 'meses'}` : ''
  return [ys, ms].filter(Boolean).join(' y ')
}
