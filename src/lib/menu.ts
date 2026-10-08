// Menú de la semana y recetas: cálculos puros (testeados en tests/menu.test.ts).

import { richFromSimple, shoppingNames, type RichRecipe } from './recipe.ts'
import type { PersonId } from './types'

export type MealSlot = 'comida' | 'cena'
/** Dónde come cada uno: en casa, se lleva táper o come fuera. */
export type EatMode = 'casa' | 'taper' | 'fuera'

export interface Meal {
  /** `${date}_${slot}` */
  id: string
  date: string
  slot: MealSlot
  title: string
  recipeId: string | null
  cook: PersonId | 'both'
  eat: Record<PersonId, EatMode>
  notes: string
}

export interface Recipe extends Omit<RichRecipe, 'title' | 'url' | 'servings' | 'notes'> {
  id: string
  title: string
  emoji: string
  url: string
  /** Ingredientes como texto (derivados de los grupos en las recetas ricas). */
  ingredients: string[]
  steps: string
  servings: number | null
  notes: string
  /** Tiene el HTML original guardado (en recipeHtml/{id}). */
  hasHtml: boolean
  /** Última vez que se puso en el menú (yyyy-mm-dd). */
  lastPlanned: string | null
  createdAt: number
}

export const EAT: Record<EatMode, { label: string; emoji: string; next: EatMode }> = {
  casa: { label: 'En casa', emoji: '🏠', next: 'taper' },
  taper: { label: 'Táper', emoji: '🥡', next: 'fuera' },
  fuera: { label: 'Fuera', emoji: '🚫', next: 'casa' },
}

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const mealId = (date: string, slot: MealSlot) => `${date}_${slot}`

/** Lunes de la semana de `d`. */
export function weekStart(d: Date): Date {
  const day = (d.getDay() + 6) % 7 // 0 = lunes
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
}
export const weekDays = (monday: Date) => Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))

const isWeekend = (date: string) => [0, 6].includes(parseYmd(date).getDay())

/** Huecos que se muestran siempre: la comida de cada día y la cena del finde (las cenas entre semana, si se añaden). */
export const defaultSlots = (date: string): MealSlot[] => (isWeekend(date) ? ['comida', 'cena'] : ['comida'])

/** Martes y miércoles los dos se llevan táper; el resto, en casa (se cambia tocando). */
export function defaultEat(date: string, slot: MealSlot): Record<PersonId, EatMode> {
  const dow = parseYmd(date).getDay()
  return slot === 'comida' && (dow === 2 || dow === 3) ? { nita: 'taper', kitos: 'taper' } : { nita: 'casa', kitos: 'casa' }
}

export const portions = (eat: Record<PersonId, EatMode>) => (['nita', 'kitos'] as PersonId[]).filter((p) => eat[p] !== 'fuera').length

// ─── Ingredientes ───────────────────────────────────────────────────────────

const UNITS =
  'kg|kilos?|g|gr|grs|gramos?|mg|l|litros?|ml|cl|dl|cucharadas?|cucharaditas?|cdas?|cdtas?|cdta|tazas?|vasos?|pizcas?|chorritos?|chorros?|puñados?|dientes?|ramas?|ramitas?|hojas?|latas?|botes?|sobres?|paquetes?|tarrinas?|rodajas?|lonchas?|filetes?|trozos?|unidades?|uds?|piezas?|manojos?|cabezas?|tiras?|bolsas?|briks?|vasitos?|tacitas?|cuchara|cucharón'
