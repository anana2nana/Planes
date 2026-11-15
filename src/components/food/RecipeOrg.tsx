import { useEffect, useRef, useState } from 'react'
import { loadRecipePhoto, saveRecipePhoto, updateRecipeOrg } from '../../hooks/useMenu'
import { compressImage, squarePhoto } from '../../lib/image'
import type { Recipe } from '../../lib/menu'
import { CAT_ORDER, RECIPE_CATS, authorOf, guessCategory, guessMinutes, guessTaper, type RecipeCat } from '../../lib/recipeOrg'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { starsText } from '../../lib/media'
import { BottomSheet } from '../BottomSheet'
import { Stars } from '../media/MediaView'

/** Lo que manda: lo puesto a mano, o lo que la app adivina. */
export function orgOf(r: Recipe) {
  const category = r.category ?? guessCategory(r)
  return {
    category,
    minutes: r.minutes ?? guessMinutes(r),
    taper: r.taper ?? guessTaper(category, r.title),
    author: authorOf(r),
  }
}

/** Etiquetas de la receta (categoría, tiempo, táper, listas). */
export function RecipeChips({ recipe, className = '' }: { recipe: Recipe; className?: string }) {
  const o = orgOf(recipe)
  const chips = [
    o.category && `${RECIPE_CATS[o.category].emoji} ${RECIPE_CATS[o.category].label}`,
    o.minutes && `⏱️ ${o.minutes < 60 ? `${o.minutes} min` : `${Math.floor(o.minutes / 60)} h${o.minutes % 60 ? ` ${o.minutes % 60}` : ''}`}`,
    o.taper && '🥡 Táper',
    ...recipe.lists.map((l) => `📂 ${l}`),
  ].filter(Boolean) as string[]
  if (!chips.length) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold">
          {c}
        </span>
      ))}
    </div>
  )
}

/** Organizar: categoría, tiempo, táper y listas (lo que no pongáis, lo adivina la app). */
export function OrgSheet({ recipe, allLists, onClose, onError }: { recipe: Recipe; allLists: string[]; onClose: () => void; onError: (m: string) => void }) {
  const guess = orgOf({ ...recipe, category: null, minutes: null, taper: null })
  const [category, setCategory] = useState<RecipeCat | null>(recipe.category ?? guess.category)
  const [minutes, setMinutes] = useState(String(recipe.minutes ?? guess.minutes ?? ''))
  const [taper, setTaper] = useState(recipe.taper ?? guess.taper)
  const [lists, setLists] = useState(recipe.lists)
  const [newList, setNewList] = useState('')
  const options = [...new Set([...allLists, ...lists, 'Cenas de finde', 'Para invitados', 'Navidad', 'Batch cooking'])].sort((a, b) => a.localeCompare(b, 'es'))
  const save = () => {
    const m = Number(minutes)
    updateRecipeOrg(recipe.id, { category, minutes: minutes.trim() && m > 0 ? Math.round(m) : null, taper, lists }, onError)
    onClose()
  }
  const addList = () => {
    const l = newList.trim().slice(0, 40)
    if (l && !lists.includes(l)) setLists([...lists, l])
    setNewList('')
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Organizar"
      footer={
        <button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
          Guardar
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Categoría{!recipe.category && guess.category ? ' (adivinada; cámbiala si no es)' : ''}</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
            {CAT_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${category === c ? 'bg-ink text-cream' : 'bg-stone-100'}`}
              >
                {RECIPE_CATS[c].emoji} {RECIPE_CATS[c].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-muted">
            Tiempo (minutos)
            <input
              value={minutes}
              onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="30"
              aria-label="Minutos"
              className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold text-ink outline-none focus:border-both"
            />
          </label>
          <div className="text-xs font-semibold text-muted">
            ¿Para táper?
            <div className="mt-1 grid h-11 grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Para táper">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={taper === v}
                  onClick={() => setTaper(v)}
                  className={`rounded-lg text-sm font-bold ${taper === v ? 'bg-surface text-ink shadow-sm' : ''}`}
                >
                  {v ? '🥡 Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Vuestras listas (puede estar en varias)</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((l) => {
              const on = lists.includes(l)
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setLists(on ? lists.filter((x) => x !== l) : [...lists, l])}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-violet-600 text-white' : 'bg-stone-100'}`}
                >
                  📂 {l}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={newList}
              onChange={(e) => setNewList(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addList()}
              placeholder="Nueva lista…"
              aria-label="Nueva lista"
              maxLength={40}
              className="h-10 min-w-0 flex-1 rounded-xl border border-stone-200 bg-surface px-3 text-sm font-semibold outline-none focus:border-both"
            />
            <button type="button" onClick={addList} disabled={!newList.trim()} className="rounded-xl bg-stone-100 px-3 text-sm font-bold disabled:opacity-40">
              Añadir
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}

/** "¿Qué tal os salió?": nota de cada uno, si la volveríais a hacer y una foto del plato. */
export function RateSection({ recipe, me, onError }: { recipe: Recipe; me: PersonId; onError: (m: string) => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const other: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const addPhoto = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      const [big, thumb] = await Promise.all([compressImage(f, 1200), squarePhoto(f, 240)])
      saveRecipePhoto(recipe.id, big.dataUrl.length < 900_000 ? big.dataUrl : null, thumb, onError)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }
  return (
    <section className="space-y-3 rounded-3xl bg-surface p-4 shadow-sm">
      <h2 className="text-lg font-extrabold">¿Qué tal os salió?</h2>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Tu nota</span>
        <Stars value={recipe.rating[me]} onChange={(v) => updateRecipeOrg(recipe.id, { rating: { ...recipe.rating, [me]: v } }, onError)} label={`Nota de ${PEOPLE[me].name}`} />
      </div>
      <p className="text-sm text-muted">
        {PEOPLE[other].name}: {recipe.rating[other] !== null ? `★ ${starsText(recipe.rating[other]!)}` : 'aún sin nota'}
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="¿La volveríais a hacer?">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            role="radio"
            aria-checked={recipe.again === v}
            onClick={() => updateRecipeOrg(recipe.id, { again: recipe.again === v ? null : v }, onError)}
            className={`h-9 rounded-xl text-sm font-bold ${recipe.again === v ? 'bg-surface shadow-sm' : 'text-muted'}`}
          >
            {v ? '🔁 La repetimos' : '🙅 No la repetimos'}
          </button>
        ))}
      </div>
      <button onClick={() => file.current?.click()} className="w-full rounded-2xl bg-amber-50 py-2.5 text-sm font-bold text-amber-800">
        📷 {busy ? 'Guardando…' : recipe.thumb ? 'Cambiar la foto del plato' : 'Foto de cómo os quedó'}
      </button>
      <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Foto del plato" onChange={(e) => addPhoto(e.target.files?.[0])} />
    </section>
  )
}

/** Foto del plato en grande (la miniatura mientras carga). */
export function RecipePhoto({ recipe }: { recipe: Recipe }) {
  const [big, setBig] = useState<string | null>(null)
  useEffect(() => {
    if (!recipe.thumb) return setBig(null)
    let alive = true
    loadRecipePhoto(recipe.id)
      .then((p) => alive && setBig(p))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [recipe.id, recipe.thumb])
  if (!recipe.thumb) return null
  return <img src={big ?? recipe.thumb} alt="" className="aspect-[4/3] w-full rounded-3xl bg-stone-100 object-cover" />
}
