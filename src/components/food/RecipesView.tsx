import { useRef, useState } from 'react'
import { saveRecipe, useRecipes, type RecipeDraft } from '../../hooks/useMenu'
import { sourceOf, type Recipe } from '../../lib/menu'
import { guessEmoji, parseRecipeHtml } from '../../lib/recipeHtml'
import { itemKey } from '../../lib/shopping'
import type { PersonId } from '../../lib/types'
import { PlusIcon } from '../Icons'
import { RecipeCook } from './RecipeCook'
import { RecipeEditor, emptyRecipe } from './RecipeEditor'

export const toRecipeDraft = ({ id: _i, lastPlanned: _l, createdAt: _c, hasHtml: _h, ...rest }: Recipe): RecipeDraft => ({ ...rest, id: _i })

export function RecipesView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const recipes = useRecipes()
  const [q, setQ] = useState('')
  const [cooking, setCooking] = useState<string | null>(null)
  const [editing, setEditing] = useState<RecipeDraft | null>(null)
  const [importing, setImporting] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const query = q.trim().toLowerCase()
  const shown = query ? recipes.filter((r) => `${r.title}\n${r.ingredients.join('\n')}\n${r.tags.join(' ')}`.toLowerCase().includes(query)) : recipes
  const current = cooking ? recipes.find((r) => r.id === cooking) : undefined

  // Importar uno o varios HTML: si ya hay una receta con el mismo nombre, se actualiza (no se duplica).
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setImporting(true)
    let created = 0
    let updated = 0
    const failed: string[] = []
    for (const f of Array.from(files)) {
      try {
        const html = await f.text()
        const parsed = parseRecipeHtml(html)
        if (!parsed.groups.length && !parsed.phases.length) {
          failed.push(f.name)
          continue
        }
        const existing = recipes.find((r) => itemKey(r.title) === itemKey(parsed.title))
        const draft: RecipeDraft = { ...emptyRecipe(), ...(existing ? toRecipeDraft(existing) : {}), ...parsed, emoji: existing?.emoji ?? guessEmoji(parsed.title), id: existing?.id }
        saveRecipe(draft, me, onError, html)
        if (existing) updated++
        else created++
      } catch {
        failed.push(f.name)
      }
    }
    setImporting(false)
    if (file.current) file.current.value = ''
    const parts = [created && `${created} ${created === 1 ? 'receta nueva' : 'recetas nuevas'}`, updated && `${updated} ${updated === 1 ? 'actualizada' : 'actualizadas'}`].filter(Boolean)
    onError([parts.length ? `📥 ${parts.join(' y ')}` : '', failed.length ? `No he sabido leer: ${failed.join(', ')}` : ''].filter(Boolean).join('. '))
  }

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
            Importa tus recetas en HTML, escríbelas aquí o guarda las de Diego Doal y Cocina con Carmen (desde TikTok o Instagram: <b>Compartir → Nitakitos</b>).
          </p>
        </div>
      )}
      <div className="space-y-2">
        {shown.map((r) => (
          <RecipeCard key={r.id} recipe={r} onOpen={() => setCooking(r.id)} />
        ))}
        {query && shown.length === 0 && <p className="py-6 text-center text-sm text-muted">Nada con «{q}»</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setEditing(emptyRecipe())}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
        >
          <PlusIcon className="size-4" /> Nueva receta
        </button>
        <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99] ${importing ? 'animate-pulse' : ''}`}>
          📥 {importing ? 'Importando…' : 'Importar HTML'}
          <input ref={file} type="file" accept=".html,.htm,text/html" multiple className="sr-only" disabled={importing} onChange={(e) => importFiles(e.target.files)} aria-label="Importar recetas en HTML" />
        </label>
      </div>

      {current && <RecipeCook recipe={current} me={me} onClose={() => setCooking(null)} onEdit={() => setEditing(toRecipeDraft(current))} onToast={onError} />}
      {editing && <RecipeEditor draft={editing} me={me} onClose={() => setEditing(null)} onError={onError} />}
    </div>
  )
}

function RecipeCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  const src = sourceOf(recipe.url)
  const steps = recipe.phases.reduce((n, p) => n + p.steps.length, 0)
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3.5 text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] active:scale-[0.99]">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-stone-100 text-2xl" aria-hidden>
        {recipe.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{recipe.title}</span>
        <span className="block truncate text-xs text-muted">
          {[
            recipe.ingredients.length ? `${recipe.ingredients.length} ingredientes` : 'Sin ingredientes',
            steps ? `${steps} pasos` : null,
            recipe.servings ? `${recipe.servings} raciones` : null,
            src?.label,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </button>
  )
}
