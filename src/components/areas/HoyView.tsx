import { useCouple } from '../../hooks/useCouple'
import { useRoutines, useWorkouts } from '../../hooks/useFitness'
import { GROUPS, routineForToday, routineGroups, ymd } from '../../lib/fitness'
import { useTrips } from '../trips/TripsView'
import { useTimeline } from '../../hooks/useTimeline'
import { useCapsules } from '../us/UsViews'
import { daysToTrip, sortTrips, tripStatus } from '../../lib/trips'
import { capsuleState } from '../../lib/us'
import { useHome } from '../../hooks/useHome'
import { usePet } from '../../hooks/usePet'
import { useShopping } from '../../hooks/useShopping'
import { nextAnniversary } from '../../lib/couple'
import { OCCASIONS, upcomingOccasions } from '../../lib/gifts'
import { eur, nextPayment } from '../../lib/home'
import { eventEmoji } from '../../lib/kinds'
import { PEOPLE } from '../../lib/people'
import { daysUntil, nextDue } from '../../lib/pet'
import type { Plan, PersonId } from '../../lib/types'
import { ChevronIcon } from '../Icons'
import { TodayStrip } from '../TodayStrip'
import { AreaTitle } from '../hub/Tile'

export type Go = (area: 'agenda' | 'hogar' | 'bienestar' | 'nosotros', section?: string) => void

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
const EMOJI = { plan: '💞', task: '🧹' }

