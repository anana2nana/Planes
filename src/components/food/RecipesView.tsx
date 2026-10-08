import { useState } from 'react'
import { deleteRecipe, saveRecipe, useRecipes, type RecipeDraft } from '../../hooks/useMenu'
import { useSheetState } from '../../hooks/useSheetState'
import { sourceOf, splitRecipeText, type Recipe } from '../../lib/menu'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'

const EMOJIS = ['🍲', '🥘', '🍝', '🍛', '🥗', '🍗', '🐟', '🥩', '🍳', '🌮', '🍕', '🥪', '🍜', '🫘', '🥔', '🍰']
const input = 'h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const area = 'w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both'

export const toRecipeDraft = ({ id, title, emoji, url, ingredients, steps, servings, notes }: Recipe): RecipeDraft => ({ id, title, emoji, url, ingredients, steps, servings, notes })
export const emptyRecipe = (o: Partial<RecipeDraft> = {}): RecipeDraft => ({ title: '', emoji: '🍲', url: '', ingredients: [], steps: '', servings: null, notes: '', ...o })

export function RecipesView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const recipes = useRecipes()
  const [q, setQ] = useState('')
  const [sheet, openSheet, closeSheet] = useSheetState<RecipeDraft>()
  const query = q.trim().toLowerCase()
  const shown = query ? recipes.filter((r) => `${r.title}\n${r.ingredients.join('\n')}`.toLowerCase().includes(query)) : recipes

  return (
    <div className="space-y-4">
      {recipes.length > 5 && (
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar receta o ingrediente…"
          aria-label="Buscar receta"
          className="h-11 w-full rounded-2xl bg-surface px-4 font-semibold shadow-sm outline-none placeholder:font-medium placeholder:text-stone-300 focus:ring-2 focus:ring-both/40"
        />
      )}
      {recipes.length === 0 && (
        <div className="rounded-3xl bg-surface p-5 text-center shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          <div className="text-4xl">📖</div>
          <p className="mt-2 font-bold">Vuestro recetario</p>
          <p className="mt-1 text-sm text-muted">
            Guarda las recetas que os gustan (de Diego Doal, Cocina con Carmen…): el enlace al vídeo y los ingredientes. Desde TikTok o Instagram puedes darle a <b>Compartir → Nitakitos</b>.
          </p>
        </div>
      )}
      <div className="space-y-2">
        {shown.map((r) => (
          <RecipeCard key={r.id} recipe={r} onOpen={() => openSheet(toRecipeDraft(r))} />
        ))}
        {query && shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nada con «{q}»</p>}
      </div>
      <button
        onClick={() => openSheet(emptyRecipe())}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Nueva receta
      </button>
      {sheet && <RecipeForm draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const src = sourceOf(recipe.url)
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone-100 text-2xl" aria-hidden>
          {recipe.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{recipe.title}</span>
          <span className="block truncate text-xs text-muted">
            {[recipe.ingredients.length ? `${recipe.ingredients.length} ingredientes` : 'Sin ingredientes', src?.label].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      {recipe.url && (
        <a href={recipe.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 active:scale-95">
          {src?.emoji} Ver
        </a>
      )}
    </article>
  )
}

export function RecipeForm({
  draft,
  me,
  onClose,
  onError,
  onSaved,
}: {
  draft: RecipeDraft
  me: PersonId
  onClose: () => void
  onError: (m: string) => void
  onSaved?: (id: string, title: string) => void
}) {
  const [d, setD] = useState(draft)
  const [ingText, setIngText] = useState(draft.ingredients.join('\n'))
  const [paste, setPaste] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const current = { ...d, ingredients: ingText.split('\n').map((l) => l.trim()).filter(Boolean) }
  const dirty = JSON.stringify(current) !== JSON.stringify(draft)
  const canSave = d.title.trim() !== ''
  const src = sourceOf(d.url.trim())

  const save = () => {
    if (!canSave) return
    const id = saveRecipe({ ...current, title: d.title.trim(), url: d.url.trim(), steps: d.steps.trim(), notes: d.notes.trim() }, me, onError)
    onSaved?.(id, d.title.trim())
    onClose()
  }
  const applyPaste = () => {
    if (!paste) return
    const r = splitRecipeText(paste)
    if (r.ingredients.length) setIngText([ingText.trim(), ...r.ingredients].filter(Boolean).join('\n'))
    if (r.steps) setD((x) => ({ ...x, steps: [x.steps.trim(), r.steps].filter(Boolean).join('\n') }))
    setPaste(null)
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? `${d.emoji} Receta` : 'Nueva receta'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar receta'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
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
          placeholder="Lentejas de la abuela, pollo al curry…"
          aria-label="Nombre de la receta"
          maxLength={100}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />
        <div>
          <div className="flex gap-2">
            <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} type="url" inputMode="url" placeholder="Enlace al vídeo o a la web" aria-label="Enlace de la receta" className={input} />
            {src && d.url.trim() && (
              <a href={d.url.trim()} target="_blank" rel="noreferrer" className="grid h-12 shrink-0 place-items-center rounded-2xl bg-sky-50 px-4 text-sm font-bold text-sky-700">
                {src.emoji} Ver
              </a>
            )}
          </div>
        </div>

        {paste === null ? (
          <button type="button" onClick={() => setPaste('')} className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-700">
            📋 Pegar la descripción del vídeo
            <span className="block text-xs font-medium opacity-80">Copia el texto de TikTok o Instagram y separo los ingredientes y los pasos.</span>
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-violet-50 p-3">
            <textarea autoFocus value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} placeholder="Pega aquí el texto…" aria-label="Texto pegado" className={area} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPaste(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-muted">
                Cancelar
              </button>
              <button type="button" onClick={applyPaste} disabled={!paste.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                Separar
              </button>
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Ingredientes (uno por línea)</span>
          <textarea value={ingText} onChange={(e) => setIngText(e.target.value)} rows={6} placeholder={'300 g de lentejas\n1 cebolla\n2 zanahorias'} aria-label="Ingredientes" className={area} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Pasos (opcional)</span>
          <textarea value={d.steps} onChange={(e) => setD({ ...d, steps: e.target.value })} rows={5} aria-label="Pasos" className={area} />
        </div>

        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{draft.title}»?</p>
              <button
                onClick={() => {
                  deleteRecipe(draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar receta
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
