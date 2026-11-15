// Organizar el recetario: categorías (adivinadas y corregibles), tiempo, táper, de quién es,
// "¿qué hago con lo que tengo?", las que más hacéis y cómo ordenar. Puro y testeado (tests/recipeOrg.test.ts).

export type RecipeCat = 'desayuno' | 'ensalada' | 'pasta' | 'legumbres' | 'carne' | 'pescado' | 'verdura' | 'sopa' | 'postre' | 'salsa'
export const RECIPE_CATS: Record<RecipeCat, { label: string; emoji: string }> = {
  desayuno: { label: 'Desayunos', emoji: '🥐' },
  ensalada: { label: 'Ensaladas y entrantes', emoji: '🥗' },
  pasta: { label: 'Pasta y arroz', emoji: '🍝' },
  legumbres: { label: 'Legumbres', emoji: '🫘' },
  carne: { label: 'Carne', emoji: '🍗' },
  pescado: { label: 'Pescado', emoji: '🐟' },
  verdura: { label: 'Verduras', emoji: '🥦' },
  sopa: { label: 'Sopas y cremas', emoji: '🥣' },
  postre: { label: 'Postres', emoji: '🍰' },
  salsa: { label: 'Salsas y bases', emoji: '🫙' },
}
export const CAT_ORDER = Object.keys(RECIPE_CATS) as RecipeCat[]

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Por orden: lo primero que encaja manda (el título pesa más que los ingredientes).
const RULES: [RecipeCat, RegExp][] = [
  ['postre', /\b(tarta|bizcocho|galleta|brownie|flan|natillas|helado|mousse|cookie|crepe|tiramisu|magdalena|muffin|arroz con leche|torrija|postre|cheesecake|coulant|trufa)/],
  ['desayuno', /\b(desayuno|tostada|porridge|gachas|tortitas|pancake|granola|overnight|smoothie|batido)/],
  ['salsa', /^(salsa|alioli|mayonesa|pesto|vinagreta|caldo|fondo|sofrito|bechamel|hummus|guacamole|chimichurri|aderezo)/],
  ['sopa', /\b(sopa|crema de|pure|gazpacho|salmorejo|consome|vichyssoise|caldo de|ramen)/],
  ['legumbres', /\b(lenteja|garbanzo|alubia|judion|fabada|potaje|cocido|frijol|soja texturizada|habas?\b)/],
  ['pasta', /\b(pasta|espagueti|spaghetti|macarron|lasana|canelon|tallarin|fideu|noodle|ravioli|gnocchi|nyoqui|arroz|paella|risotto|pizza|quiche|empanada)/],
  ['ensalada', /\b(ensalada|poke|tartar|carpaccio|ceviche|croqueta|tapa|dip|bruschetta|tosta)/],
  ['pescado', /\b(pescado|merluza|salmon|bacalao|atun|dorada|lubina|gamba|langostino|calamar|sepia|pulpo|mejillon|almeja|sardina|boqueron|rape|marisco)/],
  ['carne', /\b(pollo|ternera|cerdo|carne|solomillo|lomo|costilla|hamburguesa|albondiga|pavo|cordero|chorizo|secreto|presa|pechuga|muslo|filete|redondo|carrillada|rabo)/],
  ['verdura', /\b(verdura|calabacin|berenjena|brocoli|coliflor|espinaca|alcachofa|pimiento|champinon|seta|tofu|tempeh|wok|parrillada|pisto|menestra|tortilla|huevo)/],
]

/** La categoría que suena por el título (y si no, por los ingredientes). */
export function guessCategory(r: { title: string; ingredients: string[] }): RecipeCat | null {
  const title = norm(r.title)
  for (const [cat, re] of RULES) if (re.test(title)) return cat
  const ings = norm(r.ingredients.join(' · '))
  for (const cat of ['pescado', 'carne', 'legumbres', 'pasta'] as RecipeCat[]) if (RULES.find(([c]) => c === cat)![1].test(ings)) return cat
  return null
}

/** Minutos que se tarda: lo apuntado, o lo que digan las etiquetas ("45 min", "1 h 30"), o la suma de temporizadores. */
export function guessMinutes(r: { tags?: string[]; title?: string; phases?: { steps: { timer: { seconds: number } | null }[] }[] }): number | null {
  for (const t of [...(r.tags ?? []), r.title ?? '']) {
    const s = norm(t)
    const h = s.match(/(\d+(?:[.,]\d+)?)\s*h(?:ora)?s?\b(?:\s*(?:y\s*)?(\d+)\s*(?:min)?)?/)
    if (h) return Math.round(Number(h[1].replace(',', '.')) * 60 + Number(h[2] ?? 0))
    const m = s.match(/(\d+)\s*min/)
    if (m) return Number(m[1])
  }
  const secs = (r.phases ?? []).flatMap((p) => p.steps).reduce((n, st) => n + (st.timer?.seconds ?? 0), 0)
  return secs > 0 ? Math.max(5, Math.round(secs / 60 / 5) * 5) : null
}

