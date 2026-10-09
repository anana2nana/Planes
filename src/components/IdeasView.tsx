import { useEffect, useRef, useState } from 'react'
import { useIdeas } from '../hooks/useIdeas'
import { useSheetState } from '../hooks/useSheetState'
import { IDEA_CATEGORIES, IDEA_ORDER, IDEA_OWN, MOVED_TO, pickRandom, type Idea, type IdeaCategory } from '../lib/ideas'
import { useMedia } from '../hooks/useMedia'
import { useSpots } from './spots/SpotsView'
import { useTrips } from './trips/TripsView'
import type { PlaceInfo } from '../lib/types'
import type { PersonId } from '../lib/types'
import { deleteIdea, saveIdea, setIdeaDone } from '../services/ideas'
import { Avatar } from './Avatar'
import { BottomSheet } from './BottomSheet'
import { DirectionsLink } from './DirectionsLink'
import { NavigateIcon, PinIcon, PlusIcon, TrashIcon } from './Icons'
import { PlaceField } from './PlaceField'

/** Lista "Algún día": ideas sin fecha y la ruleta "¿Qué hacemos hoy?". */
/** Algo para la ruleta: una idea de aquí o algo pendiente de Sitios, la Hemeroteca o Viajes. */
interface PoolItem {
  id: string
  title: string
  category: IdeaCategory
  place: PlaceInfo | null
  notes: string
  idea: Idea | null
}

