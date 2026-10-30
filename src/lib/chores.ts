// Reto de tareas: cada uno apunta lo que hace en casa, cada tarea vale unos puntos de esfuerzo
// (acordados entre los dos) y los domingos se ve la clasificación. Puro y testeado (tests/chores.test.ts).
// ⚠️ Copia exacta en functions/src/chores.ts (aviso de los domingos). Un test comprueba que son iguales.

export type Who = 'nita' | 'kitos'

export interface Chore {
  id: string
  name: string
  emoji: string
  /** Esfuerzo de 1 a 5: los puntos que suma cada vez. */
  points: number
  /** Si el otro ya ha dicho que vale (si no, cuenta igual, pero sale como "pendiente de acuerdo"). */
  agreed: boolean
  /** Quién puso (o cambió) los puntos por última vez: el otro es quien tiene que aceptarlos. */
  proposedBy: Who
}

export interface ChoreLog {
  id: string
  choreId: string
  by: Who
  /** yyyy-mm-dd */
  date: string
  /** Puntos que valía al apuntarla (por si luego se borra la tarea). */
  points: number
}

export const EFFORT: Record<number, string> = { 1: 'Rápida', 2: 'Normal', 3: 'Pesada', 4: 'Muy pesada', 5: 'Durísima' }

/** Para empezar: tareas típicas de casa con un esfuerzo razonable (se cambian entre los dos). */
export const STARTER_CHORES: { name: string; emoji: string; points: number }[] = [
  { name: 'Fregar / lavavajillas', emoji: '🍽️', points: 1 },
  { name: 'Cocinar', emoji: '🍳', points: 2 },
  { name: 'Poner lavadora', emoji: '🧺', points: 1 },
  { name: 'Tender / recoger ropa', emoji: '👕', points: 1 },
  { name: 'Planchar', emoji: '♨️', points: 2 },
  { name: 'Sacar la basura', emoji: '🗑️', points: 1 },
  { name: 'Aspirar', emoji: '🧹', points: 2 },
  { name: 'Fregar el suelo', emoji: '🪣', points: 3 },
  { name: 'Limpiar el baño', emoji: '🚽', points: 3 },
  { name: 'Limpiar la cocina a fondo', emoji: '🧽', points: 3 },
  { name: 'Cambiar sábanas', emoji: '🛏️', points: 2 },
  { name: 'Hacer la compra', emoji: '🛒', points: 2 },
  { name: 'Arenero de la gata', emoji: '🐱', points: 1 },
]

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** De lunes a domingo, la semana de `d`. */
export function weekRange(d: Date): { from: string; to: string } {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return { from: ymd(monday), to: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)) }
}

/** Del 1 al último día del mes de `d`. */
export function monthRange(d: Date): { from: string; to: string } {
  return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }
}

export const monthName = (d: Date) => new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(d)

export interface Score {
  nita: number
  kitos: number
  /** Cuántas veces ha apuntado algo cada uno. */
  times: Record<Who, number>
}

/** Puntos de cada uno entre dos fechas (incluidas). Cuentan los puntos actuales de cada tarea (los acordados). */
export function score(chores: Pick<Chore, 'id' | 'points'>[], logs: Pick<ChoreLog, 'choreId' | 'by' | 'date' | 'points'>[], from: string, to: string): Score {
  const pts = new Map(chores.map((c) => [c.id, c.points]))
  const out: Score = { nita: 0, kitos: 0, times: { nita: 0, kitos: 0 } }
  for (const l of logs) {
    if (l.date < from || l.date > to) continue
    out[l.by] += pts.get(l.choreId) ?? l.points ?? 1
    out.times[l.by]++
  }
  return out
}

/** "Nita va delante por 5 puntos" · "Empate a 12" · "Aún no hay nada apuntado". */
export function leaderText(s: Pick<Score, 'nita' | 'kitos'>, names: Record<Who, string>, done = false): string {
  if (s.nita === 0 && s.kitos === 0) return 'Aún no hay nada apuntado'
  if (s.nita === s.kitos) return done ? `¡Empate a ${s.nita}! Ganáis los dos 🤝` : `Empate a ${s.nita}`
  const lead: Who = s.nita > s.kitos ? 'nita' : 'kitos'
  const diff = Math.abs(s.nita - s.kitos)
  return done ? `¡Gana ${names[lead]} por ${diff} ${diff === 1 ? 'punto' : 'puntos'}! 🏆` : `${names[lead]} va delante por ${diff} ${diff === 1 ? 'punto' : 'puntos'}`
}

/** Resultados de los meses anteriores (del más reciente al más antiguo), solo los que tienen algo. */
export function pastMonths(chores: Pick<Chore, 'id' | 'points'>[], logs: Pick<ChoreLog, 'choreId' | 'by' | 'date' | 'points'>[], today: Date, n = 6) {
  const out: { key: string; label: string; score: Score }[] = []
  for (let i = 1; i <= n; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const r = monthRange(d)
    const s = score(chores, logs, r.from, r.to)
    if (s.nita + s.kitos > 0) out.push({ key: r.from.slice(0, 7), label: `${monthName(d)} ${d.getFullYear()}`, score: s })
  }
  return out
}
