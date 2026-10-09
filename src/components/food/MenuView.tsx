import { useMemo, useState } from 'react'
import { deleteMeal, saveMeal, useMeals, useRecipes } from '../../hooks/useMenu'
import { useSheetState } from '../../hooks/useSheetState'
import { useShopping } from '../../hooks/useShopping'
import { EAT, defaultEat, defaultSlots, mealId, parseYmd, portions, sourceOf, weekDays, weekIngredients, weekStart, ymd, type EatMode, type Meal, type MealSlot, type Recipe } from '../../lib/menu'
import { COLORS, dishNutrition, estimateRecipe, weekBalance, type DishColor, type DishNutrition } from '../../lib/nutrition'
import { PEOPLE } from '../../lib/people'
import { itemKey } from '../../lib/shopping'
import type { PersonId } from '../../lib/types'
import { addShoppingItem } from '../../services/shopping'
import { BottomSheet } from '../BottomSheet'
import { ChevronIcon, PlusIcon, TrashIcon } from '../Icons'
import { ColorBadge, ColorChoice, ColorDot, WeekBar } from './Nutrition'
import { RecipeCook } from './RecipeCook'
import { RecipeEditor, emptyRecipe } from './RecipeEditor'
import { toRecipeDraft } from './RecipesView'

const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric' })
const shortFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const SLOT_LABEL: Record<MealSlot, string> = { comida: 'Comida', cena: 'Cena' }
const PEOPLE_IDS: PersonId[] = ['nita', 'kitos']
const COOK: { v: PersonId | 'both'; label: string }[] = [
  { v: 'nita', label: PEOPLE.nita.name },
  { v: 'kitos', label: PEOPLE.kitos.name },
  { v: 'both', label: 'Juntos' },
]

type Draft = Omit<Meal, 'id'>
const emptyMeal = (date: string, slot: MealSlot): Draft => ({ date, slot, title: '', recipeId: null, cook: 'nita', eat: defaultEat(date, slot), notes: '', color: null })

