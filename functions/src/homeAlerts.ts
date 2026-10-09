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

// ─── Papeles, mantenimiento, suscripciones, salud y cápsula ────────────────

import { EXPIRY_LEADS, RENEWAL_LEAD, daysTo, nextRenewal, type Period } from './due.js'

type Owner = Person | 'both'
const toWhom = (o: Owner): Person[] => (o === 'both' ? ['nita', 'kitos'] : [o])

export interface PaperLite {
  title: string
  kind: string
  owner: Owner
  expires: string | null
}
const PAPER_EMOJI: Record<string, string> = { garantia: '🧾', documento: '🪪', seguro: '🛡️', coche: '🚗', contrato: '📄' }

/** Documentos, seguros y garantías que caducan: 60, 30 y 7 días antes y el mismo día (las garantías, solo 30 días antes). */
export function paperPushes(papers: PaperLite[], prefs: Record<Person, NotifPrefs>, now: Date): Push[] {
  const pushes: Push[] = []
  for (const p of papers) {
    if (!p.expires) continue
    const d = daysTo(p.expires, now)
    const leads = p.kind === 'garantia' ? [30] : EXPIRY_LEADS
    if (!leads.includes(d)) continue
    const whose = p.owner === 'both' ? '' : ` de ${NAME[p.owner]}`
    const title =
      p.kind === 'garantia'
        ? `🧾 La garantía de «${p.title}» acaba en un mes`
        : `${PAPER_EMOJI[p.kind] ?? '📎'} ${p.title}${whose}: ${d === 0 ? 'caduca hoy' : d === 7 ? 'caduca en una semana' : `caduca en ${d} días`}`
    const body = p.kind === 'garantia' ? '¿Funciona todo bien? Si no, aún estáis a tiempo de reclamar. Está en Hogar → Papeles.' : 'Pide cita para renovarlo con tiempo. Está en Hogar → Papeles.'
    for (const to of toWhom(p.owner)) if (prefs[to].home) pushes.push({ to, kind: 'reminder', title, body, tag: `paper-${p.title}` })
  }
  return pushes
}

export interface UpkeepLite extends CareItem {
  area: 'casa' | 'coche'
}

/** Mantenimiento de la casa y del coche: la víspera y, si se queda pendiente, una vez por semana. */
export function upkeepPushes(items: UpkeepLite[], prefs: Record<Person, NotifPrefs>, now: Date): Push[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const pushes: Push[] = []
  for (const area of ['casa', 'coche'] as const) {
    const due = items.filter((c) => {
      if (c.area !== area || !c.last) return false
      const d = daysUntil(nextDue(c, today), today)
      return d === 1 || (d <= 0 && d % 7 === 0)
    })
    if (!due.length) continue
    const late = due.filter((c) => daysUntil(nextDue(c, today), today) <= 0)
    const icon = area === 'casa' ? '🧰' : '🚗'
    const title = late.length === due.length ? `${icon} Pendiente ${area === 'casa' ? 'en casa' : 'con el coche'}` : `${icon} Mañana toca ${area === 'casa' ? 'en casa' : 'con el coche'}`
    const body = `${due.map((c) => `${c.title}${late.includes(c) ? ' (pendiente)' : ''}`).join('\n')}\nMárcalo como hecho en Hogar → ${area === 'casa' ? 'Mantenimiento' : 'El coche'}.`
    for (const to of ['nita', 'kitos'] as Person[]) if (prefs[to].home) pushes.push({ to, kind: 'reminder', title, body, tag: `upkeep-${area}` })
  }
  return pushes
}

export interface SubLite {
  name: string
  price: number
  period: Period
  from: string
  payer: Owner
  remind: boolean
  active: boolean
}

/** Una semana antes de cada cobro anual o trimestral (y de los mensuales si se pidió). */
export function subPushes(subs: SubLite[], prefs: Record<Person, NotifPrefs>, now: Date): Push[] {
  const pushes: Push[] = []
  for (const s of subs) {
    if (!s.active || (s.period === 'month' && !s.remind)) continue
    const lead = s.period === 'month' ? 2 : RENEWAL_LEAD
    if (daysTo(nextRenewal(s.from, s.period, now), now) !== lead) continue
    const price = s.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
    const title = `💳 ${s.name} se cobra ${lead === 7 ? 'en una semana' : 'pasado mañana'} (${price})`
    for (const to of toWhom(s.payer)) if (prefs[to].home) pushes.push({ to, kind: 'reminder', title, body: '¿Lo seguís usando? Si no, es buen momento para darlo de baja.', tag: `sub-${s.name}` })
  }
  return pushes
}

export interface HealthLite {
  owner: Person
  kind: string
  date: string | null
  next: string | null
}
const HEALTH_LABEL: Record<string, string> = { cita: 'una cita médica', revision: 'una revisión', vacuna: 'una vacuna', analitica: 'un análisis', medicacion: 'algo de medicación', otro: 'algo de salud' }

/** La víspera de una cita o revisión, solo a su dueño y sin detalles (puede verse con la pantalla bloqueada). */
export function healthPushes(items: HealthLite[], prefs: Record<Person, NotifPrefs>, now: Date): Push[] {
  const pushes: Push[] = []
  for (const to of ['nita', 'kitos'] as Person[]) {
    if (!prefs[to].home) continue
    const mine = items.filter((h) => h.owner === to && [h.date, h.next].some((d) => d && daysTo(d, now) === 1))
    if (!mine.length) continue
    const what = mine.length === 1 ? HEALTH_LABEL[mine[0].kind] ?? 'algo de salud' : `${mine.length} cosas de salud`
    pushes.push({ to, kind: 'reminder', title: `🩺 Mañana tienes ${what}`, body: 'Lo tienes en Bienestar → Médico.', tag: 'health' })
  }
  return pushes
}

export interface CapsuleLite {
  from: Person
  to: Owner
  openAt: string
}

/** El día antes de que se pueda abrir una carta de la cápsula, a quien va dirigida. */
export function capsulePushes(caps: CapsuleLite[], now: Date): Push[] {
  const pushes: Push[] = []
  for (const c of caps) {
    if (daysTo(c.openAt, now) !== 1) continue
    for (const to of toWhom(c.to).filter((p) => p !== c.from))
      pushes.push({ to, kind: 'reminder', title: `💌 Mañana podrás abrir una carta de ${NAME[c.from]}`, body: 'Está guardada en Nosotros → Cápsula del tiempo.', tag: `capsule-${c.openAt}` })
  }
  return pushes
}
