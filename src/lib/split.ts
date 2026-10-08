// Reparto de tareas: cuántas ha completado cada uno por mes.

import type { PersonId, Plan } from './types'

export interface MonthSplit {
  /** yyyy-mm */
  key: string
  label: string
  nita: number
  kitos: number
}

const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long' })
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Los últimos `months` meses (el actual primero), contando tareas hechas según quién las marcó. */
export function taskSplit(plans: Pick<Plan, 'kind' | 'done' | 'doneBy' | 'doneAt'>[], now: Date, months = 4): MonthSplit[] {
  const out: MonthSplit[] = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { key: key(d), label: monthFmt.format(d), nita: 0, kitos: 0 }
  })
  const byKey = new Map(out.map((m) => [m.key, m]))
  for (const p of plans) {
    if (p.kind !== 'task' || !p.done || !p.doneBy || !p.doneAt) continue
    const m = byKey.get(key(p.doneAt.toDate()))
    if (m) m[p.doneBy as PersonId]++
  }
  return out
}

/** Frase amable para el mes (sin dramas). */
export function splitMood(m: Pick<MonthSplit, 'nita' | 'kitos'>, names: Record<PersonId, string>): string {
  const total = m.nita + m.kitos
  if (total === 0) return 'Aún no hay tareas hechas este mes'
  const diff = Math.abs(m.nita - m.kitos)
  if (diff === 0 || (total >= 4 && diff <= Math.max(1, total * 0.15))) return '¡Vais a la par! 🤝'
  const lead: PersonId = m.nita > m.kitos ? 'nita' : 'kitos'
  return `${names[lead]} va por delante este mes 💪`
}
