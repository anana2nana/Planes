import { useEffect, useRef, useState } from 'react'
import { arr, millis, num, oneOf, place, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { loadMap } from '../../lib/maps'
import { PEOPLE } from '../../lib/people'
import { SPOT_KINDS, SPOT_ORDER, addVisit, avgSpot, distanceKm, euros, guessSpotKind, kmText, lastVisit, sortSpots, type Spot, type SpotKind, type SpotStatus } from '../../lib/spots'
import type { PersonId, PlaceInfo } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { DirectionsLink } from '../DirectionsLink'
import { NavigateIcon, PlusIcon, TrashIcon } from '../Icons'
import { PlaceField } from '../PlaceField'

const parse = (id: string, x: Record<string, any>): Spot => ({
  id,
  name: str(x.name),
  place: place(x.place),
  kind: oneOf<SpotKind>(x.kind, SPOT_ORDER, 'restaurante'),
  status: x.status === 'been' ? 'been' : 'want',
  cuisine: str(x.cuisine),
  price: num(x.price),
  rating: { nita: num(x.rating?.nita), kitos: num(x.rating?.kitos) },
  order: str(x.order),
  notes: str(x.notes),
  link: str(x.link),
  visits: arr(x.visits).filter((v) => typeof v === 'string'),
  createdAt: millis(x.createdAt),
})
export const useSpots = () => useList('spots', parse)

export type SpotDraft = Omit<Spot, 'id' | 'createdAt'> & { id?: string }
export const emptySpot = (o: Partial<SpotDraft> = {}): SpotDraft => ({ name: '', place: null, kind: 'restaurante', status: 'want', cuisine: '', price: null, rating: { nita: null, kitos: null }, order: '', notes: '', link: '', visits: [], ...o })

const PEOPLE_IDS: PersonId[] = ['nita', 'kitos']
const pad = (n: number) => String(n).padStart(2, '0')
const todayYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Sitios: a dónde queréis ir y dónde habéis estado, en lista o en el mapa. */
export function SpotsView({ me, onError, onPlan }: { me: PersonId; onError: (m: string) => void; onPlan: (p: { title: string; place: PlaceInfo | null; notes: string }) => void }) {
  const { items, loading } = useSpots()
  const [status, setStatus] = useState<SpotStatus>('want')
  const [kind, setKind] = useState<SpotKind | 'all'>('all')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null)
  const [sheet, openSheet, closeSheet] = useSheetState<SpotDraft>()
  const list = sortSpots(items, status, here).filter((s) => kind === 'all' || s.kind === kind)
  const kinds = SPOT_ORDER.filter((k) => items.some((s) => s.kind === k))
  const count = (s: SpotStatus) => items.filter((x) => x.status === s).length

  const locate = () => {
    if (here) return setHere(null)
    navigator.geolocation.getCurrentPosition(
      (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => onError('No he podido saber dónde estás (revisa el permiso de ubicación)'),
      { timeout: 10_000 },
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Lista">
        {(['want', 'been'] as SpotStatus[]).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`h-10 rounded-xl text-sm font-bold ${status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {s === 'want' ? 'Queremos ir' : 'Hemos ido'}
            {count(s) > 0 && <span className="ml-1 text-xs font-semibold text-muted">{count(s)}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1">
          {kinds.length > 1 &&
            (['all', ...kinds] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${kind === k ? 'bg-ink text-cream' : 'bg-surface shadow-sm'}`}>
                {k === 'all' ? 'Todo' : `${SPOT_KINDS[k].emoji} ${SPOT_KINDS[k].label}`}
              </button>
            ))}
        </div>
        <button onClick={locate} aria-pressed={here !== null} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${here ? 'bg-sky-600 text-white' : 'bg-surface shadow-sm'}`}>
          📍 Cerca
        </button>
        <button onClick={() => setView(view === 'list' ? 'map' : 'list')} className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-bold shadow-sm">
          {view === 'list' ? '🗺️ Mapa' : '☰ Lista'}
        </button>
      </div>

      {view === 'map' ? (
        <SpotsMap spots={list} here={here} onOpen={(s) => openSheet(s)} />
      ) : loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">
          {status === 'want' ? 'Apuntad los sitios que os recomiendan (también desde Google Maps con «Compartir → Nitakitos») 🍽️' : 'Vuestros sitios de siempre, con qué pedir y la nota de cada uno.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id}>
              <SpotRow s={s} here={here} onOpen={() => openSheet(s)} />
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => openSheet(emptySpot({ status, kind: kind === 'all' ? 'restaurante' : kind }))} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Añadir sitio
      </button>

      {sheet && (
        <SpotSheet
          draft={sheet}
          me={me}
          onClose={closeSheet}
          onError={onError}
          onPlan={(p) => {
            // Primero se cierra la hoja (vuelve atrás en el historial) y luego se abre el formulario del plan.
            window.addEventListener('popstate', () => setTimeout(() => onPlan(p), 0), { once: true })
            closeSheet()
          }}
        />
      )}
    </div>
  )
}

function SpotRow({ s, here, onOpen }: { s: Spot; here: { lat: number; lng: number } | null; onOpen: () => void }) {
  const avg = avgSpot(s)
  const last = lastVisit(s)
  const km = here && s.place?.lat != null && s.place?.lng != null ? distanceKm(here, { lat: s.place.lat, lng: s.place.lng }) : null
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-surface p-3 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone-100 text-2xl" aria-hidden>
          {SPOT_KINDS[s.kind].emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{s.name}</span>
          <span className="block truncate text-xs text-muted">{[s.cuisine, euros(s.price), s.place?.address.split(',').slice(-2, -1)[0]?.trim(), km !== null ? kmText(km) : ''].filter(Boolean).join(' · ') || SPOT_KINDS[s.kind].label}</span>
          {(avg !== null || last) && (
            <span className="block truncate text-xs text-muted">
              {avg !== null && <b className="text-amber-500">★ {avg.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</b>}
              {last && ` ${avg !== null ? '· ' : ''}${s.visits.length > 1 ? `${s.visits.length} veces · ` : ''}última ${dateFmt.format(parseYmd(last))}`}
            </span>
          )}
        </span>
      </button>
      {s.place && (
        <DirectionsLink place={s.place} className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
          <NavigateIcon className="size-5" />
        </DirectionsLink>
      )}
    </div>
  )
}

/** Todos los sitios en un mapa (con un emoji de su tipo). */
export function SpotsMap({ spots, here, onOpen, extra = [] }: { spots: Spot[]; here?: { lat: number; lng: number } | null; onOpen?: (s: Spot) => void; extra?: { lat: number; lng: number; emoji: string; title: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const located = spots.filter((s) => s.place?.lat != null && s.place?.lng != null)
  const key = JSON.stringify([located.map((s) => [s.id, s.place!.lat, s.place!.lng, s.kind]), extra, here])
  useEffect(() => {
    let cancelled = false
    loadMap()
      .then(({ maps, marker }) => {
        if (cancelled || !ref.current) return
        const map = new maps.Map(ref.current, { center: here ?? { lat: 40.4168, lng: -3.7038 }, zoom: 12, disableDefaultUI: true, zoomControl: true, clickableIcons: false, mapId: 'DEMO_MAP_ID' })
        const bounds = new google.maps.LatLngBounds()
        const pin = (emoji: string, title: string) => {
          const el = document.createElement('div')
          el.textContent = emoji
          el.title = title
          el.style.cssText = 'font-size:22px;background:#fff;border-radius:999px;width:36px;height:36px;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.25)'
          return el
        }
        for (const s of located) {
          const position = { lat: s.place!.lat!, lng: s.place!.lng! }
          const m = new marker.AdvancedMarkerElement({ map, position, title: s.name, content: pin(SPOT_KINDS[s.kind].emoji, s.name), gmpClickable: true })
          if (onOpen) m.addListener('click', () => onOpen(s))
          bounds.extend(position)
        }
        for (const p of extra) {
          new marker.AdvancedMarkerElement({ map, position: p, title: p.title, content: pin(p.emoji, p.title) })
          bounds.extend(p)
        }
        if (here) {
          new marker.AdvancedMarkerElement({ map, position: here, title: 'Estás aquí' })
          bounds.extend(here)
        }
        const n = located.length + extra.length + (here ? 1 : 0)
        if (n > 1) map.fitBounds(bounds, 40)
        else if (n === 1) map.setCenter(bounds.getCenter())
      })
      .catch(() => setFailed(true))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (failed) return <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">No se ha podido cargar el mapa.</p>
  return (
    <div className="overflow-hidden rounded-3xl shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <div ref={ref} className="h-[60vh] w-full bg-stone-100" aria-label="Mapa de sitios" />
      {located.length < spots.length && <p className="bg-surface px-4 py-2 text-xs text-muted">{spots.length - located.length} sin ubicación (elígelos en Google Maps al editarlos para verlos aquí).</p>}
    </div>
  )
}

const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

function Stars({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`} onClick={() => onChange(value === n ? null : n)} className={`text-2xl leading-none ${value && n <= value ? 'text-amber-400' : 'text-stone-300'}`}>
          ★
        </button>
      ))}
    </div>
  )
}