const QTY = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾|(?:unas|unos|una|un|medio|media)(?![\p{L}]))`
const LEAD = new RegExp(String.raw`^\s*(?:${QTY}\s*(?:-|a\s)?\s*)+(?:(?:${UNITS})(?![\p{L}])\.?\s*)?(?:de\s+|del\s+)?`, 'iu')

/** "200 g de garbanzos cocidos" → "garbanzos cocidos"; "Sal al gusto" → "sal". */
export function ingredientName(line: string): string {
  let s = line
    .replace(/^[-•*·]\s*/, '')
    .replace(/\(.*?\)/g, '')
    .trim()
  s = s.replace(LEAD, '')
  s = s
    .split(/[,;]/)[0]
    .replace(/\b(al gusto|c\/n|cantidad necesaria|opcional|para (decorar|servir))\b.*$/i, '')
    .replace(/[,;:.]+$/, '')
    .trim()
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/** Lo que casi siempre hay en casa: sale desmarcado al pasar a la compra. */
const PANTRY = ['sal', 'pimienta', 'aceite', 'aove', 'aceite de oliva', 'aceite de oliva virgen extra', 'agua', 'azúcar', 'vinagre', 'pimentón', 'comino', 'orégano', 'laurel', 'perejil seco', 'harina', 'ajo en polvo']
export const isPantry = (name: string) => PANTRY.some((p) => name === p || name.startsWith(`${p} `)) || /^(sal|pimienta)\b/.test(name)

export interface WeekIngredient {
  name: string
  /** Platos que lo usan. */
  dishes: string[]
  pantry: boolean
}

/** Ingredientes de las recetas del menú, sin repetir, con los platos que los usan. */
export function weekIngredients(meals: Pick<Meal, 'recipeId' | 'title'>[], recipes: (Pick<Recipe, 'id' | 'title' | 'ingredients'> & { groups?: RichRecipe['groups'] })[]): WeekIngredient[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const out = new Map<string, WeekIngredient>()
  const seenRecipe = new Set<string>()
  for (const m of meals) {
    const r = m.recipeId ? byId.get(m.recipeId) : undefined
    if (!r || seenRecipe.has(r.id)) continue // el mismo plato varios días (táper) cuenta una vez
    seenRecipe.add(r.id)
    const names = r.groups?.length ? shoppingNames({ groups: r.groups }) : r.ingredients.map(ingredientName)
    for (const name of names) {
      if (!name) continue
      const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
      const cur = out.get(key) ?? { name, dishes: [], pantry: isPantry(name) }
      if (!cur.dishes.includes(r.title)) cur.dishes.push(r.title)
      out.set(key, cur)
    }
  }
  return [...out.values()]
}

// ─── Pegar la descripción de un vídeo (TikTok, Instagram…) ──────────────────

/**
 * Separa un texto pegado en ingredientes y pasos. Reconoce los encabezados
 * "Ingredientes" y "Preparación/Elaboración/Pasos"; sin ellos, las líneas que
 * empiezan por una cantidad o un guion son ingredientes y el resto, pasos.
 */
export function splitRecipeText(text: string): { ingredients: string[]; steps: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^#\w/.test(l)) // hashtags
  const ING = /^(?:[^\p{L}\d]*)ingredientes\b.*:?$/iu
  const STEPS = /^(?:[^\p{L}\d]*)(preparaci[oó]n|elaboraci[oó]n|pasos|modo de hacerlo|c[oó]mo se hace|instrucciones)\b.*:?$/iu
  const ingredients: string[] = []
  const steps: string[] = []
  let mode: 'none' | 'ing' | 'steps' = 'none'
  const bullet = /^[-•*·▪️✅👉🔸🔹]/u
  const looksIngredient = (l: string) => bullet.test(l) || new RegExp(`^${QTY}\\s`, 'iu').test(l)
  for (const raw of lines) {
    if (ING.test(raw)) {
      mode = 'ing'
      continue
    }
    if (STEPS.test(raw)) {
      mode = 'steps'
      continue
    }
    const l = raw.replace(/^[-•*·▪️✅👉🔸🔹]+\s*/u, '').trim()
    if (!l) continue
    if (mode === 'ing' || (mode === 'none' && looksIngredient(raw) && l.length <= 80)) ingredients.push(l)
    else steps.push(l)
  }
  return { ingredients, steps: steps.join('\n') }
}

/** De dónde es el enlace, para mostrarlo bonito. */
export function sourceOf(url: string): { label: string; emoji: string } | null {
  if (!url) return null
  if (/tiktok\.com/i.test(url)) return { label: 'TikTok', emoji: '🎵' }
  if (/instagram\.com/i.test(url)) return { label: 'Instagram', emoji: '📸' }
  if (/youtu\.?be/i.test(url)) return { label: 'YouTube', emoji: '▶️' }
  try {
    return { label: new URL(url).hostname.replace(/^www\./, ''), emoji: '🔗' }
  } catch {
    return null
  }
}

/** La receta en formato rico (las sencillas se convierten al vuelo). */
export function richOf(r: Recipe): RichRecipe {
  if (r.groups.length || r.phases.length) return r
  return { ...richFromSimple(r), description: r.description, tags: r.tags }
}
