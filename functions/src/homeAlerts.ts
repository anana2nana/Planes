// Avisos de la casa (cooperativa): pagos de mañana y recordatorio de actualizar el ahorro.
// Usa src/home.ts, copia exacta de la app (un test lo comprueba).

import { eur, installmentDate, paidInstallments, unitAmount, type Fund, type HomeConfig, type HomeItem } from './home.js'
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