export function IdeasView({
  me,
  onMakePlan,
  onPlan,
  onGo,
  onError,
}: {
  me: PersonId
  onMakePlan: (idea: Idea) => void
  onPlan: (p: { title: string; place: PlaceInfo | null; notes: string }) => void
  onGo: (section: 'sitios' | 'hemeroteca' | 'viajes') => void
  onError: (m: string) => void
}) {
  const ideas = useIdeas()
  const [filter, setFilter] = useState<IdeaCategory | null>(null)
  const [sheet, openSheet, closeSheet] = useSheetState<Idea | 'new'>()
  const [picked, setPicked] = useState<PoolItem | null>(null)
  const [spinning, setSpinning] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const pending = ideas.filter((i) => !i.done && (!filter || i.category === filter))
  // Lo pendiente de los otros módulos también entra en la ruleta (sin copiarlo aquí).
  const { items: spots } = useSpots()
  const { items: media } = useMedia()
  const { items: trips } = useTrips()
  const others: PoolItem[] = [
    ...spots.filter((x) => x.status === 'want').map((x) => ({ id: `spot-${x.id}`, title: x.name, category: 'comer' as const, place: x.place, notes: [x.cuisine, x.notes].filter(Boolean).join(' · '), idea: null })),
    ...media.filter((x) => x.status === 'want' && ['peli', 'serie', 'docu'].includes(x.kind)).map((x) => ({ id: `media-${x.id}`, title: x.title, category: 'peli' as const, place: null, notes: x.where, idea: null })),
    ...trips.filter((x) => !x.start).map((x) => ({ id: `trip-${x.id}`, title: x.title, category: 'escapada' as const, place: x.destination, notes: x.notes, idea: null })),
  ]
  const pool: PoolItem[] = [...pending.map((i) => ({ ...i, idea: i })), ...others.filter((o) => !filter || o.category === filter)]
  const counts = { comer: others.filter((o) => o.category === 'comer').length, peli: others.filter((o) => o.category === 'peli').length, escapada: others.filter((o) => o.category === 'escapada').length }
  const done = ideas.filter((i) => i.done)
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), [])

  // Ruleta: va pasando nombres un momento y se para en uno al azar.
  const spin = () => {
    if (pool.length === 0) return
    setPicked(null)
    let n = 0
    timer.current && clearInterval(timer.current)
    timer.current = setInterval(() => {
      setSpinning(pool[Math.floor(Math.random() * pool.length)].title)
      if (++n > 12) {
        clearInterval(timer.current!)
        setSpinning(null)
        setPicked(pickRandom(pool, picked?.id))
        navigator.vibrate?.([20, 40, 60])
      }
    }, 80)
  }

  return (
    <div className="space-y-5">
      {/* Ruleta */}
      <div className="rounded-[28px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 p-5 text-white shadow-lg shadow-fuchsia-300/40">
        <button
          onClick={spin}
          disabled={pool.length === 0 || spinning !== null}
          className="w-full rounded-2xl bg-white/20 py-3.5 text-lg font-extrabold backdrop-blur-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          🎲 ¿Qué hacemos hoy?
        </button>
        <div className="mt-3 min-h-16 text-center" aria-live="polite">
          {spinning ? (
            <p className="text-xl font-extrabold opacity-80">{spinning}</p>
          ) : picked ? (
            <div className="animate-pop">
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                {IDEA_CATEGORIES[picked.category].emoji} {IDEA_CATEGORIES[picked.category].label}
              </p>
              <p className="text-2xl font-extrabold leading-tight">{picked.title}</p>
              {picked.place && <p className="mt-0.5 truncate text-sm opacity-90">📍 {picked.place.name}</p>}
              <div className="mt-3 flex justify-center gap-2">
                <button onClick={() => (picked.idea ? onMakePlan(picked.idea) : onPlan({ title: picked.title, place: picked.place, notes: picked.notes }))} className="rounded-full bg-surface px-4 py-2 text-sm font-bold text-violet-700 active:scale-95">
                  ¡Vamos! Ponerle fecha
                </button>
                <button onClick={spin} className="rounded-full bg-white/20 px-4 py-2 text-sm font-bold active:scale-95">
                  Otra
                </button>
              </div>
            </div>
          ) : (
            <p className="pt-3 text-sm opacity-90">
              {pool.length === 0 ? 'Añadid ideas y la ruleta elegirá por vosotros.' : `Entre ${pool.length} ${pool.length === 1 ? 'opción' : 'opciones'}${filter ? ` de ${IDEA_CATEGORIES[filter].label.toLowerCase()}` : ''} (también de Sitios, la Hemeroteca y Viajes)`}
            </p>
          )}
        </div>
      </div>

      {/* Categorías */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Tipo de idea">
        {[null, ...IDEA_ORDER].map((c) => {
          const active = filter === c
          return (
            <button
              key={c ?? 'all'}
              role="radio"
              aria-checked={active}
              onClick={() => {
                setFilter(c)
                setPicked(null)
              }}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-95 ${
                active ? 'bg-ink text-cream' : 'bg-surface text-ink shadow-sm'
              }`}
            >
              {c ? (
                <>
                  <span aria-hidden>{IDEA_CATEGORIES[c].emoji}</span> {IDEA_CATEGORIES[c].label}
                </>
              ) : (
                'Todas'
              )}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div className="space-y-2.5">
        {pending.map((i) => (
          <IdeaCard key={i.id} idea={i} onOpen={() => openSheet(i)} />
        ))}
        {(['comer', 'peli', 'escapada'] as const)
          .filter((c) => !filter || filter === c)
          .map((c) => (
            <button key={c} onClick={() => onGo(MOVED_TO[c]!.section)} className="flex w-full items-center gap-3 rounded-3xl bg-surface/70 p-3.5 text-left text-sm active:scale-[0.99]">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-stone-100 text-xl" aria-hidden>
                {IDEA_CATEGORIES[c].emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c === 'comer' ? 'Sitios para comer y salir' : c === 'peli' ? 'Pelis y series pendientes' : 'Escapadas sin fecha'}</span>
                <span className="block text-xs text-muted">
                  {counts[c] ? `${counts[c]} en ${MOVED_TO[c]!.label}` : `Se apuntan en ${MOVED_TO[c]!.label}`} · entran en la ruleta
                </span>
              </span>
              <span className="text-xs font-bold text-both">Ir →</span>
            </button>
          ))}
        <button
          onClick={() => openSheet('new')}
          className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
        >
          <PlusIcon className="size-4" /> Añadir idea
        </button>
      </div>

      {done.length > 0 && (
        <section>
          <button onClick={() => setShowDone((v) => !v)} className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted" aria-expanded={showDone}>
            {showDone ? '▾' : '▸'} Ya hechas · {done.length}
          </button>
          {showDone && (
            <div className="space-y-2 opacity-70">
              {done.map((i) => (
                <IdeaCard key={i.id} idea={i} onOpen={() => openSheet(i)} />
              ))}
            </div>
          )}
        </section>
      )}

      {sheet && <IdeaForm idea={sheet === 'new' ? null : sheet} defaultCategory={filter && IDEA_OWN.includes(filter) ? filter : 'plan'} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function IdeaCard({ idea, onOpen }: { idea: Idea; onOpen: () => void }) {
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-stone-100 text-xl" aria-hidden>
          {IDEA_CATEGORIES[idea.category].emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${idea.done ? 'line-through' : ''}`}>{idea.title}</span>
          {(idea.place || idea.notes) && (
            <span className="flex items-center gap-1 truncate text-xs text-muted">
              {idea.place && <PinIcon className="size-3 shrink-0 text-rose-400" />}
              {idea.place?.name ?? idea.notes}
            </span>
          )}
        </span>
        {idea.addedBy && <Avatar mode={idea.addedBy} size="xs" />}
      </button>
      {idea.place && !idea.done && (
        <DirectionsLink place={idea.place} className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700 active:scale-95">
          <NavigateIcon className="size-5" />
        </DirectionsLink>
      )}
    </article>
  )
}

function IdeaForm({ idea, defaultCategory, me, onClose, onError }: { idea: Idea | null; defaultCategory: IdeaCategory; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState(idea?.title ?? '')
  const [category, setCategory] = useState<IdeaCategory>(idea?.category ?? defaultCategory)
  const [place, setPlace] = useState(idea?.place ?? null)
  const [notes, setNotes] = useState(idea?.notes ?? '')
  const initial = JSON.stringify([idea?.title ?? '', idea?.category ?? defaultCategory, idea?.place ?? null, idea?.notes ?? ''])
  const dirty = JSON.stringify([title, category, place, notes]) !== initial
  const canSave = title.trim() !== ''

  const save = () => {
    if (!canSave) return
    saveIdea({ id: idea?.id, title: title.trim(), category, place, notes: notes.trim() }, me).catch((e: Error) => onError(e.message))
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={idea ? `${IDEA_CATEGORIES[category].emoji} Idea` : 'Nueva idea'}
      footer={
        !idea || dirty ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {idea ? 'Guardar cambios' : 'Añadir idea'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <input
          autoFocus={!idea}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Escape room, clase de cerámica, ir a un concierto…"
          aria-label="Idea"
          maxLength={120}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          {(IDEA_OWN.includes(category) ? IDEA_OWN : [category, ...IDEA_OWN]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${category === c ? 'bg-ink text-cream' : 'bg-stone-100'}`}
            >
              {IDEA_CATEGORIES[c].emoji} {IDEA_CATEGORIES[c].label}
            </button>
          ))}
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Dónde (opcional)</span>
          <PlaceField value={place} onChange={setPlace} />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas: quién lo recomendó, qué pedir…"
          aria-label="Notas"
          className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both"
        />
        {idea && (
          <div className="flex flex-wrap justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => {
                setIdeaDone(idea.id, !idea.done).catch((e: Error) => onError(e.message))
                onClose()
              }}
              className="text-sm font-semibold text-both"
            >
              {idea.done ? '↺ Volver a pendientes' : '✓ Marcar como hecha'}
            </button>
            <button
              type="button"
              onClick={() => {
                deleteIdea(idea.id).catch((e: Error) => onError(e.message))
                onClose()
              }}
              className="flex items-center gap-1 text-sm font-semibold text-rose-600"
            >
              <TrashIcon className="size-4" /> Borrar
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
