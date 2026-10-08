// Avisos de la casa (cooperativa): pagos de mañana y recordatorio de actualizar el ahorro.
// Usa src/home.ts, copia exacta de la app (un test lo comprueba).

import { eur, installmentDate, paidInstallments, unitAmount, type Fund, type HomeConfig, type HomeItem } from './home.js'
import { daysUntil, nextDue, type CareItem } from './pet.js'
import { GIFT_LEADS, upcomingOccasions, type GiftOccasion, type GiftStatus } from './gifts.js'
import { NAME, type NotifPrefs, type Person, type Push } from './logic.js'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface DuePayment {
  title: string
  amount: number
  detail: string
}

/** Pagos (no ingresos) que tocan mañana. */
export function paymentsTomorrow(items: HomeItem[], cfg: HomeConfig, now: Date): DuePayment[] {
  const tomorrow = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const out: DuePayment[] = []
  for (const item of items) {
    if (item.income) continue
    const amount = unitAmount(item.amount, cfg)
    if (item.monthly) {
      const n = paidInstallments(item.monthly, now)
      if (n < item.monthly.count && ymd(installmentDate(item.monthly, n)) === tomorrow) {
        out.push({ title: item.title, amount, detail: `cuota ${n + 1} de ${item.monthly.count}` })
      }
    } else if (!item.paid && item.date === tomorrow) {
      out.push({ title: item.title, amount, detail: '' })
    }
  }
  return out
}

const DAY = 86_400_000

/** Todos los avisos de la casa para hoy (se ejecuta cada tarde). */
export function homePushes(
  items: HomeItem[],
  funds: Fund[],
  cfg: HomeConfig,
  prefs: Record<Person, NotifPrefs>,
  now: Date,
): Push[] {
  const people: Person[] = ['nita', 'kitos']
  const pushes: Push[] = []

  const due = paymentsTomorrow(items, cfg, now)
  if (due.length > 0) {
    const total = due.reduce((s, d) => s + d.amount, 0)
    const title = due.length === 1 ? `🏗️ Mañana se paga: ${eur(total)}` : `🏗️ Mañana: ${due.length} pagos (${eur(total)})`
    const body = due.map((d) => `${d.title}${d.detail ? ` · ${d.detail}` : ''}${due.length > 1 ? ` · ${eur(d.amount)}` : ''}`).join('\n')
    for (const p of people) if (prefs[p].home) pushes.push({ to: p, kind: 'reminder', title, body: `${body}\nAseguraos de que hay saldo 😉`, tag: 'home-due' })
  }

  // El día 1 de cada mes: a quien no haya actualizado su dinero en las últimas semanas.
  if (now.getDate() === 1) {
    for (const p of people) {
      if (!prefs[p].home) continue
      const own = funds.filter((f) => f.owner === p || f.owner === 'both')
      const fresh = own.some((f) => f.updatedAt !== null && now.getTime() - f.updatedAt < 25 * DAY)
      if (!fresh) {
        pushes.push({
          to: p,
          kind: 'reminder',
          title: `🐷 ${NAME[p]}, ¿cuánto te queda este mes?`,
          body: 'Actualiza tu ahorro en Casa → ¿Llegamos? para ver si vais bien.',
          tag: 'home-savings',
        })
      }
    }
  }
  return pushes
}

/** Cuidados de la gata que tocan mañana (o que llevan días pendientes, una vez por semana). */
export function petPushes(care: CareItem[], petName: string, prefs: Record<Person, NotifPrefs>, now: Date): Push[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Sin fecha de la última vez no sabemos cuándo toca: no se avisa (si no, sonaría cada semana).
  const due = care.filter((c) => {
    if (!c.last) return false
    const d = daysUntil(nextDue(c, today), today)
    return d === 1 || (d <= 0 && d % 7 === 0)
  })
  if (due.length === 0) return []
  const name = petName.trim() || 'la gata'
  const late = due.filter((c) => daysUntil(nextDue(c, today), today) <= 0)
  const title = late.length === due.length ? `🐱 Pendiente con ${name}` : `🐱 Mañana toca con ${name}`
  const body = due.map((c) => `${c.title}${late.includes(c) ? ' (pendiente)' : ''}`).join('\n')
  const people: Person[] = ['nita', 'kitos']
  return people.filter((p) => prefs[p].home).map((p) => ({ to: p, kind: 'reminder' as const, title, body: `${body}\nMárcalo en Casa → ${name} cuando esté hecho.`, tag: 'pet-care' }))
}

/** Lo mínimo de cada idea de regalo para avisar (sin títulos: el aviso puede verse en la pantalla bloqueada). */
export interface GiftLite {
  owner: Person
  occasion: GiftOccasion
  status: GiftStatus
}

const GIFT_TITLE: Record<Exclude<GiftOccasion, 'otra'>, (partner: Person) => string> = {
  cumple: (p) => `es el cumple de ${NAME[p]}`,
  aniversario: () => 'es vuestro aniversario',
  reyes: () => 'son los Reyes',
  sanvalentin: () => 'es San Valentín',
}

/** Unas semanas antes de cada ocasión, a cada uno: cuántas ideas tiene para su pareja. */
export function giftPushes(
  gifts: GiftLite[],
  birthdays: Record<Person, string | null>,
  since: string | null,
  prefs: Record<Person, NotifPrefs>,
  now: Date,
): Push[] {
  const pushes: Push[] = []
  for (const me of ['nita', 'kitos'] as Person[]) {
    if (!prefs[me].gifts) continue
    const partner: Person = me === 'nita' ? 'kitos' : 'nita'
    for (const o of upcomingOccasions(birthdays[partner], since, now)) {
      if (!GIFT_LEADS.includes(o.days)) continue
      const mine = gifts.filter((g) => g.owner === me && g.occasion === o.id && g.status !== 'regalado')
      // San Valentín no lo celebra todo el mundo: solo si ya hay alguna idea apuntada.
      if (o.id === 'sanvalentin' && mine.length === 0) continue
      const bought = mine.filter((g) => g.status === 'comprado').length
      const when = o.days === 7 ? 'En una semana' : `En ${o.days} días`
      pushes.push({
        to: me,
        kind: 'reminder',
        title: `🎁 ${when} ${GIFT_TITLE[o.id](partner)}`,
        body:
          mine.length === 0
            ? 'Aún no tienes ninguna idea apuntada. Apúntalas en Planes → Regalos 🤫'
            : `Tienes ${mine.length} ${mine.length === 1 ? 'idea apuntada' : 'ideas apuntadas'}${bought ? ` (${bought} ya ${bought === 1 ? 'comprada' : 'compradas'})` : ''} 🤫`,
        tag: `gift-${o.id}`,
      })
    }
  }
  return pushes
}
