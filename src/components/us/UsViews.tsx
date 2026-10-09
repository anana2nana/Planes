import { useState } from 'react'
import { Timestamp, collection, doc, getDoc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { millis, oneOf, person, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useLayer } from '../../hooks/useLayer'
import { useSheetState } from '../../hooks/useSheetState'
import { ymdOf } from '../../lib/due'
import { PEOPLE } from '../../lib/people'
import type { AssignMode, PersonId } from '../../lib/types'
import { MILESTONE_EMOJIS, capsuleState, opensIn, spotifySearch, timeline, yearsBetween, youtubeSearch, type Milestone } from '../../lib/us'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { CloseIcon, PlusIcon, TrashIcon } from '../Icons'

const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const area = 'w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both'
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const longFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function Confirm({ text, onYes }: { text: string; onYes: () => void }) {
  const [ask, setAsk] = useState(false)
  return ask ? (
    <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
      <p className="flex-1 text-sm font-semibold text-rose-700">{text}</p>
      <button onClick={onYes} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">
        Borrar
      </button>
    </div>
  ) : (
    <button type="button" onClick={() => setAsk(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
      <TrashIcon className="size-4" /> Borrar
    </button>
  )
}

// ─── 🎵 Banda sonora ────────────────────────────────────────────────────────

export interface Song {
  id: string
  title: string
  artist: string
  story: string
  date: string | null
  by: PersonId | null
  createdAt: number
}
const parseSong = (id: string, x: Record<string, any>): Song => ({ id, title: str(x.title), artist: str(x.artist), story: str(x.story), date: str(x.date) || null, by: person(x.createdBy), createdAt: millis(x.createdAt) })
export const useSongs = () => useList('songs', parseSong)
type SongDraft = Omit<Song, 'id' | 'createdAt' | 'by'> & { id?: string }

/** Vuestras canciones, cada una con su historia. */
export function SongsView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useSongs()
  const [sheet, openSheet, closeSheet] = useSheetState<SongDraft>()
  const list = [...items].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.createdAt - b.createdAt)
  return (
    <div className="space-y-3">
      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-surface/70" />
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">La de vuestra primera cita, la del viaje, la que siempre cantáis en el coche… 🎶</p>
      ) : (
        list.map((s) => (
          <div key={s.id} className={card}>
            <button onClick={() => openSheet(s)} className="block w-full text-left">
              <p className="text-lg font-extrabold leading-tight">🎵 {s.title}</p>
              {s.artist && <p className="text-sm font-semibold text-muted">{s.artist}</p>}
              {s.story && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{s.story}</p>}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                {s.by && <Avatar mode={s.by} size="xs" />}
                {s.date && longFmt.format(parseYmd(s.date))}
              </p>
            </button>
            <div className="mt-3 flex gap-2">
              <a href={spotifySearch(s.title, s.artist)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                ▶ Spotify
              </a>
              <a href={youtubeSearch(s.title, s.artist)} target="_blank" rel="noreferrer" className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                ▶ YouTube
              </a>
            </div>
          </div>
        ))
      )}
      <button onClick={() => openSheet({ title: '', artist: '', story: '', date: null })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Añadir canción
      </button>
      {sheet && (
        <SongSheet
          draft={sheet}
          onClose={closeSheet}
          onSave={(s) => saveItem('songs', s, me, onError)}
          onDelete={sheet.id ? () => removeItem('songs', sheet.id!).catch((e: Error) => onError(e.message)) : undefined}
        />
      )}
    </div>
  )
}

function SongSheet({ draft, onClose, onSave, onDelete }: { draft: SongDraft; onClose: () => void; onSave: (s: SongDraft) => void; onDelete?: () => void }) {
  const [d, setD] = useState(draft)
  const set = (o: Partial<SongDraft>) => setD((x) => ({ ...x, ...o }))
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={draft.id ? 'Canción' : 'Nueva canción'}
      footer={
        <button
          onClick={() => {
            onSave({ ...d, title: d.title.trim(), artist: d.artist.trim(), story: d.story.trim() })
            onClose()
          }}
          disabled={!d.title.trim()}
          className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30"
        >
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <input autoFocus={!draft.id} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Canción" aria-label="Canción" maxLength={100} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />
        <input value={d.artist} onChange={(e) => set({ artist: e.target.value })} placeholder="Artista" aria-label="Artista" maxLength={80} className={input} />
        <textarea value={d.story} onChange={(e) => set({ story: e.target.value })} rows={4} placeholder="¿Por qué es vuestra?" aria-label="Historia" className={area} />
        <label className="block text-xs font-semibold text-muted">
          Desde cuándo (opcional)
          <input type="date" value={d.date ?? ''} max={ymdOf(new Date())} onChange={(e) => set({ date: e.target.value || null })} aria-label="Fecha de la canción" className={input} />
        </label>
        {onDelete && (
          <Confirm
            text="¿Borrar la canción?"
            onYes={() => {
              onDelete()
              onClose()
            }}
          />
        )}
      </div>
    </BottomSheet>
  )
}

// ─── 📍 Hitos ───────────────────────────────────────────────────────────────

const parseMilestone = (id: string, x: Record<string, any>): Milestone => ({ id, date: str(x.date) || ymdOf(new Date()), title: str(x.title), emoji: str(x.emoji) || '⭐', text: str(x.text) })
export const useMilestones = () => useList('milestones', parseMilestone)
type MilestoneDraft = Omit<Milestone, 'id' | 'auto'> & { id?: string }

/** La línea del tiempo de la relación. */
export function MilestonesView({ me, since, onError }: { me: PersonId; since: string | null; onError: (m: string) => void }) {
  const { items, loading } = useMilestones()
  const [sheet, openSheet, closeSheet] = useSheetState<MilestoneDraft>()
  const today = new Date()
  const list = timeline(items, since)
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-surface/70" />
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">Primera cita, primer «te quiero», primer viaje, la gata, MEROE… vuestra historia en una línea.</p>
      ) : (
        <ol className="relative ml-5 space-y-4 border-l-2 border-stone-200 pl-6">
          {list.map((m) => {
            const y = yearsBetween(m.date, today)
            return (
              <li key={m.id} className="relative">
                <span className="absolute -left-[42px] top-0 grid size-9 place-items-center rounded-full bg-surface text-lg shadow-sm ring-2 ring-stone-200" aria-hidden>
                  {m.emoji}
                </span>
                <button disabled={m.auto} onClick={() => openSheet(m)} className={`${card} block w-full p-3.5 text-left`}>
                  <p className="text-xs font-bold text-muted first-letter:uppercase">
                    {longFmt.format(parseYmd(m.date))}
                    {y > 0 && ` · hace ${y} ${y === 1 ? 'año' : 'años'}`}
                  </p>
                  <p className="font-extrabold">{m.title}</p>
                  {m.text && <p className="mt-1 whitespace-pre-wrap text-sm">{m.text}</p>}
                  {m.auto && <p className="mt-1 text-[11px] text-muted">Lo cambiáis en Ajustes → Nosotros</p>}
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <button onClick={() => openSheet({ date: ymdOf(today), title: '', emoji: '⭐', text: '' })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Añadir hito
      </button>
      {sheet && <MilestoneSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function MilestoneSheet({ draft, me, onClose, onError }: { draft: MilestoneDraft; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const set = (o: Partial<MilestoneDraft>) => setD((x) => ({ ...x, ...o }))
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={draft.id ? 'Hito' : 'Nuevo hito'}
      footer={
        <button
          onClick={() => {
            saveItem('milestones', { ...d, title: d.title.trim(), text: d.text.trim() }, me, onError)
            onClose()
          }}
          disabled={!d.title.trim() || !d.date}
          className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30"
        >
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Icono">
          {MILESTONE_EMOJIS.map((e) => (
            <button key={e} type="button" role="radio" aria-checked={d.emoji === e} onClick={() => set({ emoji: e })} className={`grid size-10 place-items-center rounded-xl text-xl ${d.emoji === e ? 'bg-both-soft ring-2 ring-both' : 'bg-stone-100'}`}>
              {e}
            </button>
          ))}
        </div>
        <input autoFocus={!draft.id} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Primera cita, nos mudamos…" aria-label="Hito" maxLength={100} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />
        <input type="date" value={d.date} max={ymdOf(new Date())} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Fecha del hito" className={input} />
        <textarea value={d.text} onChange={(e) => set({ text: e.target.value })} rows={3} placeholder="Cómo fue (opcional)" aria-label="Cómo fue" className={area} />
        {draft.id && (
          <Confirm
            text="¿Borrar este hito?"
            onYes={() => {
              removeItem('milestones', draft.id!).catch((e: Error) => onError(e.message))
              onClose()
            }}
          />
        )}
      </div>
    </BottomSheet>
  )
}

// ─── 💌 Cápsula del tiempo ─────────────────────────────────────────────────

export interface Capsule {
  id: string
  from: PersonId
  to: AssignMode
  openAt: string
  title: string
  openedAt: number | null
  createdAt: number
}
const parseCapsule = (id: string, x: Record<string, any>): Capsule => ({
  id,
  from: person(x.from) ?? 'nita',
  to: oneOf<AssignMode>(x.to, ['nita', 'kitos', 'both'], 'both'),
  openAt: str(x.openAt) || ymdOf(new Date()),
  title: str(x.title),
  openedAt: x.openedAt ? millis(x.openedAt) : null,
  createdAt: millis(x.createdAt),
})
export const useCapsules = () => useList('capsules', parseCapsule)

/** Una carta se puede leer si la escribiste tú o si ya ha llegado su día (lo comprueba la base de datos). */
const canRead = (c: Capsule, me: PersonId, today: Date) => c.from === me || capsuleState(c.openAt, today).open

/** Cartas que solo se pueden abrir a partir de una fecha. */
export function CapsuleView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useCapsules()
  const [writing, setWriting] = useState<{ capsule: Capsule | null; text: string } | null>(null)
  const [reading, setReading] = useState<{ capsule: Capsule; text: string } | null>(null)
  const today = new Date()
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const forMe = items.filter((c) => c.from !== me && (c.to === me || c.to === 'both')).sort((a, b) => a.openAt.localeCompare(b.openAt))
  const fromMe = items.filter((c) => c.from === me).sort((a, b) => a.openAt.localeCompare(b.openAt))

  const open = async (c: Capsule, edit = false) => {
    if (!canRead(c, me, today)) return onError(`🔒 ${opensIn(capsuleState(c.openAt, today).days)}`)
    try {
      const snap = await getDoc(doc(db, 'capsuleLetters', c.id))
      const text = str(snap.get('text'))
      if (edit) setWriting({ capsule: c, text })
      else {
        setReading({ capsule: c, text })
        if (c.from !== me && !c.openedAt) updateDoc(doc(db, 'capsules', c.id), { openedAt: serverTimestamp() }).catch(() => {})
      }
    } catch {
      onError('🔒 Todavía no se puede abrir')
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Para ti</h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded-3xl bg-surface/70" />
        ) : forMe.length === 0 ? (
          <p className="px-1 text-sm text-muted">Aún no hay cartas para ti. ¿Le escribes tú una a {PEOPLE[partner].name}? 😉</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {forMe.map((c) => (
              <Envelope key={c.id} c={c} today={today} onOpen={() => open(c)} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Las que has escrito</h2>
        {fromMe.length > 0 && (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {fromMe.map((c) => {
              const st = capsuleState(c.openAt, today)
              return (
                <li key={c.id}>
                  <button onClick={() => open(c, true)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="text-2xl" aria-hidden>
                      {st.open ? '💌' : '✉️'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{c.title || 'Carta'}</span>
                      <span className="block text-xs text-muted">
                        Para {c.to === 'both' ? 'los dos' : PEOPLE[c.to].name} · {st.open ? (c.openedAt ? 'Ya la ha leído' : 'Ya se puede abrir') : opensIn(st.days)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <button onClick={() => setWriting({ capsule: null, text: '' })} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
          ✍️ Escribir una carta
        </button>
        <p className="px-1 text-xs text-muted">🔒 Hasta el día que elijas, ni {PEOPLE[partner].name} ni nadie puede leerla: la base de datos no la entrega antes. El día de antes le llega un aviso.</p>
      </section>

      {writing && <LetterSheet me={me} capsule={writing.capsule} text={writing.text} onClose={() => setWriting(null)} onError={onError} />}
      {reading && <LetterView c={reading.capsule} text={reading.text} onClose={() => setReading(null)} />}
    </div>
  )
}

function Envelope({ c, today, onOpen }: { c: Capsule; today: Date; onOpen: () => void }) {
  const st = capsuleState(c.openAt, today)
  return (
    <button onClick={onOpen} className={`flex aspect-[4/3] flex-col justify-between rounded-3xl p-3.5 text-left shadow-md active:scale-[0.98] ${st.open ? 'bg-gradient-to-br from-rose-300 to-amber-200 text-ink' : 'bg-gradient-to-br from-stone-200 to-stone-300 text-ink/80'}`}>
      <span className="text-3xl" aria-hidden>
        {st.open ? (c.openedAt ? '💌' : '💝') : '🔒'}
      </span>
      <span>
        <span className="block truncate text-sm font-extrabold">{c.title || `De ${PEOPLE[c.from].name}`}</span>
        <span className="block text-[11px] font-semibold">{st.open ? (c.openedAt ? 'Abierta' : '¡Ábrela!') : opensIn(st.days)}</span>
      </span>
    </button>
  )
}

function LetterSheet({ me, capsule, text: initialText, onClose, onError }: { me: PersonId; capsule: Capsule | null; text: string; onClose: () => void; onError: (m: string) => void }) {
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const [title, setTitle] = useState(capsule?.title ?? '')
  const [to, setTo] = useState<AssignMode>(capsule?.to ?? partner)
  const [openAt, setOpenAt] = useState(capsule?.openAt ?? '')
  const [text, setText] = useState(initialText)
  const tomorrow = ymdOf(new Date(Date.now() + 86_400_000))
  const valid = text.trim() && openAt && (capsule || openAt >= tomorrow)
  const save = async () => {
    if (!valid) return
    const id = capsule?.id ?? doc(collection(db, 'capsules')).id
    const [y, m, d] = openAt.split('-').map(Number)
    try {
      await setDoc(doc(db, 'capsules', id), { from: me, to, openAt, openAtTs: Timestamp.fromDate(new Date(y, m - 1, d)), title: title.trim(), ...(capsule ? {} : { openedAt: null, createdAt: serverTimestamp() }) }, { merge: true })
      await setDoc(doc(db, 'capsuleLetters', id), { from: me, to, text: text.trim() })
      onError(capsule ? 'Carta guardada' : '💌 Carta guardada en la cápsula')
      onClose()
    } catch (e) {
      onError((e as Error).message)
    }
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={capsule ? 'Tu carta' : 'Nueva carta'}
      footer={
        <button onClick={save} disabled={!valid} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          {capsule ? 'Guardar' : '💌 Cerrar la carta'}
        </button>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Para quién">
          {([partner, 'both'] as AssignMode[]).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={to === o} onClick={() => setTo(o)} className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold ${to === o ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              <Avatar mode={o} size="xs" /> {o === 'both' ? 'Para los dos' : `Para ${PEOPLE[partner].name}`}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="En el sobre: «Para nuestro 10.º aniversario»" aria-label="Sobre" maxLength={80} className={input} />
        <label className="block text-xs font-semibold text-muted">
          Se podrá abrir a partir del
          <input type="date" value={openAt} min={capsule ? undefined : tomorrow} onChange={(e) => setOpenAt(e.target.value)} aria-label="Se abre el" className={input} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Querido/a…" aria-label="Carta" maxLength={20000} className={`${area} font-serif text-base leading-relaxed`} />
        {capsule && (
          <Confirm
            text="¿Romper la carta?"
            onYes={() => {
              deleteDoc(doc(db, 'capsuleLetters', capsule.id)).catch(() => {})
              removeItem('capsules', capsule.id).catch((e: Error) => onError(e.message))
              onClose()
            }}
          />
        )}
      </div>
    </BottomSheet>
  )
}

function LetterView({ c, text, onClose }: { c: Capsule; text: string; onClose: () => void }) {
  const close = useLayer('letter', onClose)
  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-amber-50 animate-fade-in" role="dialog" aria-label={c.title || 'Carta'}>
      <div className="pt-safe sticky top-0 flex justify-end p-3">
        <button onClick={close} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full bg-white/80 text-stone-700 shadow-sm">
          <CloseIcon className="size-4" />
        </button>
      </div>
      <main className="mx-auto max-w-xl px-6 pb-24 text-stone-800">
        <p className="text-center text-5xl" aria-hidden>
          💌
        </p>
        {c.title && <h1 className="mt-3 text-center text-2xl font-extrabold">{c.title}</h1>}
        <p className="mt-1 text-center text-xs font-semibold text-stone-500">
          De {PEOPLE[c.from].name} · escrita el {longFmt.format(new Date(c.createdAt || Date.now()))}
        </p>
        <p className="mt-6 whitespace-pre-wrap font-serif text-lg leading-relaxed">{text}</p>
      </main>
    </div>
  )
}
