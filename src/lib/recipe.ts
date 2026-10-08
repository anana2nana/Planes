// Recetas "ricas": grupos de ingredientes, fases con pasos (señal de que va bien,
// qué hacer si falla, técnica, temporizador) y consejos. Puro y testeado (tests/recipe.test.ts).

export interface IngItem {
  /** Cantidad tal cual: "300 g", "2 a 3 g", "1 pizca", "al gusto"… */
  q: string
  name: string
}
export interface IngGroup {
  name: string
  items: IngItem[]
  note: string
}
export interface Step {
  title: string
  text: string
  /** Etiquetas cortas: "fuego medio-bajo", "12 a 15 min"… */
  chips: string[]
  /** "Señal de que va bien". */
  cue: string
  /** "Si no está bien". */
  fix: string
  /** "Técnica al detalle". */
  tech: string[]
  /** Temporizador en segundos, con su nombre. */
  timer: { seconds: number; label: string } | null
}
export interface Phase {
  title: string
  why: string
  steps: Step[]
}
export interface Tip {
  title: string
  text: string
  kind: 'good' | 'warn'
}

export interface RichRecipe {
  title: string
  description: string
  tags: string[]
  servings: number | null
  groups: IngGroup[]
  notes: string
  gear: string[]
  gearNote: string
  phases: Phase[]
  tips: Tip[]
  credit: string
  url: string
}

export const emptyStep = (o: Partial<Step> = {}): Step => ({ title: '', text: '', chips: [], cue: '', fix: '', tech: [], timer: null, ...o })

// ─── Cantidades ─────────────────────────────────────────────────────────────

const UNIT =
  'kg|kilos?|g|gr|grs|gramos?|mg|l|litros?|ml|cl|dl|cdas?|cdtas?|cucharadas?|cucharaditas?|tazas?|vasos?|pizcas?|chorritos?|chorros?|puñados?|dientes?|ramas?|ramitas?|latas?|botes?|sobres?|paquetes?|rodajas?|lonchas?|filetes?|trozos?|unidades?|uds?|nuez|nueces|cabezas?|tiras?|tarrinas?'
const NUM = String.raw`(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾)`
const QTY_RE = new RegExp(String.raw`^((?:${NUM})(?:\s*(?:a|-|–)\s*${NUM})?\s*(?:(?:${UNIT})(?![\p{L}])\.?)?|al gusto|a mano|c\/n)\s*(?:de\s+|del\s+)?`, 'iu')

/** "300 g de lentejas" → { q: "300 g", name: "lentejas" }; "Sal" → { q: "", name: "Sal" }. */
export function splitQty(line: string): IngItem {
  const s = line.replace(/^[-•*·]\s*/, '').trim()
  const m = s.match(QTY_RE)
  if (!m || !m[1]) return { q: '', name: s }
  const name = s.slice(m[0].length).trim()
  return name ? { q: m[1].trim(), name } : { q: '', name: s }
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }
const toNum = (s: string) => {
  if (s in FRACTIONS) return FRACTIONS[s]
  if (s.includes('/')) {
    const [a, b] = s.split('/').map((x) => Number(x.trim()))
    return a / b
  }
  return Number(s.replace(',', '.'))
}
const fmt = (n: number) => {
  const r = n >= 20 ? Math.round(n / 5) * 5 : n >= 3 ? Math.round(n) : n >= 1 ? Math.round(n * 2) / 2 : Math.round(n * 4) / 4
  return r.toLocaleString('es-ES', { maximumFractionDigits: 2 })
}

/** Ajusta una cantidad para otro número de raciones ("300 g" ×2/3 → "200 g"). Pizcas, "al gusto"… no cambian. */
export function scaleQty(q: string, factor: number): string {
  if (factor === 1 || !q || /pizca|al gusto|a mano|nuez|c\/n/i.test(q)) return q
  return q.replace(new RegExp(NUM, 'g'), (m) => fmt(toNum(m) * factor))
}

/** Nombre para la lista de la compra: sin lo que va tras una coma, paréntesis ni "para …". */
export function shoppingName(name: string): string {
  const s = name
    .replace(/\(.*?\)/g, '')
    .split(/[,;]/)[0]
    .replace(/\s+para\s+.*$/i, '')
    .replace(/\s+(al gusto|opcional)$/i, '')
    .trim()
  return s.charAt(0).toLowerCase() + s.slice(1)
}

export function parseServings(texts: string[]): number | null {
  for (const t of texts) {
    const m = t.match(/(\d+)\s*(personas|raciones|comensales|porciones)/i)
    if (m) return Number(m[1])
  }
  return null
}

// ─── Conversión con el formato sencillo (ingredientes y pasos como texto) ──

/** Una receta sencilla (líneas de ingredientes y pasos) en formato rico. */
export function richFromSimple(r: { title: string; ingredients: string[]; steps: string; servings?: number | null; url?: string; notes?: string }): RichRecipe {
  const lines = r.steps
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return {
    title: r.title,
    description: '',
    tags: [],
    servings: r.servings ?? null,
    groups: r.ingredients.length ? [{ name: '', items: r.ingredients.map(splitQty), note: '' }] : [],
    notes: r.notes ?? '',
    gear: [],
    gearNote: '',
    phases: lines.length ? [{ title: '', why: '', steps: lines.map((l) => emptyStep({ text: l.replace(/^\d+[.)]\s*/, '') })) }] : [],
    tips: [],
    credit: '',
    url: r.url ?? '',
  }
}

/** Ingredientes como líneas de texto (para buscar y para la lista de la compra). */
export const flatIngredients = (r: Pick<RichRecipe, 'groups'>) => r.groups.flatMap((g) => g.items.map((i) => [i.q, i.name].filter(Boolean).join(' ')))

/** Pasos como texto (para buscar). */
export const flatSteps = (r: Pick<RichRecipe, 'phases'>) =>
  r.phases
    .flatMap((p) => p.steps.map((s) => [s.title, s.text].filter(Boolean).join(': ')))
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n')

/** Nombres para la compra de una receta rica. */
export const shoppingNames = (r: Pick<RichRecipe, 'groups'>) => r.groups.flatMap((g) => g.items.map((i) => shoppingName(i.name))).filter(Boolean)

/** Lee un número de segundos de un texto tipo "30 min", "2 h", "60 s", "12 a 15 min" (toma el primero). */
export function secondsIn(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:a\s*\d+\s*)?(h|horas?|min|minutos?|s|seg|segundos?)\b/i)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const u = m[2].toLowerCase()
  return Math.round(u.startsWith('h') ? n * 3600 : u.startsWith('m') ? n * 60 : n)
}

/** "1800" → "30:00"; "7200" → "2:00:00". */
export function clock(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`
}
