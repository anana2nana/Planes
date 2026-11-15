import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EAT, defaultEat, mealId, type EatMode, type Meal, type MealSlot, type Recipe, type RecipeOrgKey } from '../lib/menu'
import { RECIPE_CATS, type RecipeCat } from '../lib/recipeOrg'
import type { DishColor } from '../lib/nutrition'
import { flatIngredients, flatSteps } from '../lib/recipe'
import type { PersonId } from '../lib/types'

const isColor = (v: unknown): v is DishColor => v === 'green' || v === 'yellow' || v === 'red'

const meals = collection(db, 'meals')
const recipes = collection(db, 'recipes')
const htmls = collection(db, 'recipeHtml')

const eatOf = (x: Record<string, unknown> | undefined, date: string, slot: MealSlot): Record<PersonId, EatMode> => {
  const d = defaultEat(date, slot)
  const ok = (v: unknown): v is EatMode => typeof v === 'string' && v in EAT
  return { nita: ok(x?.nita) ? x.nita : d.nita, kitos: ok(x?.kitos) ? x.kitos : d.kitos }
}

function toMeal(id: string, x: Record<string, any>): Meal {
  const slot: MealSlot = x.slot === 'cena' ? 'cena' : 'comida'
  return {
    id,
    date: x.date,
    slot,
    title: x.title ?? '',
    recipeId: typeof x.recipeId === 'string' ? x.recipeId : null,
    cook: x.cook === 'nita' || x.cook === 'kitos' ? x.cook : 'both',
    eat: eatOf(x.eat, x.date, slot),
    notes: x.notes ?? '',
    color: isColor(x.color) ? x.color : null,
  }
}

/** Comidas entre dos fechas (yyyy-mm-dd, ambas incluidas). */
export function useMeals(from: string, to: string) {
  const [list, setList] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(query(meals, where('date', '>=', from), where('date', '<=', to)), (snap) => {
        setList(snap.docs.map((d) => toMeal(d.id, d.data())))
        setLoading(false)
      }),
    [from, to],
  )
  return { meals: list, loading }
}

export function useRecipes() {
  const [list, setList] = useState<Recipe[]>([])
  useEffect(
    () =>
      onSnapshot(recipes, (snap) =>
        setList(
          snap.docs
            .map((d) => {
              const x = d.data({ serverTimestamps: 'estimate' })
              return parseRecipe(d.id, x)
            })
            .sort((a, b) => a.title.localeCompare(b.title, 'es')),
        ),
      ),
    [],
  )
  return list
}

const arr = <T,>(v: unknown, f: (x: any) => T): T[] => (Array.isArray(v) ? v.map(f) : [])
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function parseRecipe(id: string, x: Record<string, any>): Recipe {
  return {
    id,
    title: str(x.title),
    emoji: str(x.emoji) || '🍲',
    url: str(x.url),
    ingredients: arr(x.ingredients, str).filter(Boolean),
    steps: str(x.steps),
    servings: typeof x.servings === 'number' ? x.servings : null,
    notes: str(x.notes),
    description: str(x.description),
    tags: arr(x.tags, str),
    groups: arr(x.groups, (g) => ({ name: str(g?.name), note: str(g?.note), items: arr(g?.items, (i) => ({ q: str(i?.q), name: str(i?.name) })) })),
    gear: arr(x.gear, str),
    gearNote: str(x.gearNote),
    phases: arr(x.phases, (p) => ({
      title: str(p?.title),
      why: str(p?.why),
      steps: arr(p?.steps, (st) => ({
        title: str(st?.title),
        text: str(st?.text),
        chips: arr(st?.chips, str),
        cue: str(st?.cue),
        fix: str(st?.fix),
        tech: arr(st?.tech, str),
        timer: st?.timer && typeof st.timer.seconds === 'number' ? { seconds: st.timer.seconds, label: str(st.timer.label) } : null,
      })),
    })),
    tips: arr(x.tips, (t) => ({ title: str(t?.title), text: str(t?.text), kind: t?.kind === 'warn' ? ('warn' as const) : ('good' as const) })),
    credit: str(x.credit),
    hasHtml: x.hasHtml === true,
    nutrition: { color: isColor(x.nutrition?.color) ? x.nutrition.color : null, kcal: typeof x.nutrition?.kcal === 'number' ? x.nutrition.kcal : null },
    lastPlanned: typeof x.lastPlanned === 'string' ? x.lastPlanned : null,
    createdAt: x.createdAt?.toMillis?.() ?? 0,
    category: typeof x.category === 'string' && x.category in RECIPE_CATS ? (x.category as RecipeCat) : null,
    minutes: typeof x.minutes === 'number' && x.minutes > 0 ? x.minutes : null,
    taper: typeof x.taper === 'boolean' ? x.taper : null,
    favorite: x.favorite === true,
    rating: { nita: typeof x.rating?.nita === 'number' ? x.rating.nita : null, kitos: typeof x.rating?.kitos === 'number' ? x.rating.kitos : null },
    again: typeof x.again === 'boolean' ? x.again : null,
    lists: arr(x.lists, str).filter(Boolean),
    thumb: typeof x.thumb === 'string' && x.thumb.startsWith('data:image') ? x.thumb : null,
  }
}