/** Hoy: lo importante de cada área en una pantalla. Cada tarjeta lleva a su sitio. */
export function HoyView({ plans, me, onOpen, onToast, go }: { plans: Plan[]; me: PersonId; onOpen: (p: Plan) => void; onToast: (m: string) => void; go: Go }) {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8).getTime()
  const week = plans
    .filter((p) => !p.done && p.dueAt && (p.assignee === me || p.assignee === 'both'))
    .filter((p) => p.dueAt!.toMillis() >= tomorrow && p.dueAt!.toMillis() < weekEnd)
    .sort((a, b) => a.dueAt!.toMillis() - b.dueAt!.toMillis())

  const { items: shopping } = useShopping()
  const pending = shopping.filter((i) => !i.done)
  const { config, items } = useHome()
  const pay = config ? nextPayment(items, config, now) : null
  const payDays = pay
    ? Math.round((new Date(pay.date.getFullYear(), pay.date.getMonth(), pay.date.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
    : null
  const { profile, care } = usePet()
  const petNext = care
    .filter((c) => c.last)
    .map((c) => ({ c, days: daysUntil(nextDue(c, now), now) }))
    .sort((a, b) => a.days - b.days)[0]
  const { since, birthdays } = useCouple()
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const occasion = upcomingOccasions(birthdays[partner], since, now).find((o) => o.days <= 30 && o.id !== 'sanvalentin')
  const anniv = since ? nextAnniversary(since, now) : null
  const { routines } = useRoutines()
  const { workouts } = useWorkouts()
  const gym = routineForToday(routines, workouts, me, ymd(now))
  const timeline = useTimeline(me)
  const ymdT = (t: number) => ymd(new Date(t))
  const weekExtra = timeline.filter((i) => i.date >= ymdT(tomorrow) && i.date < ymdT(weekEnd) && !(i.section === 'viajes' && i.detail.startsWith('Día ')))
  const { items: trips } = useTrips()
  const trip = sortTrips(trips, now).find((t) => tripStatus(t, now) === 'now' || (daysToTrip(t, now) ?? 99) <= 14)
  const tripDays = trip ? daysToTrip(trip, now) : null
  const { items: capsules } = useCapsules()
  const letters = capsules.filter((c) => c.from !== me && (c.to === me || c.to === 'both') && capsuleState(c.openAt, now).open && !c.openedAt).length

  const cards = [
    letters > 0 && { key: 'carta', emoji: '💝', title: letters === 1 ? 'Tienes una carta' : `Tienes ${letters} cartas`, text: 'Ya se puede abrir 💌', on: () => go('nosotros', 'capsula') },
    trip && {
      key: 'viaje',
      emoji: '✈️',
      title: trip.title,
      text: tripStatus(trip, now) === 'now' ? '¡Estáis de viaje! Reservas y notas' : tripDays === 0 ? '¡Hoy salís!' : `En ${tripDays} ${tripDays === 1 ? 'día' : 'días'} · ¿maleta?`,
      on: () => go('nosotros', 'viajes'),
    },
    gym && { key: 'gym', emoji: GROUPS[routineGroups(gym)[0] ?? 'otro'].emoji, title: 'Hoy toca', text: gym.name, on: () => go('bienestar', 'entrenos') },
    pending.length > 0 && {
      key: 'compra',
      emoji: '🛒',
      title: 'Compra',
      text: `${pending.length} ${pending.length === 1 ? 'cosa' : 'cosas'}: ${pending
        .slice(0, 3)
        .map((i) => i.name)
        .join(', ')}`,
      on: () => go('hogar', 'compra'),
    },
    pay &&
      payDays !== null &&
      payDays <= 31 && {
        key: 'meroe',
        emoji: '🏗️',
        title: 'MEROE',
        text: `${eur(pay.amount)} ${payDays === 0 ? 'hoy' : payDays === 1 ? 'mañana' : `en ${payDays} días`}`,
        on: () => go('hogar', 'meroe'),
      },
    petNext &&
      petNext.days <= 3 && {
        key: 'gata',
        emoji: '🐱',
        title: profile?.name || 'La gata',
        text: petNext.days < 0 ? `${petNext.c.title}: atrasado` : petNext.days === 0 ? `Hoy: ${petNext.c.title}` : `${petNext.c.title} ${petNext.days === 1 ? 'mañana' : `en ${petNext.days} días`}`,
        on: () => go('hogar', 'gata'),
      },
    occasion && {
      key: 'regalo',
      emoji: '🎁',
      title: occasion.id === 'cumple' ? `Cumple de ${PEOPLE[partner].name}` : OCCASIONS[occasion.id].label,
      text: occasion.days === 0 ? '¡Es hoy!' : `En ${occasion.days} días · ¿tienes regalo?`,
      on: () => go('nosotros', 'regalos'),
    },
    anniv &&
      anniv.days <= 30 &&
      occasion?.id !== 'aniversario' && { key: 'aniv', emoji: '💞', title: 'Aniversario', text: anniv.days === 0 ? `¡Hoy hacéis ${anniv.years}!` : `En ${anniv.days} días`, on: () => go('nosotros') },
  ].filter(Boolean) as { key: string; emoji: string; title: string; text: string; on: () => void }[]

  return (
    <div className="space-y-5">
      <TodayStrip plans={plans} me={me} onOpen={onOpen} onGoTasks={() => go('agenda', 'tareas')} onGoMenu={() => go('bienestar', 'menu')} onToast={onToast} />

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <button key={c.key} onClick={c.on} className="flex flex-col rounded-3xl bg-surface p-4 text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] active:scale-[0.98]">
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="mt-1.5 truncate font-extrabold">{c.title}</span>
              <span className="line-clamp-2 text-xs text-muted">{c.text}</span>
            </button>
          ))}
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <AreaTitle>Próximos días</AreaTitle>
          <button onClick={() => go('agenda', 'calendario')} className="flex items-center gap-1 text-xs font-bold text-both">
            Calendario <ChevronIcon className="size-3" />
          </button>
        </div>
        {week.length + weekExtra.length === 0 ? (
          <p className="rounded-3xl bg-surface/70 px-4 py-3 text-sm text-muted">Nada apuntado para esta semana 🌿</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {[...week.slice(0, 7).map((p) => ({ t: ymd(p.dueAt!.toDate()), p, x: null })), ...weekExtra.slice(0, 7).map((x) => ({ t: x.date, p: null, x }))]
              .sort((a, b) => a.t.localeCompare(b.t))
              .map(({ p, x }) =>
                x ? (
                  <li key={x.key}>
                    <button onClick={() => go(x.area, x.section)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-stone-50">
                      <span className="w-12 shrink-0 text-xs font-bold capitalize text-muted">{dayFmt.format(new Date(x.date + 'T12:00'))}</span>
                      <span aria-hidden>{x.emoji}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{x.title}</span>
                      <span className="truncate text-[11px] text-muted">{x.detail}</span>
                    </button>
                  </li>
                ) : (
                  <li key={p!.id}>
                    <button onClick={() => onOpen(p!)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-stone-50">
                      <span className="w-12 shrink-0 text-xs font-bold capitalize text-muted">{dayFmt.format(p!.dueAt!.toDate())}</span>
                      <span aria-hidden>{p!.kind === 'event' ? eventEmoji(!!p!.repeat?.yearly) : EMOJI[p!.kind as 'plan' | 'task']}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p!.title}</span>
                      {!p!.allDay && <span className="tabular text-xs text-muted">{timeFmt.format(p!.dueAt!.toDate())}</span>}
                    </button>
                  </li>
                ),
              )}
            {week.length > 7 && <li className="px-4 py-2 text-xs text-muted">y {week.length - 7} más</li>}
          </ul>
        )}
      </section>
    </div>
  )
}
