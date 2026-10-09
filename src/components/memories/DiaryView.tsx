import { useEffect, useState } from 'react'
import { deleteMemory, loadPhotos, useMemories, type MemoryDraft, type MemoryPhoto } from '../../hooks/useMemories'
import { useLayer } from '../../hooks/useLayer'
import { byMonth, onThisDay, yearsAgo, ymd, type Memory } from '../../lib/memories'
import type { PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { DirectionsLink } from '../DirectionsLink'
import { ChevronIcon, NavigateIcon, PlusIcon, TrashIcon } from '../Icons'
import { MemorySheet } from './MemorySheet'

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
const longFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const KIND_EMOJI: Record<Memory['kind'], string> = { plan: '💞', event: '📅', task: '🧹', free: '✨' }

export const toMemoryDraft = (m: Memory): MemoryDraft => ({ id: m.id, title: m.title, date: m.date, kind: m.kind, planId: m.planId, place: m.place, text: m.text })

/** El diario: recuerdos por meses, "tal día como hoy" y recuerdos sueltos. */
export function DiaryView({ me, onError, openId }: { me: PersonId; onError: (m: string) => void; openId?: string | null }) {
  const { memories, loading } = useMemories()
  const [viewing, setViewing] = useState<string | null>(openId ?? null)
  const [editing, setEditing] = useState<{ draft: MemoryDraft; thumb: string | null } | null>(null)
  const today = new Date()
  const otd = onThisDay(memories, today)
  const current = viewing ? memories.find((m) => m.id === viewing) : undefined
  const photos = memories.reduce((n, m) => n + m.photoCount, 0)

  return (
    <div className="space-y-5">
      {otd.length > 0 && (
        <button onClick={() => setViewing(otd[0].memory.id)} className="relative block w-full overflow-hidden rounded-[28px] text-left shadow-lg">
          {otd[0].memory.thumb ? <img src={otd[0].memory.thumb} alt="" className="h-44 w-full object-cover" /> : <div className="h-28 bg-gradient-to-br from-amber-300 to-rose-400" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wider opacity-90">✨ Tal día como hoy, {yearsAgo(otd[0].years)}</p>
            <p className="text-xl font-extrabold leading-tight">{otd[0].memory.title}</p>
            {otd.length > 1 && <p className="text-xs opacity-90">y {otd.length - 1} más</p>}
          </div>
        </button>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : memories.length === 0 ? (
        <div className="rounded-3xl bg-surface p-6 text-center shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          <div className="text-5xl">📸</div>
          <p className="mt-3 font-bold">Vuestro diario</p>
          <p className="mt-1 text-sm text-muted">Cada vez que completéis un plan os preguntaré por una foto y una frase. Con el tiempo, aquí estará todo lo que habéis hecho juntos.</p>
        </div>
      ) : (
        <>
          <p className="px-1 text-xs font-semibold text-muted">
            {memories.length} {memories.length === 1 ? 'recuerdo' : 'recuerdos'} · {photos} {photos === 1 ? 'foto' : 'fotos'}
          </p>
          {byMonth(memories).map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{g.label}</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {g.items.map((m) => (
                  <MemoryCard key={m.id} memory={m} onOpen={() => setViewing(m.id)} />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      <button
        onClick={() => setEditing({ draft: { title: '', date: ymd(today), kind: 'free', planId: null, place: null, text: '' }, thumb: null })}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Añadir un recuerdo
      </button>

      {current && <MemoryView memory={current} onClose={() => setViewing(null)} onEdit={() => setEditing({ draft: toMemoryDraft(current), thumb: current.thumb })} onError={onError} />}
      {editing && <MemorySheet draft={editing.draft} thumb={editing.thumb} me={me} onClose={() => setEditing(null)} onError={onError} />}
    </div>
  )
}

function MemoryCard({ memory, onOpen }: { memory: Memory; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="overflow-hidden rounded-3xl bg-surface text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] active:scale-[0.98]">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-amber-100 to-rose-100">
        {memory.thumb ? (
          <img src={memory.thumb} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="grid size-full place-items-center text-4xl" aria-hidden>
            {KIND_EMOJI[memory.kind]}
          </span>
        )}
        {memory.photoCount > 1 && <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">📷 {memory.photoCount}</span>}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-bold">{memory.title}</p>
        <p className="truncate text-[11px] text-muted">
          {dayFmt.format(parse(memory.date))}
          {memory.place && ` · ${memory.place.name}`}
        </p>
        {memory.text && <p className="mt-0.5 line-clamp-2 text-xs text-ink/80">{memory.text}</p>}
      </div>
    </button>
  )
}

/** Un recuerdo a pantalla completa: fotos grandes deslizables, la frase y el sitio. */
export function MemoryView({ memory, onClose, onEdit, onError }: { memory: Memory; onClose: () => void; onEdit: () => void; onError: (m: string) => void }) {
  const close = useLayer('memoryView', onClose)
  const [photos, setPhotos] = useState<MemoryPhoto[] | null>(null)
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    loadPhotos(memory.id)
      .then(setPhotos)
      .catch((e: Error) => onError(e.message))
  }, [memory.id, memory.photoCount, memory.thumb, onError])

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={memory.title}>
      <div className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-cream/90 px-3 pb-2 backdrop-blur-xl">
        <button onClick={close} aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm">
          <ChevronIcon className="size-4 rotate-180" />
        </button>
        <p className="min-w-0 flex-1 truncate font-extrabold">{memory.title}</p>
        <button onClick={onEdit} className="rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-cream">
          Editar
        </button>
      </div>
      <main className="mx-auto max-w-2xl space-y-4 pb-24">
        {memory.photoCount > 0 && (
          <div className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
            {(photos ?? []).map((p) => (
              <img key={p.id} src={p.data} alt="" className="max-h-[70vh] w-[88%] shrink-0 snap-center rounded-3xl object-cover" />
            ))}
            {photos === null && <div className="aspect-[4/3] w-[88%] shrink-0 animate-pulse rounded-3xl bg-surface" />}
          </div>
        )}
        <div className="space-y-3 px-4">
          <div>
            <p className="text-xs font-bold text-muted first-letter:uppercase">{longFmt.format(parse(memory.date))}</p>
            <h1 className="text-2xl font-extrabold leading-tight">{memory.title}</h1>
          </div>
          {memory.text && <p className="whitespace-pre-wrap text-lg leading-relaxed">{memory.text}</p>}
          {memory.place && (
            <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">📍 {memory.place.name}</span>
                <span className="block truncate text-xs text-muted">{memory.place.address}</span>
              </span>
              <DirectionsLink place={memory.place} className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-50 text-sky-700">
                <NavigateIcon className="size-5" />
              </DirectionsLink>
            </div>
          )}
          {memory.by && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Avatar mode={memory.by} size="xs" /> Lo guardó {memory.by === 'nita' ? 'Nita' : 'Kitos'}
            </p>
          )}
          <div className="pt-4">
            {confirm ? (
              <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
                <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar este recuerdo y sus fotos?</p>
                <button
                  onClick={() => {
                    deleteMemory(memory.id).catch((e: Error) => onError(e.message))
                    close()
                  }}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
                >
                  Borrar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
                <TrashIcon className="size-4" /> Borrar recuerdo
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
