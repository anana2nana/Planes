import { useRef, useState } from 'react'
import { saveRecipe, updateRecipeOrg, useCookedMeals, useRecipes, type RecipeDraft } from '../../hooks/useMenu'
import { dishNutrition } from '../../lib/nutrition'
import { CAT_ORDER, RECIPE_CATS, SORTS, avgOf, cookedCounts, forgotten, matchPantry, sortRecipes, type RecipeCat, type SortMode } from '../../lib/recipeOrg'
import { starsText } from '../../lib/media'
import { ColorDot } from './Nutrition'
import { orgOf } from './RecipeOrg'
import { sourceOf, type Recipe } from '../../lib/menu'
import { guessEmoji, parseRecipeHtml } from '../../lib/recipeHtml'
import { itemKey } from '../../lib/shopping'
import type { PersonId } from '../../lib/types'
import { PlusIcon } from '../Icons'
import { RecipeCook } from './RecipeCook'
import { RecipeEditor, emptyRecipe } from './RecipeEditor'

export const toRecipeDraft = ({ id: _i, lastPlanned: _l, createdAt: _c, hasHtml: _h, ...rest }: Recipe): RecipeDraft => ({ ...rest, id: _i })

const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d
  } catch {
    return d
  }
}
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* da igual */
  }
}
const todayKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RecipesView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const recipes = useRecipes()
  const [q, setQ] = useState('')
  const [cooking, setCooking] = useState<string | null>(null)
  const [editing, setEditing] = useState<RecipeDraft | null>(null)
  const [importing, setImporting] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const [filter, setFilter] = useState('all')
  const [cat, setCat] = useState<RecipeCat | 'all'>('all')
  const [sort, setSortState] = useState<SortMode>(() => ((read('nitakitos.recipes.sort', 'name') as SortMode) in SORTS ? (read('nitakitos.recipes.sort', 'name') as SortMode) : 'name'))
  const [grid, setGridState] = useState(() => read('nitakitos.recipes.grid', '') === '1')
  const [pantry, setPantry] = useState(false)
  const setSort = (v: SortMode) => (setSortState(v), write('nitakitos.recipes.sort', v))
  const setGrid = (v: boolean) => (setGridState(v), write('nitakitos.recipes.grid', v ? '1' : ''))
  const meals = useCookedMeals()
  const today = todayKey()
  const cooked = cookedCounts(meals, today)
  const query = q.trim().toLowerCase()
  const allLists = [...new Set(recipes.flatMap((r) => r.lists))].sort((a, b) => a.localeCompare(b, 'es'))
  const authors = [...new Set(recipes.map((r) => orgOf(r).author))].filter((a) => a !== 'Vuestras' || recipes.some((r) => orgOf(r).author !== 'Vuestras'))
  const passFilter = (r: (typeof recipes)[number]) => {
    const o = orgOf(r)
    if (filter === 'fav') return r.favorite
    if (filter === 'quick') return o.minutes !== null && o.minutes <= 30
    if (filter === 'light') return dishNutrition({ color: null, title: r.title }, r).color === 'green'
    if (filter === 'taper') return o.taper
    if (filter.startsWith('author:')) return o.author === filter.slice(7)
    if (filter.startsWith('list:')) return r.lists.includes(filter.slice(5))
    return true
  }
  const base = recipes.filter(passFilter)
  const byCat = (list: typeof recipes) => (cat === 'all' ? list : list.filter((r) => orgOf(r).category === cat))
  const searched = query && !pantry ? base.filter((r) => `${r.title}\n${r.ingredients.join('\n')}\n${r.tags.join(' ')}\n${r.lists.join(' ')}`.toLowerCase().includes(query)) : base
  const pantryHits = pantry ? matchPantry(byCat(base), q) : []
  const shown = sortRecipes(byCat(searched), sort, cooked)
  const catCounts = new Map(CAT_ORDER.map((c) => [c, searched.filter((r) => orgOf(r).category === c).length]))
  const browsing = !query && filter === 'all' && cat === 'all'
  const top = sortRecipes(recipes, 'cooked', cooked)
    .filter((r) => (cooked.get(r.id) ?? 0) > 0)
    .slice(0, 8)
  const old = forgotten(recipes, today).slice(0, 8)
  // Agrupadas por categoría al ordenar por nombre sin filtro de categoría.
  const groups =
    sort === 'name' && cat === 'all' && !pantry
      ? [...CAT_ORDER, null].map((c) => ({ c, list: shown.filter((r) => orgOf(r).category === c) })).filter((g) => g.list.length)
      : [{ c: undefined, list: shown }]
  const current = cooking ? recipes.find((r) => r.id === cooking) : undefined
  const open = (id: string) => setCooking(id)
  const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${on ? 'bg-ink text-cream' : 'bg-surface shadow-sm'}`

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
      {recipes.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={pantry ? 'Lo que tenéis: pollo, calabacín…' : 'Buscar receta o ingrediente…'}
              aria-label={pantry ? 'Lo que tenéis' : 'Buscar receta'}
              className="h-11 min-w-0 flex-1 rounded-2xl bg-surface px-4 font-semibold shadow-sm outline-none placeholder:font-medium placeholder:text-stone-300 focus:ring-2 focus:ring-both/40"
            />
            <button
              onClick={() => setPantry((v) => !v)}
              aria-pressed={pantry}
              className={`shrink-0 rounded-2xl px-3 text-xs font-bold shadow-sm ${pantry ? 'bg-emerald-600 text-white' : 'bg-surface'}`}
            >
              🧺 Con lo
              <br />
              que tengo
            </button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Filtros">
            {(
              [
                ['all', 'Todas'],
                ['fav', '⭐ Favoritas'],
                ['quick', '⚡ Rápidas'],
                ['light', '🟢 Ligeras'],
                ['taper', '🥡 Táper'],
                ...authors.map((a) => [`author:${a}`, a === 'Vuestras' ? '🏠 Vuestras' : a === 'De redes' ? '📱 De redes' : `👩‍🍳 ${a}`]),
                ...allLists.map((l) => [`list:${l}`, `📂 ${l}`]),
              ] as [string, string][]
            ).map(([k, label]) => (
              <button key={k} onClick={() => setFilter(filter === k && k !== 'all' ? 'all' : k)} aria-pressed={filter === k} className={chip(filter === k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="group" aria-label="Categorías">
            {CAT_ORDER.filter((c) => (catCounts.get(c) ?? 0) > 0).map((c) => (
              <button
                key={c}
                onClick={() => setCat(cat === c ? 'all' : c)}
                aria-pressed={cat === c}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? 'bg-violet-600 text-white' : 'bg-violet-50 text-violet-800'}`}
              >
                {RECIPE_CATS[c].emoji} {RECIPE_CATS[c].label} <span className="opacity-60">{catCounts.get(c)}</span>
              </button>
            ))}
          </div>
          {!pantry && (
            <div className="flex items-center justify-between gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} aria-label="Ordenar" className="h-9 rounded-xl bg-surface px-2 text-xs font-bold shadow-sm">
                {(Object.keys(SORTS) as SortMode[]).map((k) => (
                  <option key={k} value={k}>
                    {SORTS[k]}
                  </option>
                ))}
              </select>
              <div className="flex rounded-xl bg-surface p-0.5 shadow-sm" role="radiogroup" aria-label="Vista">
                <button
                  role="radio"
                  aria-checked={!grid}
                  aria-label="Lista"
                  onClick={() => setGrid(false)}
                  className={`grid h-8 w-9 place-items-center rounded-lg text-sm ${!grid ? 'bg-stone-100' : ''}`}
                >
                  ☰
                </button>
                <button
                  role="radio"
                  aria-checked={grid}
                  aria-label="Cuadrícula"
                  onClick={() => setGrid(true)}
                  className={`grid h-8 w-9 place-items-center rounded-lg text-sm ${grid ? 'bg-stone-100' : ''}`}
                >
                  ▦
                </button>
              </div>
            </div>
          )}
        </div>
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

      {pantry ? (
        <div className="space-y-2">
          {!q.trim() && <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">Escribid lo que tenéis en la nevera (separado por comas) y os digo qué podéis hacer.</p>}
          {pantryHits.map(({ recipe: r, hits, missing }) => (
            <div key={r.id}>
              <RecipeCard recipe={r} cooked={cooked.get(r.id) ?? 0} onOpen={() => open(r.id)} />
              <p className="px-4 pt-1 text-xs text-emerald-700">
                ✓ {hits.join(', ')}
                {missing > 0 && (
                  <span className="text-muted">
                    {' '}
                    · y {missing} {missing === 1 ? 'ingrediente más' : 'ingredientes más'}
                  </span>
                )}
              </p>
            </div>
          ))}
          {q.trim() && pantryHits.length === 0 && <p className="py-6 text-center text-sm text-muted">Ninguna receta usa eso. Prueba con otra cosa.</p>}
        </div>
      ) : (
        <>
          {browsing && top.length > 1 && <Shelf title="🔥 Las que más hacéis" list={top} note={(r) => `${cooked.get(r.id)} ${cooked.get(r.id) === 1 ? 'vez' : 'veces'}`} onOpen={open} />}
          {browsing && old.length > 0 && (
            <Shelf
              title="🕰️ Hace mucho que no la hacéis"
              list={old}
              note={(r) => `desde ${new Date(r.lastPlanned + 'T12:00').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}`}
              onOpen={open}
            />
          )}
          {groups.map((g) => (
            <section key={String(g.c)} className="space-y-2">
              {g.c !== undefined && (
                <h2 className="px-1 pt-1 text-xs font-bold uppercase tracking-wider text-muted">
                  {g.c ? `${RECIPE_CATS[g.c].emoji} ${RECIPE_CATS[g.c].label}` : '🍲 Sin categoría'} · {g.list.length}
                </h2>
              )}
              {grid ? (
                <div className="grid grid-cols-3 gap-2">
                  {g.list.map((r) => (
                    <GridCard key={r.id} recipe={r} onOpen={() => open(r.id)} />
                  ))}
                </div>
              ) : (
                g.list.map((r) => <RecipeCard key={r.id} recipe={r} cooked={cooked.get(r.id) ?? 0} onOpen={() => open(r.id)} />)
              )}
            </section>
          ))}
          {(query || filter !== 'all' || cat !== 'all') && shown.length === 0 && <p className="py-6 text-center text-sm text-muted">No hay ninguna así{query ? ` con «${q}»` : ''}.</p>}
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setEditing(emptyRecipe())}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
        >
          <PlusIcon className="size-4" /> Nueva receta
        </button>
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99] ${importing ? 'animate-pulse' : ''}`}
        >
          📥 {importing ? 'Importando…' : 'Importar HTML'}
          <input
            ref={file}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="sr-only"
            disabled={importing}
            onChange={(e) => importFiles(e.target.files)}
            aria-label="Importar recetas en HTML"
          />
        </label>
      </div>

      {current && <RecipeCook recipe={current} me={me} allLists={allLists} onClose={() => setCooking(null)} onEdit={() => setEditing(toRecipeDraft(current))} onToast={onError} />}
      {editing && <RecipeEditor draft={editing} me={me} onClose={() => setEditing(null)} onError={onError} />}
    </div>
  )
}

function Thumb({ recipe, className }: { recipe: Recipe; className: string }) {
  return recipe.thumb ? (
    <img src={recipe.thumb} alt="" loading="lazy" className={`${className} object-cover`} />
  ) : (
    <span className={`${className} grid place-items-center bg-stone-100 text-2xl`} aria-hidden>
      {recipe.emoji}
    </span>
  )
}

function RecipeCard({ recipe, cooked, onOpen }: { recipe: Recipe; cooked: number; onOpen: () => void }) {
  const o = orgOf(recipe)
  const color = dishNutrition({ color: null, title: recipe.title }, recipe).color
  const avg = avgOf(recipe.rating)
  const src = sourceOf(recipe.url)
  return (
    <div className="flex w-full items-center gap-3 rounded-3xl bg-surface p-3 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]">
        <Thumb recipe={recipe} className="size-12 shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {color && <ColorDot color={color} className="size-2.5 shrink-0" />}
            <span className="truncate font-semibold">{recipe.title}</span>
          </span>
          <span className="block truncate text-xs text-muted">
            {[
              o.minutes ? `⏱️ ${o.minutes} min` : null,
              o.taper ? '🥡' : null,
              avg !== null ? `★ ${starsText(avg)}` : null,
              cooked ? `${cooked} ${cooked === 1 ? 'vez' : 'veces'}` : null,
              o.author !== 'Vuestras' ? o.author : src?.label,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      </button>
      <button
        onClick={() => updateRecipeOrg(recipe.id, { favorite: !recipe.favorite })}
        aria-pressed={recipe.favorite}
        aria-label={recipe.favorite ? `Quitar ${recipe.title} de favoritas` : `${recipe.title}: favorita`}
        className="grid size-9 shrink-0 place-items-center rounded-full text-lg"
      >
        {recipe.favorite ? '⭐' : '☆'}
      </button>
    </div>
  )
}

function GridCard({ recipe, onOpen }: { recipe: Recipe; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="relative text-left active:scale-[0.97]" aria-label={recipe.title}>
      <Thumb recipe={recipe} className="aspect-square w-full rounded-2xl text-4xl" />
      {recipe.favorite && <span className="absolute right-1 top-1 text-sm">⭐</span>}
      <span className="mt-1 line-clamp-2 block text-[11px] font-bold leading-tight">{recipe.title}</span>
    </button>
  )
}

/** Una fila que se desliza: las que más hacéis, las olvidadas. */
function Shelf({ title, list, note, onOpen }: { title: string; list: Recipe[]; note: (r: Recipe) => string; onOpen: (id: string) => void }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {list.map((r) => (
          <button key={r.id} onClick={() => onOpen(r.id)} className="w-24 shrink-0 text-left active:scale-[0.97]">
            <Thumb recipe={r} className="aspect-square w-24 rounded-2xl text-3xl" />
            <span className="mt-1 line-clamp-2 block text-[11px] font-bold leading-tight">{r.title}</span>
            <span className="block text-[10px] text-muted">{note(r)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
