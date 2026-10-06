import type { Assignee, AssignMode, PersonId } from './types'

export interface PersonMeta {
  id: Assignee | 'duplicate'
  name: string
  short: string
  initials: string
  /** Clases Tailwind (deben ser literales completos para que Tailwind las genere). */
  solid: string
  soft: string
  text: string
  ring: string
}

export const PEOPLE: Record<AssignMode, PersonMeta> = {
  nita: {
    id: 'nita',
    name: 'Nita',
    short: 'Yo',
    initials: 'N',
    solid: 'bg-nita',
    soft: 'bg-nita-soft',
    text: 'text-nita',
    ring: 'ring-nita',
  },
  kitos: {
    id: 'kitos',
    name: 'Kitos',
    short: 'Él',
    initials: 'K',
    solid: 'bg-kitos',
    soft: 'bg-kitos-soft',
    text: 'text-kitos',
    ring: 'ring-kitos',
  },
  both: {
    id: 'both',
    name: 'Nitakitos',
    short: 'Ambos',
    initials: 'NK',
    solid: 'bg-both',
    soft: 'bg-both-soft',
    text: 'text-both',
    ring: 'ring-both',
  },
  duplicate: {
    id: 'duplicate',
    name: 'Duplicar',
    short: 'Cada uno',
    initials: '×2',
    solid: 'bg-amber-500',
    soft: 'bg-amber-100',
    text: 'text-amber-600',
    ring: 'ring-amber-500',
  },
}

const EMAILS: Record<PersonId, string> = {
  nita: (import.meta.env.VITE_NITA_EMAIL ?? '').trim().toLowerCase(),
  kitos: (import.meta.env.VITE_KITOS_EMAIL ?? '').trim().toLowerCase(),
}

export function personFromEmail(email: string | null | undefined): PersonId | null {
  const e = (email ?? '').trim().toLowerCase()
  if (!e) return null
  if (e === EMAILS.nita) return 'nita'
  if (e === EMAILS.kitos) return 'kitos'
  return null
}

export function partnerOf(p: PersonId): PersonId {
  return p === 'nita' ? 'kitos' : 'nita'
}

/** Desde el punto de vista de quien usa la app: "Yo" / "Él" / "Ella". */
export function relativeLabel(target: PersonId, me: PersonId): string {
  if (target === me) return 'Yo'
  return target === 'kitos' ? 'Él' : 'Ella'
}
