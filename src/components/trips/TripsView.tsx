import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { arr, millis, num, oneOf, place, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useLayer } from '../../hooks/useLayer'
import { useSheetState } from '../../hooks/useSheetState'
import { BOOKING_KINDS, BOOKING_ORDER, DEFAULT_PACKING, daysToTrip, mergePacking, nights, packingProgress, sortBookings, sortTrips, spent, tripDates, tripStatus, type Booking, type BookingKind, type PackItem, type Trip } from '../../lib/trips'
import type { AssignMode, PersonId, PlaceInfo } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { DirectionsLink } from '../DirectionsLink'
import { ChevronIcon, NavigateIcon, PlusIcon, TrashIcon } from '../Icons'
import { PlaceField } from '../PlaceField'
import { SpotsMap, useSpots } from '../spots/SpotsView'

const parse = (id: string, x: Record<string, any>): Trip => ({
  id,
  title: str(x.title),
  destination: place(x.destination),
  start: str(x.start) || null,
  end: str(x.end) || null,
  budget: num(x.budget),
  bookings: arr(x.bookings).map((b, i) => ({
    id: str(b?.id) || String(i),
    kind: oneOf<BookingKind>(b?.kind, BOOKING_ORDER, 'otro'),
    title: str(b?.title),
    date: str(b?.date) || null,
    time: str(b?.time),
    ref: str(b?.ref),
    link: str(b?.link),
    price: num(b?.price),
    notes: str(b?.notes),
  })),
  packing: arr(x.packing).map((p) => ({ name: str(p?.name), who: oneOf<AssignMode>(p?.who, ['nita', 'kitos', 'both'], 'both'), done: p?.done === true })),
  expenses: arr(x.expenses).map((e) => ({ title: str(e?.title), amount: num(e?.amount) ?? 0 })),
  notes: str(x.notes),
  createdAt: millis(x.createdAt),
})
export const useTrips = () => useList('trips', parse)
type TripDraft = Omit<Trip, 'id' | 'createdAt'> & { id?: string }
const emptyTrip = (): TripDraft => ({ title: '', destination: null, start: null, end: null, budget: null, bookings: [], packing: [], expenses: [], notes: '' })

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0, useGrouping: 'always' } as Intl.NumberFormatOptions)
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const uid = () => Math.random().toString(36).slice(2, 10)
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

/** Viajes: los próximos con cuenta atrás, las ideas, los pasados y el mapa de dónde habéis estado. */
export function TripsView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useTrips()
  const { items: spots } = useSpots()
  const [open, setOpen] = useState<string | null>(null)
  const [map, setMap] = useState(false)
  const [sheet, openSheet, closeSheet] = useSheetState<TripDraft>()
  const today = new Date()
  const trips = sortTrips(items, today)
  const current = open ? items.find((t) => t.id === open) : undefined
  const been = items.filter((t) => tripStatus(t, today) === 'past' && t.destination?.lat != null && t.destination?.lng != null)

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : trips.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">Apuntad los viajes que tenéis pensados (aunque no tengan fecha) y los que ya habéis hecho, para verlos en el mapa ✈️</p>
      ) : (
        <ul className="space-y-2.5">
          {trips.map((t) => (
            <li key={t.id}>
              <TripCard t={t} today={today} onOpen={() => setOpen(t.id)} />
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => openSheet(emptyTrip())} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Nuevo viaje
      </button>

      <button onClick={() => setMap((v) => !v)} className={`${card} flex w-full items-center gap-3 text-left`}>
        <span className="text-2xl" aria-hidden>
          🗺️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Dónde hemos estado</span>
          <span className="block text-xs text-muted">
            {been.length} {been.length === 1 ? 'viaje' : 'viajes'} y {spots.filter((s) => s.status === 'been').length} sitios
          </span>
        </span>
        <ChevronIcon className={`size-4 text-muted transition ${map ? 'rotate-90' : ''}`} />
      </button>
      {map && (
        <SpotsMap
          spots={spots.filter((s) => s.status === 'been')}
          extra={been.map((t) => ({ lat: t.destination!.lat!, lng: t.destination!.lng!, emoji: '✈️', title: t.title }))}
        />
      )}

      {sheet && <TripSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} onSaved={(id) => setOpen(id)} />}
      {current && <TripDetail trip={current} me={me} onClose={() => setOpen(null)} onError={onError} />}
    </div>
  )
}

