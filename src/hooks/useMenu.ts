import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EAT, defaultEat, mealId, type EatMode, type Meal, type MealSlot, type Recipe } from '../lib/menu'
import type { PersonId } from '../lib/types'

const meals = collection(db, 'meals')
const recipes = collection(db, 'recipes')

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
              return {
                id: d.id,
                title: x.title ?? '',
                emoji: typeof x.emoji === 'string' && x.emoji ? x.emoji : '🍲',
                url: typeof x.url === 'string' ? x.url : '',
                ingredients: Array.isArray(x.ingredients) ? x.ingredients.filter((i: unknown) => typeof i === 'string') : [],
                steps: x.steps ?? '',
                servings: typeof x.servings === 'number' ? x.servings : null,
                notes: x.notes ?? '',
                lastPlanned: typeof x.lastPlanned === 'string' ? x.lastPlanned : null,
                createdAt: x.createdAt?.toMillis?.() ?? 0,
              }
            })
            .sort((a, b) => a.title.localeCompare(b.title, 'es')),
        ),
      ),
    [],
  )
  return list
}

export function saveMeal(m: Omit<Meal, 'id'>, me: PersonId) {
  const id = mealId(m.date, m.slot)
  if (m.recipeId) setDoc(doc(recipes, m.recipeId), { lastPlanned: m.date }, { merge: true }).catch(() => {})
  return setDoc(doc(meals, id), { ...m, updatedBy: me, updatedAt: serverTimestamp() })
}
export const deleteMeal = (id: string) => deleteDoc(doc(meals, id))

export type RecipeDraft = Omit<Recipe, 'id' | 'lastPlanned' | 'createdAt'> & { id?: string }
export function saveRecipe(r: RecipeDraft, me: PersonId, onError: (m: string) => void = console.error): string {
  const { id, ...data } = r
  const ref = id ? doc(recipes, id) : doc(recipes)
  setDoc(ref, { ...data, ...(id ? {} : { createdBy: me, createdAt: serverTimestamp() }) }, { merge: true }).catch((e: Error) => onError(e.message))
  return ref.id
}
export const deleteRecipe = (id: string) => deleteDoc(doc(recipes, id))
