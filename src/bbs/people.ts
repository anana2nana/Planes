// Quién es quién en bbs (Nita, Kitos y María). Los emails NO están en el repo:
// vienen de las variables de Vercel VITE_NITA_EMAIL, VITE_KITOS_EMAIL y VITE_MARIA_EMAIL.
import { BBS_NAMES, type BbsPerson } from '../lib/bbs.ts'

const clean = (v: string | undefined) => (v ?? '').trim().toLowerCase()

const EMAILS: Record<BbsPerson, string> = {
  nita: clean(import.meta.env.VITE_NITA_EMAIL),
  kitos: clean(import.meta.env.VITE_KITOS_EMAIL),
  maria: clean(import.meta.env.VITE_MARIA_EMAIL),
}

export function bbsPersonFromEmail(email: string | null | undefined): BbsPerson | null {
  const e = clean(email ?? '')
  if (!e) return null
  return (Object.keys(EMAILS) as BbsPerson[]).find((p) => EMAILS[p] === e) ?? null
}

/** ¿Es María? (en Nitakitos, para enseñarle el enlace a bbs en vez de "privado"). */
export const isMariaEmail = (email: string | null | undefined) => !!EMAILS.maria && bbsPersonFromEmail(email) === 'maria'

/** Dirección de bbs (variable VITE_BBS_URL en el proyecto de Nitakitos en Vercel). */
export const BBS_URL = (import.meta.env.VITE_BBS_URL ?? '').trim()

/** Colores de cada uno (clases completas para que Tailwind las genere). */
export const BBS_COLORS: Record<BbsPerson, { solid: string; soft: string; text: string; ring: string }> = {
  nita: { solid: 'bg-rose-500', soft: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-500' },
  kitos: { solid: 'bg-sky-500', soft: 'bg-sky-100', text: 'text-sky-700', ring: 'ring-sky-500' },
  maria: { solid: 'bg-amber-500', soft: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-500' },
}

export const nameFor = (p: BbsPerson, me: BbsPerson) => (p === me ? 'Tú' : BBS_NAMES[p])