function TripCard({ t, today, onOpen }: { t: Trip; today: Date; onOpen: () => void }) {
  const status = tripStatus(t, today)
  const days = daysToTrip(t, today)
  const n = nights(t)
  const pack = packingProgress(t.packing)
  return (
    <button onClick={onOpen} className={`w-full overflow-hidden text-left active:scale-[0.99] ${status === 'past' ? `${card} opacity-80` : status === 'idea' ? card : 'rounded-3xl bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500 p-4 text-white shadow-lg shadow-indigo-300/40'}`}>
      <p className={`text-xs font-bold uppercase tracking-wider ${status === 'upcoming' || status === 'now' ? 'opacity-90' : 'text-muted'}`}>
        {status === 'now' ? '🌴 Estáis de viaje' : status === 'upcoming' ? (days === 0 ? '¡Hoy salís!' : days === 1 ? '¡Mañana!' : `Faltan ${days} días`) : status === 'idea' ? '💭 Idea' : '📍 Hecho'}
      </p>
      <p className="mt-0.5 text-xl font-extrabold leading-tight">{t.title}</p>
      <p className={`text-sm ${status === 'upcoming' || status === 'now' ? 'opacity-90' : 'text-muted'}`}>
        {[t.start ? tripDates(t) : '', n ? `${n} ${n === 1 ? 'noche' : 'noches'}` : '', t.bookings.length ? `${t.bookings.length} ${t.bookings.length === 1 ? 'reserva' : 'reservas'}` : '', status === 'upcoming' && pack.total ? `maleta ${pack.done}/${pack.total}` : '']
          .filter(Boolean)
          .join(' · ') || t.destination?.name}
      </p>
    </button>
  )
}

