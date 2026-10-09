// Contador de "días juntos" y días especiales (aniversario, cifras redondas).
// La misma lógica está en functions/src/logic.ts (specialDay) para el resumen de la mañana.

const DAY = 86_400_000

/** Días naturales desde `since` (yyyy-mm-dd) hasta hoy (hora local). */
export function daysTogether(since: string, now = new Date()): number {
  const [y, m, d] = since.split('-').map(Number)
  const a = Date.UTC(y, m - 1, d)
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((b - a) / DAY)
}

/** Texto si hoy es un día especial: aniversario o múltiplo de 100 días. */
export function specialDay(since: string, now = new Date()): string | null {
  const [y, m, d] = since.split('-').map(Number)
  const years = now.getFullYear() - y
  if (years > 0 && now.getMonth() === m - 1 && now.getDate() === d) return `🎉 ¡Hoy hacéis ${years} ${years === 1 ? 'año' : 'años'} juntos!`
  const days = daysTogether(since, now)
  if (days > 0 && days % 100 === 0) return `💞 ¡Hoy hacéis ${days.toLocaleString('es-ES', { useGrouping: 'always' })} días juntos!`
  return null
}

/** Tiempo juntos desglosado: años, meses, semanas y días (como se cuenta en persona). */
export function togetherBreakdown(since: string, now = new Date()): { years: number; months: number; weeks: number; days: number } {
  const [y, m, d] = since.split('-').map(Number)
  let years = now.getFullYear() - y
  let months = now.getMonth() - (m - 1)
  let days = now.getDate() - d
  if (days < 0) {
    months--
    // Días del mes anterior al actual.
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years--
    months += 12
  }
  if (years < 0) return { years: 0, months: 0, weeks: 0, days: 0 }
  return { years, months, weeks: Math.floor(days / 7), days: days % 7 }
}

/** "3 años, 2 meses, 1 semana y 4 días" (sin las partes a cero). */
export function togetherText(b: ReturnType<typeof togetherBreakdown>): string {
  const parts = [
    b.years && `${b.years} ${b.years === 1 ? 'año' : 'años'}`,
    b.months && `${b.months} ${b.months === 1 ? 'mes' : 'meses'}`,
    b.weeks && `${b.weeks} ${b.weeks === 1 ? 'semana' : 'semanas'}`,
    b.days && `${b.days} ${b.days === 1 ? 'día' : 'días'}`,
  ].filter(Boolean) as string[]
  if (parts.length === 0) return 'Hoy empieza todo 💞'
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

/** Días hasta el próximo aniversario (0 = hoy) y cuántos años se cumplen. */
export function nextAnniversary(since: string, now = new Date()): { days: number; years: number } {
  const [y, m, d] = since.split('-').map(Number)
  const t0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  let year = now.getFullYear()
  if (Date.UTC(year, m - 1, d) < t0) year++
  return { days: Math.round((Date.UTC(year, m - 1, d) - t0) / 86_400_000), years: year - y }
}
