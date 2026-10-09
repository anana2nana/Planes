// Fechas que vencen: documentos y garantías que caducan, suscripciones que se renuevan,
// cartas que se pueden abrir y citas de salud.
// ⚠️ Copia exacta en functions/src/due.ts (avisos de la tarde). Un test comprueba que son iguales.

export const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Días desde hoy hasta una fecha yyyy-mm-dd (negativo = ya pasó). */
export function daysTo(date: string, today: Date): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000)
}

/** Días antes de caducar en que se avisa (y el mismo día). */
export const EXPIRY_LEADS = [60, 30, 7, 0]

export type ExpiryLevel = 'none' | 'ok' | 'soon' | 'urgent' | 'expired'
/** Cómo de cerca está: «pronto» a 2 meses, «urgente» a 2 semanas. */
export function expiryLevel(days: number | null): ExpiryLevel {
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  if (days <= 14) return 'urgent'
  if (days <= 60) return 'soon'
  return 'ok'
}

/** «Caduca en 3 días», «Caducó hace 2 meses»… */
export function expiryText(days: number, verb: [string, string] = ['Caduca', 'Caducó']): string {
  const span = (n: number) => (n < 31 ? `${n} ${n === 1 ? 'día' : 'días'}` : n < 365 ? `${Math.round(n / 30)} ${Math.round(n / 30) === 1 ? 'mes' : 'meses'}` : `${Math.round(n / 365)} ${Math.round(n / 365) === 1 ? 'año' : 'años'}`)
  if (days === 0) return `${verb[0]} hoy`
  if (days === 1) return `${verb[0]} mañana`
  return days > 0 ? `${verb[0]} en ${span(days)}` : `${verb[1]} hace ${span(-days)}`
}

/** Fin de la garantía: la compra + N años (en España, 3 años para productos nuevos). */
export function warrantyEnd(bought: string, years = 3): string {
  const d = parse(bought)
  return ymdOf(new Date(d.getFullYear() + years, d.getMonth(), d.getDate()))
}

export type Period = 'month' | 'quarter' | 'year'
const MONTHS: Record<Period, number> = { month: 1, quarter: 3, year: 12 }

/** Próxima renovación a partir de una fecha de cobro conocida (la misma o la siguiente desde hoy). */
export function nextRenewal(from: string, period: Period, today: Date): string {
  const d = parse(from)
  const t = ymdOf(today)
  for (let i = 0; i < 1200; i++) {
    const target = new Date(d.getFullYear(), d.getMonth() + i * MONTHS[period], 1)
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    const s = ymdOf(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last)))
    if (s >= t) return s
  }
  return from
}

/** Lo que cuesta al mes (para sumar suscripciones de distinto periodo). */
export const monthlyCost = (price: number, period: Period) => price / MONTHS[period]

/** Días antes de una renovación en que se avisa: las anuales con una semana; las demás, solo si se pide. */
export const RENEWAL_LEAD = 7
