import type { PlaceInfo } from './types'

export type IdeaCategory = 'comer' | 'escapada' | 'peli' | 'plan' | 'otros'

export const IDEA_CATEGORIES: Record<IdeaCategory, { label: string; emoji: string }> = {
  comer: { label: 'Comer', emoji: '🍽️' },
  escapada: { label: 'Escapada', emoji: '✈️' },
  peli: { label: 'Peli o serie', emoji: '🎬' },
  plan: { label: 'Plan', emoji: '🎟️' },
  otros: { label: 'Otros', emoji: '✨' },
}
export const IDEA_ORDER: IdeaCategory[] = ['comer', 'escapada', 'peli', 'plan', 'otros']

export interface Idea {
  id: string
  title: string
  category: IdeaCategory
  place: PlaceInfo | null
  notes: string
  done: boolean
  addedBy: 'nita' | 'kitos' | null
  createdAt: number
  doneAt: number | null
}

/** Elige una idea al azar (sin repetir la anterior si hay más de una). */
export function pickRandom<T extends { id: string }>(list: T[], previousId?: string | null, rnd = Math.random): T | null {
  if (list.length === 0) return null
  const pool = list.length > 1 && previousId ? list.filter((i) => i.id !== previousId) : list
  return pool[Math.floor(rnd() * pool.length)]
}
