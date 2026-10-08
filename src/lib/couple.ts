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