export function MenuView({ me, onToast }: { me: PersonId; onToast: (m: string) => void }) {
  const [offset, setOffset] = useState(0)
  const today = ymd(new Date())
  const monday = useMemo(() => {
    const m = weekStart(new Date())
    return new Date(m.getFullYear(), m.getMonth(), m.getDate() + offset * 7)
  }, [offset])
  const days = weekDays(monday)
  const { meals, loading } = useMeals(days[0], days[6])
  const recipes = useRecipes()
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'meal'; draft: Draft; existing: boolean } | { type: 'shop' }>()
  const byId = new Map(meals.map((m) => [m.id, m]))
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const withRecipe = meals.filter((m) => m.recipeId && recipeById.has(m.recipeId))
  const nutOf = (m: Meal) => dishNutrition(m, m.recipeId ? recipeById.get(m.recipeId) : null)
  const balance = weekBalance(meals.filter((m) => portions(m.eat) > 0).map((m) => nutOf(m).color))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Semana anterior" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm active:scale-95">
          <ChevronIcon className="size-4 rotate-180" />
        </button>
        <div className="text-center">
          <p className="font-extrabold">
            {offset === 0 ? 'Esta semana' : offset === 1 ? 'La semana que viene' : offset === -1 ? 'La semana pasada' : `Semana del ${shortFmt.format(monday)}`}
          </p>
          <p className="text-xs text-muted">
            {shortFmt.format(parseYmd(days[0]))} – {shortFmt.format(parseYmd(days[6]))}
            {offset !== 0 && (
              <button onClick={() => setOffset(0)} className="ml-2 font-bold text-both">
                Hoy
              </button>
            )}
          </p>
        </div>
        <button onClick={() => setOffset((o) => o + 1)} aria-label="Semana siguiente" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm active:scale-95">
          <ChevronIcon className="size-4" />
        </button>
      </div>

      {!loading && meals.length > 0 && (
        <div className={`rounded-3xl p-3.5 ${balance.verdict === 'heavy' ? 'bg-rose-50' : balance.verdict === 'light' ? 'bg-emerald-50' : 'bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'}`}>
          <p className="mb-2 text-sm font-bold">{balance.text}</p>
          <WeekBar balance={balance} />
        </div>
      )}

      {loading ? (
        <div className="h-60 animate-pulse rounded-3xl bg-surface/70" />
      ) : (
        <div className="space-y-2.5">
          {days.map((date) => {
            const extra = byId.has(mealId(date, 'cena')) && !defaultSlots(date).includes('cena')
            const slots: MealSlot[] = extra ? ['comida', 'cena'] : defaultSlots(date)
            const isToday = date === today
            const past = date < today
            return (
              <section key={date} className={`rounded-3xl bg-surface p-3 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] ${isToday ? 'ring-2 ring-both/50' : ''} ${past ? 'opacity-60' : ''}`}>
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <h3 className="text-sm font-extrabold capitalize">
                    {dayFmt.format(parseYmd(date))}
                    {isToday && <span className="ml-1.5 rounded-full bg-both px-2 py-0.5 text-[10px] font-bold uppercase text-white">Hoy</span>}
                  </h3>
                  {!slots.includes('cena') && (
                    <button onClick={() => openSheet({ type: 'meal', draft: emptyMeal(date, 'cena'), existing: false })} className="text-xs font-bold text-muted">
                      + cena
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {slots.map((slot) => {
                    const m = byId.get(mealId(date, slot))
                    return m ? (
                      <MealRow key={slot} meal={m} recipe={m.recipeId ? recipeById.get(m.recipeId) : undefined} nutrition={nutOf(m)} onOpen={() => openSheet({ type: 'meal', draft: toDraft(m), existing: true })} />
                    ) : (
                      <button
                        key={slot}
                        onClick={() => openSheet({ type: 'meal', draft: emptyMeal(date, slot), existing: false })}
                        className="flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 px-3 py-2 text-left text-sm font-semibold text-muted active:scale-[0.99]"
                      >
                        <PlusIcon className="size-4" /> {SLOT_LABEL[slot]}
                        {slot === 'comida' && defaultEat(date, slot).nita === 'taper' && <span className="ml-auto text-xs">🥡 táper</span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <button
        onClick={() => (withRecipe.length ? openSheet({ type: 'shop' }) : onToast('Elige recetas del recetario para el menú y luego podrás pasar sus ingredientes a la compra'))}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]"
      >
        🛒 Ingredientes a la compra
      </button>

      {sheet?.type === 'meal' && <MealSheet draft={sheet.draft} existing={sheet.existing} days={days} meals={byId} recipes={recipes} heavy={balance.verdict === 'heavy'} me={me} onClose={closeSheet} onToast={onToast} />}
      {sheet?.type === 'shop' && <IngredientsSheet meals={withRecipe} recipes={recipes} me={me} onClose={closeSheet} onToast={onToast} />}
    </div>
  )
}

const toDraft = ({ id: _id, ...m }: Meal): Draft => m

function eatSummary(eat: Record<PersonId, EatMode>): string {
  const t = PEOPLE_IDS.filter((p) => eat[p] === 'taper')
  const out = PEOPLE_IDS.filter((p) => eat[p] === 'fuera')
  return [t.length ? `🥡 ${t.length === 2 ? '2 tápers' : `táper ${PEOPLE[t[0]].name}`}` : '', out.length ? `${out.map((p) => PEOPLE[p].name).join(' y ')} fuera` : '']
    .filter(Boolean)
    .join(' · ')
}

function MealRow({ meal, recipe, nutrition, onOpen }: { meal: Meal; recipe?: Recipe; nutrition: DishNutrition; onOpen: () => void }) {
  const summary = [eatSummary(meal.eat), nutrition.kcal ? `~${nutrition.kcal} kcal` : ''].filter(Boolean).join(' · ')
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl px-1 py-1.5 text-left active:bg-stone-50">
      <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-xl">
        <span aria-hidden>{recipe?.emoji ?? '🍽️'}</span>
        {nutrition.color && <ColorDot color={nutrition.color} className="absolute -right-0.5 -top-0.5 size-3 ring-2 ring-surface" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{SLOT_LABEL[meal.slot]}</span>
        <span className="block truncate font-semibold">{meal.title}</span>
        {summary && <span className="block truncate text-xs text-muted">{summary}</span>}
      </span>
      <span className="shrink-0 text-xs font-semibold text-muted">{meal.cook === 'both' ? '👩‍🍳 juntos' : `👩‍🍳 ${PEOPLE[meal.cook].name}`}</span>
    </button>
  )
}

function MealSheet({
  draft,
  existing,
  days,
  meals,
  recipes,
  heavy,
  me,
  onClose,
  onToast,
}: {
  draft: Draft
  existing: boolean
  days: string[]
  meals: Map<string, Meal>
  recipes: Recipe[]
  /** La semana va contundente: las ideas ligeras primero. */
  heavy: boolean
  me: PersonId
  onClose: () => void
  onToast: (m: string) => void
}) {
  const [d, setD] = useState(draft)
  const [repeat, setRepeat] = useState<string[]>([])
  const [newRecipe, setNewRecipe] = useState(false)
  const [cook, setCook] = useState(false)
  const [editRecipe, setEditRecipe] = useState(false)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft) || repeat.length > 0
  const recipe = d.recipeId ? recipes.find((r) => r.id === d.recipeId) : undefined
  const q = d.title.trim().toLowerCase()
  const matches = q && !recipe ? recipes.filter((r) => r.title.toLowerCase().includes(q)).slice(0, 5) : []
  // Sin escribir nada: primero las que hace más tiempo que no ponéis.
  const colorOf = (r: Recipe): DishColor | null => r.nutrition.color ?? estimateRecipe(r).color
  const rank = (r: Recipe) => (heavy ? ({ green: 0, yellow: 1, red: 2 } as const)[colorOf(r) ?? 'yellow'] : 0)
  const ideas = !q ? [...recipes].sort((a, b) => rank(a) - rank(b) || (a.lastPlanned ?? '').localeCompare(b.lastPlanned ?? '')).slice(0, 8) : []
  const nutrition = dishNutrition(d, recipe ?? null)
  const fail = (e: Error) => onToast(e.message)

  const pick = (r: Recipe) => setD({ ...d, title: r.title, recipeId: r.id })
  const save = () => {
    if (!d.title.trim()) return
    const m = { ...d, title: d.title.trim() }
    saveMeal(m, me).catch(fail)
    // "También el…": el mismo plato otros días (táper, cocinar para varios días).
    for (const date of repeat) saveMeal({ ...m, date, slot: 'comida', eat: meals.get(mealId(date, 'comida'))?.eat ?? defaultEat(date, 'comida') }, me).catch(fail)
    onClose()
  }

  if (newRecipe)
    return (
      <RecipeEditor
        draft={emptyRecipe({ title: d.title.trim() })}
        me={me}
        onClose={() => setNewRecipe(false)}
        onError={onToast}
        onSaved={(id, title) => {
          setD((x) => ({ ...x, recipeId: id, title }))
          setNewRecipe(false)
        }}
      />
    )

  const others = days.filter((x) => x !== d.date && x >= ymd(new Date()))

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${SLOT_LABEL[d.slot]} · ${dayFmt.format(parseYmd(d.date))}`}
      footer={
        !existing || dirty ? (
          <button onClick={save} disabled={!d.title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {existing ? 'Guardar cambios' : 'Guardar'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div>
          <input
            autoFocus={!existing}
            value={d.title}
            onChange={(e) => setD({ ...d, title: e.target.value, recipeId: recipe && e.target.value === recipe.title ? recipe.id : null })}
            placeholder="¿Qué coméis?"
            aria-label="Plato"
            maxLength={100}
            className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
            style={{ fontSize: 20 }}
          />
          {recipe ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">📖 Del recetario</span>
              {recipe.url && (
                <a href={recipe.url} target="_blank" rel="noreferrer" className="rounded-full bg-sky-50 px-2.5 py-1 font-bold text-sky-700">
                  {sourceOf(recipe.url)?.emoji} Ver vídeo
                </a>
              )}
              <button type="button" onClick={() => setCook(true)} className="rounded-full bg-stone-100 px-2.5 py-1 font-bold">
                📖 Abrir receta
              </button>
            </div>
          ) : (
            (matches.length > 0 || ideas.length > 0) && (
              <div className="mt-2">
                {ideas.length > 0 && (
                  <p className="mb-1 text-xs font-semibold text-muted">
                    {heavy ? 'La semana va contundente: primero las ligeras 🥗' : 'Del recetario (primero lo que hace más que no coméis):'}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {(matches.length ? matches : ideas).map((r) => (
                    <button key={r.id} type="button" onClick={() => pick(r)} className="rounded-full bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-700 active:scale-95">
                      {r.emoji} {r.title}
                      {colorOf(r) && <ColorDot color={colorOf(r)} className="ml-1.5 size-2 align-middle" />}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
          {!recipe && q && matches.length === 0 && (
            <button type="button" onClick={() => setNewRecipe(true)} className="mt-2 text-xs font-bold text-both">
              + Guardar «{d.title.trim()}» en el recetario (con sus ingredientes)
            </button>
          )}
        </div>

        {d.title.trim() && (
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Cómo es el plato</span>
            {recipe && !d.color ? (
              <div className="flex flex-wrap items-center gap-2">
                {nutrition.color || nutrition.kcal ? <ColorBadge color={nutrition.color} kcal={nutrition.kcal} /> : <span className="text-sm text-muted">Sin datos suficientes</span>}
                <span className="text-xs text-muted">{nutrition.manual ? 'puesto a mano' : 'calculado'}</span>
                <button type="button" onClick={() => setEditRecipe(true)} className="text-xs font-bold text-both">
                  Corregir en la receta
                </button>
              </div>
            ) : (
              <>
                <ColorChoice value={d.color} onChange={(color) => setD({ ...d, color })} />
                {!d.color && nutrition.color && <p className="mt-1 text-xs text-muted">Por el nombre parece {COLORS[nutrition.color].label.toLowerCase()}: tócalo si es así.</p>}
              </>
            )}
          </div>
        )}

        <div className="space-y-2">
          <span className="block text-xs font-semibold text-muted">Quién come y dónde</span>
          {PEOPLE_IDS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="w-14 text-sm font-semibold">{PEOPLE[p].name}</span>
              <div className="grid flex-1 grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label={`${PEOPLE[p].name} come`}>
                {(Object.keys(EAT) as EatMode[]).map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="radio"
                    aria-checked={d.eat[p] === e}
                    onClick={() => setD({ ...d, eat: { ...d.eat, [p]: e } })}
                    className={`h-9 rounded-xl text-xs font-bold ${d.eat[p] === e ? 'bg-surface shadow-sm' : 'text-muted'}`}
                  >
                    {EAT[e].emoji} {EAT[e].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            {portions(d.eat) === 0 ? 'Nadie come en casa' : `${portions(d.eat)} ${portions(d.eat) === 1 ? 'ración' : 'raciones'}`}
          </p>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-muted">Cocina</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Quién cocina">
            {COOK.map((c) => (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={d.cook === c.v}
                onClick={() => setD({ ...d, cook: c.v })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${d.cook === c.v ? 'bg-ink text-cream' : 'bg-stone-100'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {d.slot === 'comida' && others.length > 0 && (
          <div>
            <span className="mb-1.5 block text-xs font-semibold text-muted">Hacer de más para otros días (táper)</span>
            <div className="flex flex-wrap gap-1.5">
              {others.map((date) => {
                const on = repeat.includes(date)
                const taken = meals.get(mealId(date, 'comida'))
                return (
                  <button
                    key={date}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRepeat((r) => (on ? r.filter((x) => x !== date) : [...r, date]))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${on ? 'bg-both text-white' : 'bg-stone-100'}`}
                    title={taken ? `Ya hay: ${taken.title}` : undefined}
                  >
                    {dayFmt.format(parseYmd(date))}
                    {taken && !on ? ' ·' : ''}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {cook && recipe && <RecipeCook recipe={recipe} me={me} onClose={() => setCook(false)} onEdit={() => setEditRecipe(true)} onToast={onToast} />}
        {editRecipe && recipe && <RecipeEditor draft={toRecipeDraft(recipe)} me={me} onClose={() => setEditRecipe(false)} onError={onToast} />}

        {existing && (
          <button
            type="button"
            onClick={() => {
              deleteMeal(mealId(draft.date, draft.slot)).catch(fail)
              onClose()
            }}
            className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600"
          >
            <TrashIcon className="size-4" /> Quitar del menú
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

function IngredientsSheet({ meals, recipes, me, onClose, onToast }: { meals: Meal[]; recipes: Recipe[]; me: PersonId; onClose: () => void; onToast: (m: string) => void }) {
  const { items, frequent } = useShopping()
  const today = ymd(new Date())
  // Solo lo que queda por cocinar (de hoy en adelante).
  const list = useMemo(() => weekIngredients(meals.filter((m) => m.date >= today), recipes), [meals, recipes, today])
  const onList = new Set(items.filter((i) => !i.done).map((i) => itemKey(i.name)))
  const [checked, setChecked] = useState(() => new Set(list.filter((i) => !i.pantry && !onList.has(itemKey(i.name))).map((i) => i.name)))

  const add = () => {
    let n = 0
    for (const name of checked) {
      const section = frequent.find((f) => f.key === itemKey(name))?.section ?? 'super'
      if (addShoppingItem(name, section, me, items)) n++
    }
    onToast(n ? `🛒 ${n} ${n === 1 ? 'ingrediente añadido' : 'ingredientes añadidos'} a la compra` : 'Ya estaba todo en la lista')
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Ingredientes a la compra"
      footer={
        <button onClick={add} disabled={checked.size === 0} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Añadir {checked.size} a la compra
        </button>
      }
    >
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Los platos que quedan esta semana no tienen ingredientes apuntados en el recetario.</p>
      ) : (
        <div className="space-y-1">
          <p className="mb-2 text-xs text-muted">Desmarca lo que ya tengáis. Lo de despensa (sal, aceite…) sale desmarcado.</p>
          {list.map((i) => {
            const already = onList.has(itemKey(i.name))
            const on = checked.has(i.name)
            return (
              <label key={i.name} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${already ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={already}
                  onChange={() =>
                    setChecked((s) => {
                      const n = new Set(s)
                      if (on) n.delete(i.name)
                      else n.add(i.name)
                      return n
                    })
                  }
                  className="size-5 accent-both"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold first-letter:uppercase">{i.name}</span>
                  <span className="block truncate text-xs text-muted">{already ? 'Ya está en la lista' : i.dishes.join(' · ')}</span>
                </span>
              </label>
            )
          })}
        </div>
      )}
    </BottomSheet>
  )
}