export function SpotSheet({ draft, me, onClose, onError, onPlan, onSaved }: { draft: SpotDraft; me: PersonId; onClose: () => void; onError: (m: string) => void; onPlan?: (p: { title: string; place: PlaceInfo | null; notes: string }) => void; onSaved?: () => void }) {
  const [d, setD] = useState(draft)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const set = (o: Partial<SpotDraft>) => setD((x) => ({ ...x, ...o }))
  const valid = d.name.trim() !== ''
  const persist = (x = d) => saveItem('spots', { ...x, name: x.name.trim(), cuisine: x.cuisine.trim(), order: x.order.trim(), notes: x.notes.trim(), link: x.link.trim() }, me, onError)
  const save = () => {
    if (!valid) return
    persist()
    onSaved?.()
    onClose()
  }
  const setPlace = (p: PlaceInfo | null) => set({ place: p, ...(p && !d.name.trim() ? { name: p.name, kind: guessSpotKind(p.name) } : {}) })

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? `${SPOT_KINDS[d.kind].emoji} ${d.name}` : 'Nuevo sitio'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!valid} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <PlaceField value={d.place} onChange={setPlace} />
        <input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Nombre del sitio" aria-label="Nombre del sitio" maxLength={80} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Tipo de sitio">
          {SPOT_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${d.kind === k ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {SPOT_KINDS[k].emoji} {SPOT_KINDS[k].label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={d.cuisine} onChange={(e) => set({ cuisine: e.target.value })} placeholder="Japonés, pizza, tapas…" aria-label="Tipo de comida" maxLength={40} className={input} />
          <div className="flex gap-0.5 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Precio">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={d.price === n} onClick={() => set({ price: d.price === n ? null : n })} className={`h-9 rounded-lg px-2 text-xs font-bold ${d.price === n ? 'bg-surface shadow-sm' : 'text-muted'}`}>
                {euros(n)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Estado">
          {(['want', 'been'] as SpotStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={d.status === s} onClick={() => set({ status: s })} className={`h-9 rounded-xl text-xs font-bold ${d.status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {s === 'want' ? 'Queremos ir' : 'Hemos ido'}
            </button>
          ))}
        </div>

        {d.status === 'been' && (
          <div className="space-y-3 rounded-2xl bg-stone-50 p-3">
            {PEOPLE_IDS.map((p) => (
              <div key={p} className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Nota de {PEOPLE[p].name}</span>
                <Stars value={d.rating[p]} onChange={(v) => set({ rating: { ...d.rating, [p]: v } })} label={`Nota de ${PEOPLE[p].name}`} />
              </div>
            ))}
            <textarea value={d.order} onChange={(e) => set({ order: e.target.value })} rows={2} placeholder="Qué pedir (y qué no)" aria-label="Qué pedir" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {d.visits.map((v) => (
                <button key={v} type="button" onClick={() => set({ visits: d.visits.filter((x) => x !== v) })} title="Tocar para quitar" className="rounded-full bg-surface px-2.5 py-1 font-semibold text-muted">
                  {dateFmt.format(parseYmd(v))} ×
                </button>
              ))}
              <label className="flex items-center gap-1 font-bold text-both">
                + Visita el
                <input type="date" value="" max={todayYmd()} onChange={(e) => e.target.value && set(addVisit(d, e.target.value))} aria-label="Añadir visita" className="h-8 rounded-lg border border-stone-200 bg-surface px-1.5 text-xs text-ink" />
              </label>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder={d.status === 'want' ? '¿Quién os lo recomendó? ¿Hay que reservar?' : 'Notas'} aria-label="Notas" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
          <input value={d.link} onChange={(e) => set({ link: e.target.value })} type="url" inputMode="url" placeholder="Enlace (carta, Instagram, reservas…)" aria-label="Enlace" className={input} />
        </div>

        <div className="flex flex-wrap gap-2">
          {valid && (
            <button
              type="button"
              onClick={() => {
                persist(addVisit(d, todayYmd()))
                onSaved?.()
                onClose()
              }}
              className="flex-1 rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700"
            >
              ✅ Hemos ido hoy
            </button>
          )}
          {valid && onPlan && (
            <button
              type="button"
              onClick={() => {
                if (dirty || !isEdit) persist()
                onPlan({ title: d.name.trim(), place: d.place, notes: [d.order, d.notes].filter(Boolean).join('\n') })
              }}
              className="flex-1 rounded-2xl bg-violet-50 py-3 text-sm font-bold text-violet-700"
            >
              📅 Ponerle fecha
            </button>
          )}
        </div>

        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{draft.name}»?</p>
              <button
                onClick={() => {
                  removeItem('spots', draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar sitio
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
