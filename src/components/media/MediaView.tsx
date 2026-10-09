import { useEffect, useRef, useState } from 'react'
import { saveMedia, useMedia, type MediaDraft } from '../../hooks/useMedia'
import { removeItem } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { searchCovers, type CoverHit } from '../../lib/covers'
import { compressImage } from '../../lib/image'
import { MEDIA_KINDS, MEDIA_ORDER, STATUS, WHERE, avgRating, roulettePool, sortMedia, yearStats, type Media, type MediaKind, type MediaStatus } from '../../lib/media'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'
import { MemorySheet } from '../memories/MemorySheet'

const PEOPLE_IDS: PersonId[] = ['nita', 'kitos']
const pad = (n: number) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const emptyMedia = (o: Partial<MediaDraft> = {}): MediaDraft => ({
  kind: 'peli',
  title: '',
  subtitle: '',
  cover: null,
  status: 'want',
  where: '',
  recommendedBy: '',
  progress: '',
  rating: { nita: null, kitos: null },
  comment: '',
  finishedAt: null,
  ...o,
})

/** Hemeroteca: lo que queréis ver o leer, lo que tenéis a medias y lo que ya visteis (con la nota de cada uno). */
export function MediaView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useMedia()
  const [status, setStatus] = useState<MediaStatus>('want')
  const [kind, setKind] = useState<MediaKind | 'all'>('all')
  const [sheet, openSheet, closeSheet] = useSheetState<MediaDraft>()
  const shown = sortMedia(items, status).filter((m) => kind === 'all' || m.kind === kind)
  const kindsUsed = MEDIA_ORDER.filter((k) => items.some((m) => m.kind === k))
  const count = (s: MediaStatus) => items.filter((m) => m.status === s).length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Lista">
        {(['want', 'doing', 'done'] as MediaStatus[]).map((s) => (
          <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)} className={`h-10 rounded-xl text-sm font-bold ${status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {STATUS[s].label}
            {count(s) > 0 && <span className="ml-1 text-xs font-semibold text-muted">{count(s)}</span>}
          </button>
        ))}
      </div>

      {kindsUsed.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {(['all', ...kindsUsed] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${kind === k ? 'bg-ink text-cream' : 'bg-surface shadow-sm'}`}>
              {k === 'all' ? 'Todo' : `${MEDIA_KINDS[k].emoji} ${MEDIA_KINDS[k].plural}`}
            </button>
          ))}
        </div>
      )}

      {status === 'want' && <Roulette items={items} onOpen={(m) => openSheet(m)} />}
      {status === 'done' && <YearCard items={items} />}

      {loading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-surface/70" />
      ) : shown.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">
          {status === 'want' ? 'Apuntad aquí lo que os recomiendan para que no se os olvide 🍿' : status === 'doing' ? 'Nada a medias ahora mismo.' : 'Aquí irá todo lo que veáis y leáis juntos.'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {shown.map((m) => (
            <MediaCard key={m.id} m={m} onOpen={() => openSheet(m)} />
          ))}
        </div>
      )}

      <button
        onClick={() => openSheet(emptyMedia({ status, kind: kind === 'all' ? 'peli' : kind, finishedAt: status === 'done' ? today() : null }))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Añadir
      </button>

      {sheet && <MediaSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

export function Cover({ m, className = '' }: { m: Pick<Media, 'cover' | 'kind' | 'title'>; className?: string }) {
  const [broken, setBroken] = useState(false)
  return m.cover && !broken ? (
    <img src={m.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`aspect-[2/3] w-full rounded-2xl bg-stone-100 object-cover ${className}`} />
  ) : (
    <div className={`grid aspect-[2/3] w-full place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-rose-100 p-2 text-center ${className}`}>
      <span>
        <span className="block text-3xl" aria-hidden>
          {MEDIA_KINDS[m.kind].emoji}
        </span>
        <span className="mt-1 line-clamp-3 block text-[11px] font-bold leading-tight text-ink/70">{m.title}</span>
      </span>
    </div>
  )
}

function MediaCard({ m, onOpen }: { m: Media; onOpen: () => void }) {
  const avg = avgRating(m)
  return (
    <button onClick={onOpen} className="text-left active:scale-[0.97]" aria-label={m.title}>
      <div className="relative">
        <Cover m={m} className="shadow-[0_4px_16px_-6px_rgba(42,34,51,0.15)]" />
        {avg !== null && <span className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">★ {avg.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>}
        {m.status === 'doing' && m.progress && <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-full bg-black/60 px-2 py-0.5 text-center text-[10px] font-bold text-white">{m.progress}</span>}
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-bold leading-tight">{m.title}</p>
      {m.where && <p className="truncate text-[10px] text-muted">{m.where}</p>}
    </button>
  )
}

function Roulette({ items, onOpen }: { items: Media[]; onOpen: (m: Media) => void }) {
  const [kind, setKind] = useState<MediaKind | 'all'>('all')
  const [spinning, setSpinning] = useState<string | null>(null)
  const [picked, setPicked] = useState<Media | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), [])
  const pool = roulettePool(items, kind)
  const kinds = MEDIA_ORDER.filter((k) => roulettePool(items, k).length > 0)
  if (roulettePool(items, 'all').length < 2) return null
  const spin = () => {
    if (!pool.length) return
    setPicked(null)
    let n = 0
    timer.current && clearInterval(timer.current)
    timer.current = setInterval(() => {
      setSpinning(pool[Math.floor(Math.random() * pool.length)].title)
      if (++n > 12) {
        clearInterval(timer.current!)
        setSpinning(null)
        const rest = pool.length > 1 && picked ? pool.filter((m) => m.id !== picked.id) : pool
        setPicked(rest[Math.floor(Math.random() * rest.length)])
        navigator.vibrate?.([20, 40, 60])
      }
    }, 80)
  }
  return (
    <div className="rounded-[28px] bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 p-4 text-white shadow-lg shadow-violet-300/40">
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        {(['all', ...kinds] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${kind === k ? 'bg-white text-violet-700' : 'bg-white/20'}`}>
            {k === 'all' ? 'Lo que sea' : `${MEDIA_KINDS[k].emoji} ${MEDIA_KINDS[k].label}`}
          </button>
        ))}
      </div>
      <button onClick={spin} disabled={spinning !== null || !pool.length} className="w-full rounded-2xl bg-white/20 py-3 text-lg font-extrabold active:scale-[0.98] disabled:opacity-60">
        🎲 ¿Qué vemos hoy?
      </button>
      <div className="mt-2 min-h-10 text-center" aria-live="polite">
        {spinning ? (
          <p className="text-lg font-extrabold opacity-80">{spinning}</p>
        ) : picked ? (
          <button onClick={() => onOpen(picked)} className="animate-pop mx-auto flex items-center gap-3 text-left">
            {picked.cover && <img src={picked.cover} alt="" referrerPolicy="no-referrer" className="h-16 w-11 rounded-lg object-cover" />}
            <span>
              <span className="block text-xl font-extrabold leading-tight">{picked.title}</span>
              <span className="block text-xs opacity-90">
                {MEDIA_KINDS[picked.kind].emoji} {MEDIA_KINDS[picked.kind].label}
                {picked.where && ` · ${picked.where}`}
              </span>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  )
}

function YearCard({ items }: { items: Media[] }) {
  const year = new Date().getFullYear()
  const s = yearStats(items, year)
  if (!s.total) return null
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Vuestro {year}</p>
      <p className="mt-1 text-2xl font-extrabold">
        {s.total} {s.total === 1 ? 'cosa juntos' : 'cosas juntos'}
      </p>
      <p className="text-sm text-muted">{s.byKind.map((k) => `${MEDIA_KINDS[k.kind].emoji} ${k.n} ${(k.n === 1 ? MEDIA_KINDS[k.kind].label : MEDIA_KINDS[k.kind].plural).toLowerCase()}`).join(' · ')}</p>
      {s.best && (
        <p className="mt-2 text-sm">
          🏆 La mejor: <b>{s.best.title}</b> (★ {avgRating(s.best)!.toLocaleString('es-ES', { maximumFractionDigits: 1 })})
        </p>
      )}
      {s.argued && (
        <p className="text-sm">
          🥊 La que más discutisteis: <b>{s.argued.title}</b> ({PEOPLE.nita.name} {s.argued.rating.nita} · {PEOPLE.kitos.name} {s.argued.rating.kitos})
        </p>
      )}
    </div>
  )
}

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

const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

export function MediaSheet({ draft, me, onClose, onError, onSaved }: { draft: MediaDraft; me: PersonId; onClose: () => void; onError: (m: string) => void; onSaved?: () => void }) {
  const [d, setD] = useState(draft)
  const [hits, setHits] = useState<CoverHit[]>([])
  const [searching, setSearching] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [memory, setMemory] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const set = (o: Partial<MediaDraft>) => setD((x) => ({ ...x, ...o }))
  const K = MEDIA_KINDS[d.kind]

  // Portadas: se buscan solas al escribir el título (si aún no tiene una).
  useEffect(() => {
    if (d.cover || d.title.trim().length < 3) {
      setHits([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setSearching(true)
      searchCovers(d.kind, d.title, ctrl.signal)
        .then((h) => !ctrl.signal.aborted && setHits(h))
        .finally(() => !ctrl.signal.aborted && setSearching(false))
    }, 500)
    return () => {
      ctrl.abort()
      clearTimeout(t)
    }
  }, [d.title, d.kind, d.cover])

  const setStatus = (status: MediaStatus) => set({ status, finishedAt: status === 'done' ? (d.finishedAt ?? today()) : d.finishedAt })
  const persist = () => saveMedia({ ...d, title: d.title.trim(), subtitle: d.subtitle.trim(), where: d.where.trim(), recommendedBy: d.recommendedBy.trim(), progress: d.progress.trim(), comment: d.comment.trim() }, me, onError)
  const save = () => {
    if (!d.title.trim()) return
    persist()
    onSaved?.()
    onClose()
  }
  const photo = async (f: File | undefined) => {
    if (!f) return
    try {
      set({ cover: (await compressImage(f, 480)).dataUrl })
    } catch (e) {
      onError((e as Error).message)
    }
  }

  if (memory)
    return (
      <MemorySheet
        draft={{ title: d.title, date: d.finishedAt ?? today(), kind: 'free', planId: null, place: null, text: d.comment }}
        me={me}
        onClose={() => {
          setMemory(false)
          onClose()
        }}
        onError={onError}
      />
    )

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? `${K.emoji} ${d.title || K.label}` : 'Añadir a la hemeroteca'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!d.title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Tipo">
          {MEDIA_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${d.kind === k ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {MEDIA_KINDS[k].emoji} {MEDIA_KINDS[k].label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="w-24 shrink-0">
            <Cover m={d} />
            <div className="mt-1 flex justify-center gap-2 text-[11px] font-bold">
              <button type="button" onClick={() => file.current?.click()} className="text-both">
                📷 Foto
              </button>
              {d.cover && (
                <button type="button" onClick={() => set({ cover: null })} className="text-muted">
                  Quitar
                </button>
              )}
            </div>
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => photo(e.target.files?.[0])} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input autoFocus={!isEdit} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={d.kind === 'libro' ? 'Título del libro' : 'Título'} aria-label="Título" maxLength={120} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-1.5 text-lg font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 18 }} />
            <input value={d.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder={d.kind === 'libro' ? 'Autor' : 'Año, director…'} aria-label="Detalle" maxLength={120} className={`${input} h-10 text-sm font-medium`} />
          </div>
        </div>

        {!d.cover && (hits.length > 0 || searching) && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">{searching ? 'Buscando portada…' : '¿Es alguna de estas? Toca para ponerle la portada'}</p>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {hits.map((h) => (
                <button key={h.image} type="button" onClick={() => set({ cover: h.image, subtitle: d.subtitle || h.subtitle.slice(0, 120) })} className="w-20 shrink-0 text-left" title={h.subtitle}>
                  <img src={h.image} alt={h.title} referrerPolicy="no-referrer" className="aspect-[2/3] w-full rounded-xl bg-stone-100 object-cover" />
                  <span className="mt-0.5 line-clamp-2 block text-[10px] font-semibold leading-tight">{h.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Estado">
          {(['want', 'doing', 'done'] as MediaStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={d.status === s} onClick={() => setStatus(s)} className={`h-9 rounded-xl text-xs font-bold ${d.status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {s === 'want' ? 'Pendiente' : s === 'doing' ? K.doing : K.done}
            </button>
          ))}
        </div>

        {d.status === 'doing' && (d.kind === 'serie' || d.kind === 'libro') && (
          <input value={d.progress} onChange={(e) => set({ progress: e.target.value })} placeholder={d.kind === 'libro' ? 'Por dónde vais: pág. 120' : 'Por dónde vais: T2 E5'} aria-label="Por dónde vais" maxLength={40} className={input} />
        )}

        {d.status === 'done' && (
          <div className="space-y-3 rounded-2xl bg-stone-50 p-3">
            {PEOPLE_IDS.map((p) => (
              <div key={p} className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Nota de {PEOPLE[p].name}</span>
                <Stars value={d.rating[p]} onChange={(v) => set({ rating: { ...d.rating, [p]: v } })} label={`Nota de ${PEOPLE[p].name}`} />
              </div>
            ))}
            <input type="date" value={d.finishedAt ?? ''} max={today()} onChange={(e) => set({ finishedAt: e.target.value || null })} aria-label="Cuándo" className={`${input} h-10 text-sm`} />
          </div>
        )}

        <div className="space-y-2">
          <input value={d.where} onChange={(e) => set({ where: e.target.value })} list="media-where" placeholder={d.kind === 'libro' ? 'Formato: papel, Kindle…' : 'Dónde: Netflix, cine…'} aria-label="Dónde" maxLength={40} className={input} />
          <datalist id="media-where">
            {WHERE.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
          <input value={d.recommendedBy} onChange={(e) => set({ recommendedBy: e.target.value })} placeholder="¿Quién os la recomendó?" aria-label="Recomendada por" maxLength={60} className={input} />
          <textarea value={d.comment} onChange={(e) => set({ comment: e.target.value })} rows={2} placeholder={d.status === 'done' ? '¿Qué os pareció?' : 'Notas'} aria-label="Comentario" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        </div>

        {d.status === 'done' && d.finishedAt && (
          <button type="button" onClick={() => {
              if (dirty || !isEdit) persist()
              setMemory(true)
            }} disabled={!d.title.trim()} className="w-full rounded-2xl bg-amber-50 py-3 text-sm font-bold text-amber-800 disabled:opacity-40">
            📸 Guardar también en el diario {d.finishedAt && `(${dateFmt.format(parse(d.finishedAt))})`}
          </button>
        )}

        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Quitar «{draft.title}»?</p>
              <button
                onClick={() => {
                  removeItem('media', draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Quitar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Quitar
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
