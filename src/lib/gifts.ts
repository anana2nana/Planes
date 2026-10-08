// Ideas de regalo secretas: ocasiones y cuándo caen. Sin dependencias: se copia
// tal cual en functions/src/gifts.ts (un test comprueba que son idénticos).

export type GiftOccasion = 'cumple' | 'aniversario' | 'reyes' | 'sanvalentin' | 'otra'
export type GiftStatus = 'idea' | 'comprado' | 'regalado'

export const OCCASIONS: Record<GiftOccasion, { label: string; emoji: string }> = {
  cumple: { label: 'Cumpleaños', emoji: '🎂' },
  aniversario: { label: 'Aniversario', emoji: '💞' },
  reyes: { label: 'Reyes', emoji: '👑' },
  sanvalentin: { label: 'San Valentín', emoji: '💘' },
  otra: { label: 'Cuando sea', emoji: '🎁' },
}
export const OCCASION_ORDER: GiftOccasion[] = ['cumple', 'aniversario', 'reyes', 'sanvalentin', 'otra']

export const STATUS: Record<GiftStatus, { label: string; next: GiftStatus }> = {
  idea: { label: 'Idea', next: 'comprado' },
  comprado: { label: 'Comprado', next: 'regalado' },
  regalado: { label: 'Regalado', next: 'idea' },
}

export interface Gift {
  id: string
  owner: 'nita' | 'kitos'
  title: string
  occasion: GiftOccasion
  url: string
  price: number | null
  notes: string
  status: GiftStatus
  createdAt: number
}

export interface UpcomingOccasion {
  id: Exclude<GiftOccasion, 'otra'>
  /** yyyy-mm-dd de la próxima vez (hoy incluido). */
  date: string
  days: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Próxima fecha (hoy o después) de un día del año "MM-DD"; el 29-F cae el 28 en años no bisiestos. */
export function nextYearly(monthDay: string, today: Date): { date: string; days: number } {
  const [m, d] = monthDay.split('-').map(Number)
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const t = Date.UTC(y, m - 1, Math.min(d, last))
    if (t >= t0) return { date: ymd(new Date(y, m - 1, Math.min(d, last))), days: Math.round((t - t0) / 86_400_000) }
  }
  throw new Error('inalcanzable')
}

/**
 * Las próximas ocasiones para regalar a la pareja, de la más cercana a la más lejana.
 * `partnerBirthday` es "MM-DD"; `since` es "yyyy-mm-dd" (desde cuándo estáis juntos).
 */
export function upcomingOccasions(partnerBirthday: string | null, since: string | null, today: Date): UpcomingOccasion[] {
  const out: UpcomingOccasion[] = []
  if (partnerBirthday) out.push({ id: 'cumple', ...nextYearly(partnerBirthday, today) })
  if (since) out.push({ id: 'aniversario', ...nextYearly(since.slice(5), today) })
  out.push({ id: 'reyes', ...nextYearly('01-06', today) })
  out.push({ id: 'sanvalentin', ...nextYearly('02-14', today) })
  return out.sort((a, b) => a.days - b.days)
}

/** Con cuántos días de antelación se avisa de cada ocasión. */
export const GIFT_LEADS = [21, 7]
