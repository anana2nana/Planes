import { useState } from 'react'
import { NOTE_TEMPLATES, deleteNote, saveNote, useNotes, type Note } from '../../hooks/useNotes'
import { useSheetState } from '../../hooks/useSheetState'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'
import { Card } from './ui'

const EMOJIS = ['📝', '📶', '👕', '📞', '🔑', '🐱', '🧾', '🚗', '💊', '🎁', '🏠', '⭐']

type Draft = Pick<Note, 'emoji' | 'title' | 'body' | 'pinned'> & { id?: string }

export function NotesView({ me, onError, onToast }: { me: PersonId; onError: (m: string) => void; onToast: (m: string) => void }) {
  const { notes, loading } = useNotes()
  const [query, setQuery] = useState('')
  const [sheet, openSheet, closeSheet] = useSheetState<Draft>()

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />

  const q = query.trim().toLowerCase()
  const shown = q ? notes.filter((n) => `${n.title}\n${n.body}`.toLowerCase().includes(q)) : notes
  const missing = NOTE_TEMPLATES.filter((t) => !notes.some((n) => n.title.toLowerCase() === t.title.toLowerCase()))

  const copy = (n: Note) =>
    navigator.clipboard
      .writeText(n.body)
      .then(() => onToast(`«${n.title}» copiado`))
      .catch(() => onError('No se pudo copiar'))

  return (
    <div className="space-y-4">
      {notes.length > 4 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en las notas…"
          aria-label="Buscar en las notas"
          className="h-11 w-full rounded-2xl bg-surface px-4 font-semibold shadow-sm outline-none placeholder:font-medium placeholder:text-stone-300 focus:ring-2 focus:ring-both/40"
        />
      )}

      {notes.length === 0 && (
        <Card className="text-center">
          <div className="text-4xl">📝</div>
          <p className="mt-2 font-bold">Lo que siempre andáis buscando</p>
          <p className="mt-1 text-sm text-muted">La clave del wifi para las visitas, vuestras tallas, el teléfono del fontanero… Lo apunta uno y lo tiene el otro al momento.</p>
        </Card>
      )}

      <div className="space-y-2.5">
        {shown.map((n) => (
          <article key={n.id} className="rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            <div className="flex items-start gap-3">
              <button onClick={() => openSheet(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="text-2xl leading-none" aria-hidden>
                  {n.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-extrabold">
                    {n.title}
                    {n.pinned && <span className="ml-1 text-xs" aria-label="Fijada">📌</span>}
                  </span>
                  {n.body && <span className="mt-1 block whitespace-pre-wrap break-words text-sm text-ink/80">{n.body}</span>}
                </span>
              </button>
              {n.body && (
                <button onClick={() => copy(n)} className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold active:scale-95" aria-label={`Copiar ${n.title}`}>
                  Copiar
                </button>
              )}
            </div>
          </article>
        ))}
        {q && shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nada con «{query}»</p>}
      </div>

      <button
        onClick={() => openSheet({ emoji: '📝', title: '', body: '', pinned: false })}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Nueva nota
      </button>

      {missing.length > 0 && !q && (
        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Ideas para empezar</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((t) => (
              <button key={t.title} onClick={() => openSheet({ ...t, pinned: false })} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold shadow-sm active:scale-95">
                {t.emoji} {t.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet && <NoteForm draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function NoteForm({ draft, me, onClose, onError }: { draft: Draft; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const canSave = d.title.trim() !== ''
  const save = () => {
    if (!canSave) return
    saveNote({ ...d, title: d.title.trim(), body: d.body.trimEnd() }, me).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? 'Nota' : 'Nueva nota'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar nota'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="radiogroup" aria-label="Icono">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={d.emoji === e}
              onClick={() => setD({ ...d, emoji: e })}
              className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${d.emoji === e ? 'bg-both-soft ring-2 ring-both' : 'bg-stone-100'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <input
          autoFocus={!isEdit && !d.title}
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="Título (Wifi, tallas…)"
          aria-label="Título de la nota"
          maxLength={60}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />
        <textarea
          value={d.body}
          onChange={(e) => setD({ ...d, body: e.target.value })}
          rows={7}
          maxLength={5000}
          aria-label="Contenido de la nota"
          placeholder="Escribe aquí…"
          className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both"
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.checked })} className="size-4 accent-both" />
          📌 Fijarla arriba
        </label>
        <p className="text-xs text-muted">🔒 Solo la veis vosotros dos, pero mejor no guardar aquí contraseñas del banco.</p>
        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{draft.title}»?</p>
              <button
                onClick={() => {
                  deleteNote(draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar nota
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
