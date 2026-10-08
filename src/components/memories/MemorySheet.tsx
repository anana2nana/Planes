import { useEffect, useState } from 'react'
import { loadPhotos, preparePhoto, saveMemory, type MemoryDraft, type MemoryPhoto } from '../../hooks/useMemories'
import { useLayer } from '../../hooks/useLayer'
import { compressImage } from '../../lib/image'
import { MAX_PHOTOS } from '../../lib/memories'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { CloseIcon, PlusIcon } from '../Icons'
import { PlaceField } from '../PlaceField'

/**
 * Crear o editar un recuerdo (fotos + una frase). Con `prompt`, es la pregunta
 * que sale al completar un plan o el día después de una cita: lleva "Ahora no".
 */
export function MemorySheet({
  draft,
  thumb,
  me,
  prompt,
  onClose,
  onSkip,
  onError,
}: {
  draft: MemoryDraft
  /** Miniatura actual (al editar). */
  thumb?: string | null
  me: PersonId
  prompt?: 'done' | 'event'
  onClose: () => void
  onSkip?: () => void
  onError: (m: string) => void
}) {
  const close = useLayer('memory', onClose)
  const [d, setD] = useState(draft)
  const [kept, setKept] = useState<MemoryPhoto[]>([])
  const [original, setOriginal] = useState<MemoryPhoto[]>([])
  const [added, setAdded] = useState<{ full: string; thumb: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(draft.id)

  useEffect(() => {
    if (!draft.id) return
    loadPhotos(draft.id)
      .then((p) => {
        setKept(p)
        setOriginal(p)
      })
      .catch((e: Error) => onError(e.message))
  }, [draft.id, onError])

  const total = kept.length + added.length
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      const room = MAX_PHOTOS - total
      const list = Array.from(files).slice(0, room)
      const ready = await Promise.all(list.map(preparePhoto))
      setAdded((a) => [...a, ...ready])
      if (files.length > room) onError(`Como mucho ${MAX_PHOTOS} fotos por recuerdo`)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const dirty = JSON.stringify(d) !== JSON.stringify(draft) || added.length > 0 || kept.length !== original.length
  const canSave = d.title.trim() !== '' && (total > 0 || d.text.trim() !== '' || isEdit)

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      // Miniatura de la primera foto que queda.
      let newThumb: string | null = null
      if (kept.length && original[0] && kept[0].id === original[0].id && thumb) newThumb = thumb
      else if (kept.length) newThumb = (await compressImage(await (await fetch(kept[0].data)).blob(), 360)).dataUrl
      else if (added.length) newThumb = added[0].thumb
      await saveMemory(d, me, {
        added,
        removed: original.filter((o) => !kept.some((k) => k.id === o.id)).map((o) => o.id),
        firstOrder: Math.max(0, ...kept.map((k) => k.order + 1), ...original.map((o) => o.order + 1)),
        thumb: newThumb,
        photoCount: total,
      })
      onError(isEdit ? 'Recuerdo guardado' : '📸 Guardado en el diario')
      close()
    } catch (e) {
      onError((e as Error).message)
      setSaving(false)
    }
  }

  const title = prompt === 'done' ? '¡Hecho! 🎉 ¿Un recuerdo?' : prompt === 'event' ? '¿Qué tal fue?' : isEdit ? 'Recuerdo' : 'Nuevo recuerdo'

  return (
    <BottomSheet
      open
      onClose={close}
      title={title}
      footer={
        <div className="flex gap-2">
          {prompt && (
            <button
              onClick={() => {
                onSkip?.()
                close()
              }}
              className="h-13 rounded-2xl bg-stone-100 px-5 font-bold"
            >
              Ahora no
            </button>
          )}
          {(!isEdit || dirty) && (
            <button onClick={save} disabled={!canSave || busy || saving} className="h-13 flex-1 rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Guardar recuerdo'}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Fotos */}
        <div className="grid grid-cols-3 gap-2">
          {kept.map((p) => (
            <Thumb key={p.id} src={p.data} onRemove={() => setKept((k) => k.filter((x) => x.id !== p.id))} />
          ))}
          {added.map((p, i) => (
            <Thumb key={`n${i}`} src={p.thumb} onRemove={() => setAdded((a) => a.filter((_, j) => j !== i))} />
          ))}
          {total < MAX_PHOTOS && (
            <label className={`grid aspect-square cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-stone-200 text-muted ${busy ? 'animate-pulse' : ''}`} aria-label="Añadir fotos">
              {busy ? (
                <span className="text-xs font-semibold">Preparando…</span>
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs font-bold">
                  <PlusIcon className="size-6" /> Fotos
                </span>
              )}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={busy} onChange={(e) => addFiles(e.target.files).then(() => (e.target.value = ''))} />
            </label>
          )}
        </div>

        <textarea
          autoFocus={!isEdit}
          value={d.text}
          onChange={(e) => setD({ ...d, text: e.target.value })}
          rows={3}
          maxLength={1000}
          placeholder="Una frase para acordaros: el mejor ramen de nuestra vida…"
          aria-label="Qué tal fue"
          className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 text-[15px] outline-none focus:border-both"
        />
        <input
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          maxLength={120}
          placeholder="Título"
          aria-label="Título del recuerdo"
          className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
        />
        <input
          type="date"
          value={d.date}
          onChange={(e) => e.target.value && setD({ ...d, date: e.target.value })}
          aria-label="Fecha del recuerdo"
          className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
        />
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Dónde (opcional)</span>
          <PlaceField value={d.place} onChange={(place) => setD({ ...d, place })} />
        </div>
      </div>
    </BottomSheet>
  )
}

function Thumb({ src, onRemove }: { src: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
      <img src={src} alt="" className="size-full object-cover" />
      <button onClick={onRemove} aria-label="Quitar foto" className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/55 text-white">
        <CloseIcon className="size-3.5" />
      </button>
    </div>
  )
}