/** Lo que suele aguantar bien en táper (guisos, legumbres, pasta, arroz, cremas). */
export const guessTaper = (cat: RecipeCat | null, title: string) =>
  (cat !== null && ['legumbres', 'pasta', 'sopa'].includes(cat)) || /\b(guiso|estofado|curry|lasana|albondiga|pisto|tortilla)/.test(norm(title))

/** De quién es la receta (para filtrar): Diego Doal, Cocina con Carmen, de redes, o vuestra. */
export function authorOf(r: { credit?: string; url?: string; notes?: string; title?: string }): string {
  const all = norm([r.credit, r.url, r.notes, r.title].filter(Boolean).join(' '))
  if (/diego ?doal/.test(all)) return 'Diego Doal'
  if (/cocina ?con ?carmen/.test(all)) return 'Cocina con Carmen'
  if (/tiktok|instagram|youtu/.test(all)) return 'De redes'
  return 'Vuestras'
}

const stem = (w: string) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w)

/**
 * "¿Qué hago con lo que tengo?": las recetas que usan más de lo que tenéis ("pollo, calabacín").
 * Con lo que falta, para ver si merece la pena.
 */
export function matchPantry<T extends { ingredients: string[] }>(recipes: T[], have: string): { recipe: T; hits: string[]; missing: number }[] {
  const items = have
    .split(/,|\by\b|\n/)
    .map((s) => s.trim())
    .filter((s) => norm(s).length > 1)
  if (!items.length) return []
  return recipes
    .map((recipe) => {
      const ings = recipe.ingredients.map(norm)
      const hits = items.filter((it) => {
        const words = norm(it).split(' ').map(stem)
        return ings.some((ing) => words.every((w) => ing.includes(w)))
      })
      return { recipe, hits, missing: Math.max(0, recipe.ingredients.length - hits.length) }
    })
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.missing - b.missing)
}

/** Veces que se ha hecho cada receta (comidas del menú con esa receta, hasta hoy). */
export function cookedCounts(meals: { recipeId: string | null; date: string }[], today: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const m of meals) if (m.recipeId && m.date <= today) out.set(m.recipeId, (out.get(m.recipeId) ?? 0) + 1)
  return out
}

export const avgOf = (rating: { nita: number | null; kitos: number | null }) => {
  const r = [rating.nita, rating.kitos].filter((x): x is number => typeof x === 'number' && x > 0)
  return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}

export type SortMode = 'name' | 'recent' | 'cooked' | 'rating'
export const SORTS: Record<SortMode, string> = { name: 'Por nombre', recent: 'Más recientes', cooked: 'Las que más hacéis', rating: 'Mejor valoradas' }

export function sortRecipes<T extends { id: string; title: string; createdAt: number; rating: { nita: number | null; kitos: number | null } }>(
  list: T[],
  mode: SortMode,
  cooked: Map<string, number>,
): T[] {
  const byName = (a: T, b: T) => a.title.localeCompare(b.title, 'es')
  const sorted = [...list]
  if (mode === 'name') return sorted.sort(byName)
  if (mode === 'recent') return sorted.sort((a, b) => b.createdAt - a.createdAt || byName(a, b))
  if (mode === 'cooked') return sorted.sort((a, b) => (cooked.get(b.id) ?? 0) - (cooked.get(a.id) ?? 0) || byName(a, b))
  return sorted.sort((a, b) => (avgOf(b.rating) ?? -1) - (avgOf(a.rating) ?? -1) || byName(a, b))
}

/** Las que hicisteis alguna vez y hace más de `days` días que no (las más olvidadas primero). */
export function forgotten<T extends { id: string; lastPlanned: string | null }>(list: T[], today: string, days = 60): T[] {
  const t = new Date(`${today}T12:00`)
  const limit = new Date(t.getFullYear(), t.getMonth(), t.getDate() - days)
  const lim = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, '0')}-${String(limit.getDate()).padStart(2, '0')}`
  return list.filter((r) => r.lastPlanned && r.lastPlanned < lim).sort((a, b) => a.lastPlanned!.localeCompare(b.lastPlanned!))
}
