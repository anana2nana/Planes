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

/** Tipos que se apuntan aquí; los demás tienen su propio sitio (y las ideas antiguas se mueven allí). */
export const IDEA_OWN: IdeaCategory[] = ['plan', 'otros']
export const MOVED_TO: Partial<Record<IdeaCategory, { collection: 'spots' | 'media' | 'trips'; section: 'sitios' | 'hemeroteca' | 'viajes'; label: string }>> = {
  comer: { collection: 'spots', section: 'sitios', label: 'Sitios' },
  peli: { collection: 'media', section: 'hemeroteca', label: 'Hemeroteca' },
  escapada: { collection: 'trips', section: 'viajes', label: 'Viajes' },
}

/** Una idea antigua convertida al módulo que le toca (mismo id con prefijo: si se repite, no se duplica). */
export function ideaToModule(i: Pick<Idea, 'id' | 'title' | 'category' | 'place' | 'notes' | 'addedBy'>): { collection: 'spots' | 'media' | 'trips'; id: string; data: Record<string, unknown> } | null {
  const target = MOVED_TO[i.category]
  if (!target) return null
  const id = `idea-${i.id}`
  const by = i.addedBy ? { createdBy: i.addedBy } : {}
  if (target.collection === 'spots')
    return { collection: 'spots', id, data: { name: i.title.slice(0, 80), place: i.place, kind: 'restaurante', status: 'want', cuisine: '', price: null, rating: { nita: null, kitos: null }, order: '', notes: i.notes, link: '', visits: [], ...by } }
  if (target.collection === 'media')
    return { collection: 'media', id, data: { kind: /serie/i.test(i.title + i.notes) ? 'serie' : 'peli', title: i.title.slice(0, 120), subtitle: '', cover: null, status: 'want', where: '', recommendedBy: '', progress: '', rating: { nita: null, kitos: null }, comment: i.notes, finishedAt: null, ...by } }
  return { collection: 'trips', id, data: { title: i.title.slice(0, 80), destination: i.place, start: null, end: null, budget: null, bookings: [], packing: [], expenses: [], notes: i.notes, ...by } }
}