function TripSheet({ draft, me, onClose, onError, onSaved }: { draft: TripDraft; me: PersonId; onClose: () => void; onError: (m: string) => void; onSaved?: (id: string) => void }) {
  const [d, setD] = useState(draft)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const set = (o: Partial<TripDraft>) => setD((x) => ({ ...x, ...o }))
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const save = () => {
    if (!d.title.trim()) return
    const id = saveItem('trips', { ...d, title: d.title.trim(), end: d.end && d.start && d.end < d.start ? d.start : d.end }, me, onError)
    // El viaje nuevo se abre cuando la hoja ya se ha cerrado (si no, heredaría su entrada del historial).
    if (!isEdit && onSaved) window.addEventListener('popstate', () => setTimeout(() => onSaved(id), 0), { once: true })
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? 'Editar viaje' : 'Nuevo viaje'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!d.title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Crear viaje'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <input autoFocus={!isEdit} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Lisboa, Japón, escapada rural…" aria-label="Nombre del viaje" maxLength={80} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />
        <PlaceField value={d.destination} onChange={(p: PlaceInfo | null) => set({ destination: p, ...(p && !d.title.trim() ? { title: p.name } : {}) })} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            Ida
            <input type="date" value={d.start ?? ''} onChange={(e) => set({ start: e.target.value || null })} aria-label="Ida" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Vuelta
            <input type="date" value={d.end ?? ''} min={d.start ?? undefined} onChange={(e) => set({ end: e.target.value || null })} aria-label="Vuelta" className={input} />
          </label>
        </div>
        <p className="-mt-2 text-xs text-muted">Sin fechas se queda como idea.</p>
        <input value={d.budget ?? ''} onChange={(e) => set({ budget: e.target.value ? Number(e.target.value.replace(',', '.')) || null : null })} inputMode="decimal" placeholder="Presupuesto total (€, opcional)" aria-label="Presupuesto" className={input} />
        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar el viaje y todo lo apuntado?</p>
              <button
                onClick={() => {
                  removeItem('trips', draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar viaje
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}

type Tab = 'reservas' | 'maleta' | 'dinero' | 'notas'

/** Un viaje a pantalla completa: reservas, maleta, dinero y notas. */
function TripDetail({ trip, me, onClose, onError }: { trip: Trip; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const close = useLayer('trip', onClose)
  const [tab, setTab] = useState<Tab>('reservas')
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'edit' } | { type: 'booking'; booking: Booking | null }>()
  const today = new Date()
  const status = tripStatus(trip, today)
  const days = daysToTrip(trip, today)
  const { id, createdAt: _c, ...data } = trip
  void _c
  const update = (o: Partial<Trip>) => saveItem('trips', { id, ...data, ...o }, me, onError)
  const pack = packingProgress(trip.packing)
  const total = spent(trip)

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={trip.title}>
      <div className="pt-safe bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500 px-4 pb-5 text-white">
        <div className="flex items-center justify-between pb-3">
          <button onClick={close} aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-white/20">
            <ChevronIcon className="size-4 rotate-180" />
          </button>
          <button onClick={() => openSheet({ type: 'edit' })} className="rounded-full bg-white/20 px-3.5 py-2 text-xs font-bold">
            Editar
          </button>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">{status === 'upcoming' && days !== null ? (days === 0 ? '¡Hoy salís!' : `Faltan ${days} ${days === 1 ? 'día' : 'días'}`) : status === 'now' ? '🌴 De viaje' : status === 'idea' ? '💭 Idea de viaje' : '📍 Viaje hecho'}</p>
        <h1 className="text-3xl font-extrabold leading-tight">{trip.title}</h1>
        <p className="text-sm opacity-90">
          {tripDates(trip)}
          {nights(trip) ? ` · ${nights(trip)} noches` : ''}
        </p>
        {trip.destination && (
          <DirectionsLink place={trip.destination} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold">
            <NavigateIcon className="size-3.5" /> {trip.destination.name}
          </DirectionsLink>
        )}
      </div>

      <div className="sticky top-0 z-10 bg-cream/90 px-4 py-2 backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Apartado del viaje">
          {(
            [
              ['reservas', `Reservas${trip.bookings.length ? ` ${trip.bookings.length}` : ''}`],
              ['maleta', `Maleta${pack.total ? ` ${pack.done}/${pack.total}` : ''}`],
              ['dinero', 'Dinero'],
              ['notas', 'Notas'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 rounded-xl text-xs font-bold ${tab === t ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 pb-24 pt-2">
        {tab === 'reservas' && (
          <>
            {sortBookings(trip.bookings).map((b) => (
              <button key={b.id} onClick={() => openSheet({ type: 'booking', booking: b })} className={`${card} flex w-full items-start gap-3 text-left`}>
                <span className="text-2xl" aria-hidden>
                  {BOOKING_KINDS[b.kind].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{b.title || BOOKING_KINDS[b.kind].label}</span>
                  <span className="block text-xs text-muted">{[b.date ? dayFmt.format(parseYmd(b.date)) : '', b.time, b.price !== null ? eur(b.price) : ''].filter(Boolean).join(' · ')}</span>
                  {b.ref && <span className="mt-1 inline-block rounded-lg bg-stone-100 px-2 py-0.5 font-mono text-xs font-bold">{b.ref}</span>}
                </span>
                {b.link && (
                  <a href={b.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
                    Abrir
                  </a>
                )}
              </button>
            ))}
            {trip.bookings.length === 0 && <p className="p-4 text-center text-sm text-muted">Vuelos, hotel, coche, entradas… con su localizador a mano.</p>}
            <button onClick={() => openSheet({ type: 'booking', booking: null })} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted">
              <PlusIcon className="size-4" /> Añadir reserva
            </button>
          </>
        )}
        {tab === 'maleta' && <Packing items={trip.packing} onChange={(packing) => update({ packing })} onError={onError} />}
        {tab === 'dinero' && (
          <div className="space-y-3">
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Gastado</p>
              <p className="tabular text-3xl font-extrabold">
                {eur(total)}
                {trip.budget !== null && <span className="text-base font-bold text-muted"> de {eur(trip.budget)}</span>}
              </p>
              {trip.budget !== null && trip.budget > 0 && (
                <>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${total > trip.budget ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (total / trip.budget) * 100)}%` }} />
                  </div>
                  <p className={`mt-1 text-xs font-semibold ${total > trip.budget ? 'text-rose-600' : 'text-muted'}`}>{total > trip.budget ? `Os habéis pasado ${eur(total - trip.budget)}` : `Quedan ${eur(trip.budget - total)}`}</p>
                </>
              )}
              <p className="mt-2 text-xs text-muted">Incluye el precio de las reservas ({eur(trip.bookings.reduce((s, b) => s + (b.price ?? 0), 0))}) y los gastos de abajo.</p>
            </div>
            <Expenses items={trip.expenses} onChange={(expenses) => update({ expenses })} />
          </div>
        )}
        {tab === 'notas' && <NotesBox value={trip.notes} onSave={(notes) => update({ notes })} />}
      </main>

      {sheet?.type === 'edit' && <TripSheet draft={{ id, ...data }} me={me} onClose={closeSheet} onError={onError} />}
      {sheet?.type === 'booking' && (
        <BookingSheet
          booking={sheet.booking}
          defaultDate={trip.start}
          onClose={closeSheet}
          onSave={(b) => update({ bookings: sheet.booking ? trip.bookings.map((x) => (x.id === b.id ? b : x)) : [...trip.bookings, b] })}
          onDelete={sheet.booking ? () => update({ bookings: trip.bookings.filter((x) => x.id !== sheet.booking!.id) }) : undefined}
        />
      )}
    </div>
  )
}

function BookingSheet({ booking, defaultDate, onClose, onSave, onDelete }: { booking: Booking | null; defaultDate: string | null; onClose: () => void; onSave: (b: Booking) => void; onDelete?: () => void }) {
  const [b, setB] = useState<Booking>(booking ?? { id: uid(), kind: 'vuelo', title: '', date: defaultDate, time: '', ref: '', link: '', price: null, notes: '' })
  const set = (o: Partial<Booking>) => setB((x) => ({ ...x, ...o }))
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={booking ? 'Reserva' : 'Nueva reserva'}
      footer={
        <button
          onClick={() => {
            onSave({ ...b, title: b.title.trim(), ref: b.ref.trim(), link: b.link.trim(), notes: b.notes.trim() })
            onClose()
          }}
          className="h-13 w-full rounded-2xl bg-ink font-bold text-cream"
        >
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Tipo de reserva">
          {BOOKING_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={b.kind === k} onClick={() => set({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${b.kind === k ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {BOOKING_KINDS[k].emoji} {BOOKING_KINDS[k].label}
            </button>
          ))}
        </div>
        <input value={b.title} onChange={(e) => set({ title: e.target.value })} placeholder={b.kind === 'vuelo' ? 'Madrid → Lisboa (TP1027)' : b.kind === 'hotel' ? 'Nombre del alojamiento' : 'Qué es'} aria-label="Reserva" maxLength={100} className={input} />
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <input type="date" value={b.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} aria-label="Fecha de la reserva" className={input} />
          <input type="time" value={b.time} onChange={(e) => set({ time: e.target.value })} aria-label="Hora" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={b.ref} onChange={(e) => set({ ref: e.target.value })} placeholder="Localizador" aria-label="Localizador" maxLength={40} className={`${input} font-mono`} />
          <input value={b.price ?? ''} onChange={(e) => set({ price: e.target.value ? Number(e.target.value.replace(',', '.')) || null : null })} inputMode="decimal" placeholder="Precio €" aria-label="Precio de la reserva" className={input} />
        </div>
        <input value={b.link} onChange={(e) => set({ link: e.target.value })} type="url" inputMode="url" placeholder="Enlace (la reserva, la tarjeta de embarque…)" aria-label="Enlace de la reserva" className={input} />
        <textarea value={b.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Notas: check-in a las 15:00, terminal 4…" aria-label="Notas de la reserva" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600"
          >
            <TrashIcon className="size-4" /> Quitar reserva
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

const WHO: AssignMode[] = ['both', 'nita', 'kitos']

/** La maleta: lo de cada uno y lo común, y la lista de siempre para reutilizarla. */
function Packing({ items, onChange, onError }: { items: PackItem[]; onChange: (p: PackItem[]) => void; onError: (m: string) => void }) {
  const [text, setText] = useState('')
  const [base, setBase] = useState<Pick<PackItem, 'name' | 'who'>[] | null>(null)
  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'packing'), (s) => {
        const list = arr(s.get('items')).map((x) => ({ name: str(x?.name), who: oneOf<AssignMode>(x?.who, WHO, 'both') }))
        setBase(list.filter((x) => x.name))
      }),
    [],
  )
  const add = () => {
    const names = text
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (names.length) onChange(mergePacking(items, names.map((name) => ({ name, who: 'both' }))))
    setText('')
  }
  const saveBase = () => {
    setDoc(doc(db, 'config', 'packing'), { items: items.map(({ name, who }) => ({ name, who })) }).catch((e: Error) => onError(e.message))
    onError('🧳 Guardada como vuestra lista de siempre')
  }
  const list = base && base.length ? base : DEFAULT_PACKING
  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir (varias con comas)" aria-label="Añadir a la maleta" className={input} />
        <button type="submit" disabled={!text.trim()} className="rounded-xl bg-ink px-4 font-bold text-cream disabled:opacity-30">
          <PlusIcon className="size-4" />
        </button>
      </form>
      {items.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} className="flex items-center gap-3 px-4 py-2">
              <input type="checkbox" checked={it.done} onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} aria-label={it.name} className="size-5 accent-both" />
              <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${it.done ? 'text-muted line-through' : ''}`}>{it.name}</span>
              <button onClick={() => onChange(items.map((x, j) => (j === i ? { ...x, who: WHO[(WHO.indexOf(x.who) + 1) % 3] } : x)))} aria-label={`De quién: ${it.who}`} title="Tocar para cambiar de quién es">
                <Avatar mode={it.who} size="xs" />
              </button>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Quitar ${it.name}`} className="text-muted">
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onChange(mergePacking(items, list))} className="flex-1 rounded-2xl bg-violet-50 py-3 text-sm font-bold text-violet-700">
          🧳 {base && base.length ? 'Cargar nuestra lista de siempre' : 'Empezar con una lista básica'}
        </button>
        {items.length > 0 && (
          <button onClick={saveBase} className="flex-1 rounded-2xl bg-stone-100 py-3 text-sm font-bold">
            💾 Guardar como la de siempre
          </button>
        )}
      </div>
      {items.some((i) => i.done) && (
        <button onClick={() => onChange(items.map((i) => ({ ...i, done: false })))} className="mx-auto block text-xs font-bold text-muted">
          Desmarcar todo (para la vuelta)
        </button>
      )}
    </div>
  )
}

function Expenses({ items, onChange }: { items: { title: string; amount: number }[]; onChange: (e: { title: string; amount: number }[]) => void }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const n = Number(amount.replace(',', '.'))
  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Gastos sueltos</h3>
      {items.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          {items.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.title}</span>
              <span className="tabular text-sm font-bold">{eur(e.amount)}</span>
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Quitar ${e.title}`} className="text-muted">
                <TrashIcon className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim() || !(n > 0)) return
          onChange([...items, { title: title.trim(), amount: n }])
          setTitle('')
          setAmount('')
        }}
        className="grid grid-cols-[1fr_6rem_auto] gap-2"
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cena, taxi, museo…" aria-label="Gasto" className={input} />
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="€" aria-label="Importe" className={input} />
        <button type="submit" disabled={!title.trim() || !(n > 0)} className="rounded-xl bg-ink px-4 font-bold text-cream disabled:opacity-30">
          <PlusIcon className="size-4" />
        </button>
      </form>
    </div>
  )
}

function NotesBox({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Qué ver, dónde comer, ideas, direcciones…" aria-label="Notas del viaje" className="w-full rounded-2xl border border-stone-200 bg-surface p-3 outline-none focus:border-both" />
      {text !== value && (
        <button onClick={() => onSave(text)} className="h-12 w-full rounded-2xl bg-ink font-bold text-cream">
          Guardar notas
        </button>
      )}
    </div>
  )
}