/** El HTML original de una receta importada (se guarda aparte para que la lista pese poco). */
export async function loadRecipeHtml(id: string): Promise<string | null> {
  const snap = await getDoc(doc(htmls, id))
  return snap.exists() ? str(snap.get('html')) || null : null
}

export function saveMeal(m: Omit<Meal, 'id'>, me: PersonId) {
  const id = mealId(m.date, m.slot)
  if (m.recipeId) setDoc(doc(recipes, m.recipeId), { lastPlanned: m.date }, { merge: true }).catch(() => {})
  return setDoc(doc(meals, id), { ...m, updatedBy: me, updatedAt: serverTimestamp() })
}
export const deleteMeal = (id: string) => deleteDoc(doc(meals, id))

export type RecipeDraft = Omit<Recipe, 'id' | 'lastPlanned' | 'createdAt' | 'hasHtml' | RecipeOrgKey> & Partial<Pick<Recipe, RecipeOrgKey>> & { id?: string }

/** Máximo de caracteres del HTML original que se guarda (los documentos de Firestore admiten 1 MB). */
export const MAX_HTML = 700_000

/**
 * Guarda una receta. En las ricas (con grupos o fases) los ingredientes y los pasos
 * en texto se calculan solos, para buscar y para la compra. Con `html`, guarda también el original.
 */
export function saveRecipe(r: RecipeDraft, me: PersonId, onError: (m: string) => void = console.error, html?: string): string {
  const { id, ...data } = r
  const ref = id ? doc(recipes, id) : doc(recipes)
  const rich = data.groups.length > 0 || data.phases.length > 0
  const flat = rich ? { ingredients: flatIngredients(data), steps: flatSteps(data) } : {}
  const extra = html && html.length <= MAX_HTML ? { hasHtml: true } : {}
  setDoc(ref, { ...data, ...flat, ...extra, ...(id ? {} : { createdBy: me, createdAt: serverTimestamp() }) }, { merge: true }).catch((e: Error) => onError(e.message))
  if (html && html.length <= MAX_HTML) setDoc(doc(htmls, ref.id), { html, updatedAt: serverTimestamp() }).catch((e: Error) => onError(e.message))
  return ref.id
}
export function deleteRecipe(id: string) {
  deleteDoc(doc(htmls, id)).catch(() => {})
  return deleteDoc(doc(recipes, id))
}

/** Cambiar solo lo de organizar (favorita, categoría, nota…) sin tocar la receta. */
export function updateRecipeOrg(id: string, patch: Partial<Pick<Recipe, RecipeOrgKey>>, onError: (m: string) => void = console.error) {
  setDoc(doc(recipes, id), patch, { merge: true }).catch((e: Error) => onError(e.message))
}

/** Foto grande del plato (aparte, para que la lista pese poco). */
export const loadRecipePhoto = async (id: string) => {
  const s = await getDoc(doc(db, 'recipePhotos', id))
  return s.exists() ? (s.get('data') as string) : null
}
export function saveRecipePhoto(id: string, data: string | null, thumb: string | null, onError: (m: string) => void = console.error) {
  ;(data ? setDoc(doc(db, 'recipePhotos', id), { data }) : deleteDoc(doc(db, 'recipePhotos', id))).catch((e: Error) => onError(e.message))
  setDoc(doc(recipes, id), { thumb }, { merge: true }).catch((e: Error) => onError(e.message))
}

/** Todas las comidas con receta (para "las que más hacéis"): pocas al año, se leen enteras. */
export function useCookedMeals() {
  const [list, setList] = useState<{ recipeId: string | null; date: string }[]>([])
  useEffect(
    () =>
      onSnapshot(meals, (snap) =>
        setList(snap.docs.map((d) => ({ recipeId: typeof d.get('recipeId') === 'string' ? d.get('recipeId') : null, date: String(d.get('date') ?? '') })).filter((m) => m.recipeId)),
      ),
    [],
  )
  return list
}
