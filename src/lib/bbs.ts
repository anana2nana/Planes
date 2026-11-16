// bbs: planes y sitios de Nita, Kitos y María. Lógica pura (sin Firebase), testeada.
// ⚠️ Copia idéntica en functions/src/bbs.ts (un test lo comprueba): si cambias una, cambia la otra.

export type BbsPerson = 'nita' | 'kitos' | 'maria'
export const BBS_PEOPLE: readonly BbsPerson[] = ['nita', 'kitos', 'maria']
export const BBS_NAMES: Record<BbsPerson, string> = { nita: 'Nita', kitos: 'Kitos', maria: 'María' }

export type BbsKind = 'restaurante' | 'bar' | 'ruta' | 'expo' | 'escapada' | 'casa' | 'otro'
export const BBS_KINDS: Record<BbsKind, { emoji: string; label: string }> = {
  restaurante: { emoji: '🍽️', label: 'Restaurante' },
  bar: { emoji: '🍸', label: 'Bar' },
  ruta: { emoji: '🥾', label: 'Ruta' },
  expo: { emoji: '🖼️', label: 'Exposición' },
  escapada: { emoji: '🧳', label: 'Escapada' },
  casa: { emoji: '🛋️', label: 'Plan en casa' },
  otro: { emoji: '✨', label: 'Otro' },
}
export const BBS_KIND_IDS = Object.keys(BBS_KINDS) as BbsKind[]

export type BbsStatus = 'pending' | 'done' | 'dropped'
export type BbsSetting = 'in' | 'out' | 'both'
export type BbsRating = 'again' | 'good' | 'meh'
export const BBS_RATINGS: Record<BbsRating, { emoji: string; label: string }> = {
  again: { emoji: '🔁', label: 'Repetiría' },
  good: { emoji: '👍', label: 'Bien' },
  meh: { emoji: '😐', label: 'Meh' },
}

export interface BbsPlace {
  name: string
  address: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

export interface BbsItem {
  id: string
  title: string
  link: string
  kind: BbsKind
  place: BbsPlace | null
  /** 0 = sin decir; 1 = €, 2 = €€, 3 = €€€. */
  price: 0 | 1 | 2 | 3
  setting: BbsSetting | null
  booking: boolean
  note: string
  addedBy: BbsPerson
  status: BbsStatus
  hearts: Partial<Record<BbsPerson, true>>
  ratings: Partial<Record<BbsPerson, BbsRating>>
  /** Planes con fecha o de temporada ("yyyy-mm-dd"). Solo `to` = hasta ese día; los dos iguales = un día. */
  from: string | null
  to: string | null
  /** Día en que se hizo (para el histórico). */
  doneAt: string | null
  /** Avisos de "se acaba" ya mandados (p. ej. ["7", "1"]), los apunta el servidor. */
  endingSent: string[]
  createdMs: number
}

// ─── Fechas (siempre "yyyy-mm-dd", en hora de España las pone quien llama) ───

const dayNum = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from)
export const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type DateState = 'none' | 'soon' | 'open' | 'over'

/** ¿Se puede ir hoy? none = sin fechas · soon = aún no empieza · open = se puede · over = ya pasó. */
export function dateState(item: Pick<BbsItem, 'from' | 'to'>, today: string): DateState {
  if (!item.from && !item.to) return 'none'
  if (item.to && daysBetween(today, item.to) < 0) return 'over'
  if (item.from && daysBetween(today, item.from) > 0) return 'soon'
  return 'open'
}

/** Días que quedan hasta que acaba (0 = hoy es el último día), o null si no tiene fin. */
export function daysLeft(item: Pick<BbsItem, 'to'>, today: string): number | null {
  return item.to ? daysBetween(today, item.to) : null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
const short = (ymd: string) => {
  const [, m, d] = ymd.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** "Solo el 22 nov" · "Del 1 al 15 dic" · "Hasta el 30 nov" · "Desde el 3 dic". */
export function dateText(item: Pick<BbsItem, 'from' | 'to'>): string {
  const { from, to } = item
  if (from && to) return from === to ? `Solo el ${short(from)}` : `Del ${short(from)} al ${short(to)}`
  if (to) return `Hasta el ${short(to)}`
  if (from) return `Desde el ${short(from)}`
  return ''
}

/** Etiqueta corta para la tarjeta: "Acaba hoy", "Quedan 3 días", "Empieza el 3 dic"… o null. */
export function urgencyText(item: Pick<BbsItem, 'from' | 'to'>, today: string): string | null {
  const state = dateState(item, today)
  if (state === 'over') return 'Ya pasó'
  if (state === 'soon') return item.from === item.to ? `El ${short(item.from!)}` : `Empieza el ${short(item.from!)}`
  const left = daysLeft(item, today)
  if (left === null) return null
  if (left === 0) return 'Acaba hoy'
  if (left === 1) return 'Acaba mañana'
  if (left <= 14) return `Quedan ${left} días`
  return null
}

// ─── ❤️ y valoraciones ─────────────────────────────────────────────────────

export const heartCount = (item: Pick<BbsItem, 'hearts'>) => BBS_PEOPLE.filter((p) => item.hearts[p]).length

/** "A los tres" · "A Nita y María" · "Solo a Kitos" · "" (a nadie aún). */
export function heartsText(item: Pick<BbsItem, 'hearts'>, me?: BbsPerson): string {
  const who = BBS_PEOPLE.filter((p) => item.hearts[p])
  if (who.length === 3) return 'Apetece a los tres'
  if (who.length === 0) return ''
  if (who.length === 1) return who[0] === me ? 'Solo te apetece a ti' : `Solo le apetece a ${BBS_NAMES[who[0]]}`
  if (me && who.includes(me)) return `Os apetece a ti y a ${BBS_NAMES[who.find((p) => p !== me)!]}`
  return `Apetece a ${BBS_NAMES[who[0]]} y ${BBS_NAMES[who[1]]}`
}

/** Resumen de "¿qué tal fue?": la valoración que más se repite (en empate, la mejor). */
export function verdict(ratings: BbsItem['ratings']): BbsRating | null {
  const order: BbsRating[] = ['again', 'good', 'meh']
  const counts = order.map((r) => BBS_PEOPLE.filter((p) => ratings[p] === r).length)
  const max = Math.max(...counts)
  return max === 0 ? null : order[counts.indexOf(max)]
}

/** Lo hecho, lo último primero. */
export function history(items: BbsItem[]): BbsItem[] {
  return items.filter((i) => i.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '') || b.createdMs - a.createdMs)
}

/** Pendientes: primero lo que se acaba pronto, luego lo que más apetece, luego lo nuevo. */
export function sortPending(items: BbsItem[], today: string): BbsItem[] {
  const ending = (i: BbsItem) => {
    const left = daysLeft(i, today)
    return dateState(i, today) === 'open' && left !== null && left <= 7 ? left : 99
  }
  return items
    .filter((i) => i.status === 'pending')
    .sort((a, b) => ending(a) - ending(b) || heartCount(b) - heartCount(a) || b.createdMs - a.createdMs)
}

// ─── "No sabemos qué hacer" ────────────────────────────────────────────────

export interface BbsFilters {
  /** Se puede hoy (sin fechas o abierto hoy). */
  today?: boolean
  /** A menos de `nearKm` de `here`. */
  near?: boolean
  cheap?: boolean
  /** Si llueve: a cubierto (o en casa). */
  rain?: boolean
  kinds?: BbsKind[]
}

export const NEAR_KM = 5

/** Distancia en km entre dos puntos (fórmula del haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const isCovered = (i: Pick<BbsItem, 'setting' | 'kind'>) => (i.setting ? i.setting !== 'out' : ['casa', 'expo', 'bar', 'restaurante'].includes(i.kind))

/** ¿Encaja con los filtros? (los que no están marcados no cuentan). */
export function matches(item: BbsItem, f: BbsFilters, today: string, here?: { lat: number; lng: number } | null): boolean {
  if (item.status !== 'pending') return false
  if (dateState(item, today) === 'over') return false
  if (f.today && dateState(item, today) === 'soon') return false
  if (f.cheap && !(item.price === 1 || (item.price === 0 && item.kind === 'casa'))) return false
  if (f.rain && !isCovered(item)) return false
  if (f.kinds?.length && !f.kinds.includes(item.kind)) return false
  if (f.near) {
    if (item.kind === 'casa') return true
    const p = item.place
    if (!here || !p || p.lat === null || p.lng === null) return false
    if (distanceKm(here, { lat: p.lat, lng: p.lng }) > NEAR_KM) return false
  }
  return true
}

/** Peso en el sorteo: más ❤️ = más papeletas; lo que se acaba en una semana, un poco más. */
export function weight(item: BbsItem, today: string): number {
  const hearts = heartCount(item)
  let w = 1 + hearts * 2 + (hearts === 3 ? 2 : 0) // 1, 3, 5, 9
  const left = daysLeft(item, today)
  if (left !== null && left >= 0 && left <= 7) w *= 1.5
  return w
}

/** Elige uno al azar entre los candidatos, con más probabilidad para los que tienen más ❤️. `rand` ∈ [0, 1). */
export function pickWeighted(items: BbsItem[], today: string, rand: number, avoidId?: string): BbsItem | null {
  const pool = items.length > 1 && avoidId ? items.filter((i) => i.id !== avoidId) : items
  if (pool.length === 0) return null
  const weights = pool.map((i) => weight(i, today))
  let r = rand * weights.reduce((a, b) => a + b, 0)
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k]
    if (r < 0) return pool[k]
  }
  return pool[pool.length - 1]
}

// ─── Apuntar en segundos ───────────────────────────────────────────────────

const KIND_WORDS: [BbsKind, RegExp][] = [
  ['ruta', /(wikiloc\.|alltrails\.|komoot\.|\bruta\b|senderismo|excursi[oó]n|\bmonte\b|cascada|mirador)/i],
  ['expo', /(\bexpo\b|exposici[oó]n|\bmuseo|galer[ií]a|\bteatro|concierto|festival|mercadillo|feria\b|musical)/i],
  ['escapada', /(escapada|booking\.com|airbnb\.|\bhotel\b|casa rural|fin de semana en|pueblo)/i],
  ['bar', /(\bbar\b|\bbares\b|cocteler[ií]a|c[oó]ctel|cervecer[ií]a|vermut|vinoteca|\bterraza\b|\bpub\b)/i],
  ['restaurante', /(restaurante|\brest\b|brunch|\bcomer\b|\bcena[rs]?\b|tapas|pizzer[ií]a|ramen|sushi|asador|tasca|taberna|marisquer[ií]a|cafeter[ií]a|helader[ií]a|thefork\.|eltenedor\.)/i],
  ['casa', /(netflix|hbo|filmin|primevideo|disney|\bpeli\b|juego de mesa|en casa|receta)/i],
]

/** Tipo a partir del título, el texto y el enlace (lo que se comparte desde otra app). */
export function guessKind(text: string, link = ''): BbsKind {
  const all = `${text} ${link}`
  return KIND_WORDS.find(([, re]) => re.test(all))?.[0] ?? 'otro'
}

/** El enlace, limpio: sin rastreadores típicos (?utm_…, igsh, si=…). */
export function cleanLink(url: string): string {
  const t = url.trim()
  if (!/^https?:\/\//i.test(t)) return t
  try {
    const u = new URL(t)
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|igsh|igshid|si$|fbclid|gclid|_t$|_r$|is_from_webapp|sender_device|share_)/i.test(k)) u.searchParams.delete(k)
    return u.toString().replace(/\?$/, '')
  } catch {
    return t
  }
}

/** "instagram.com" → "Instagram" (para la tarjeta). */
export function linkLabel(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^(www|m|vm|vt)\./, '')
  } catch {
    return ''
  }
  const KNOWN: [RegExp, string][] = [
    [/instagram\./, 'Instagram'],
    [/tiktok\./, 'TikTok'],
    [/(maps\.app\.goo\.gl|goo\.gl|google\.[a-z.]+$)/, 'Google Maps'],
    [/(youtube\.|youtu\.be)/, 'YouTube'],
    [/wikiloc\./, 'Wikiloc'],
    [/(thefork|eltenedor)\./, 'TheFork'],
  ]
  return KNOWN.find(([re]) => re.test(host))?.[1] ?? host
}

// ─── Avisos (los usa el servidor) ──────────────────────────────────────────

export interface BbsPush {
  to: BbsPerson
  title: string
  body: string
  tag: string
  kind: 'activity' | 'reminder'
}

/** Al apuntar algo nuevo: avisa a los otros dos (nunca a quien lo apuntó). */
export function addedPushes(item: Pick<BbsItem, 'id' | 'title' | 'kind' | 'addedBy' | 'from' | 'to' | 'place'>): BbsPush[] {
  const k = BBS_KINDS[item.kind]
  const where = item.place?.name && item.place.name !== item.title ? ` · ${item.place.name}` : ''
  const when = dateText(item)
  return BBS_PEOPLE.filter((p) => p !== item.addedBy).map((to) => ({
    to,
    title: `${k.emoji} ${BBS_NAMES[item.addedBy]} ha apuntado algo en bbs`,
    body: `${item.title}${where}${when ? ` · ${when}` : ''}`,
    tag: `bbs-new-${item.id}`,
    kind: 'activity',
  }))
}

/** Avisos de "se acaba": 7 días antes, 2 días antes (si dura) y el último día. Claves = días que quedan. */
export const ENDING_STEPS = [7, 2, 0] as const

export function endingPushes(items: BbsItem[], today: string): { id: string; step: string; pushes: BbsPush[] }[] {
  const out: { id: string; step: string; pushes: BbsPush[] }[] = []
  for (const item of items) {
    if (item.status !== 'pending' || !item.to) continue
    const oneDay = item.from === item.to
    const state = dateState(item, today)
    // Lo de un solo día avisa antes de que llegue; lo que dura, cuando ya ha empezado.
    if (state === 'over' || (state === 'soon' && !oneDay)) continue
    const left = daysLeft(item, today)!
    // El escalón que toca hoy (el más cercano que no se haya mandado aún; si se pasó uno, no se repite).
    const step = ENDING_STEPS.find((s) => left === s)
    if (step === undefined || item.endingSent.includes(String(step))) continue
    // Un plan de un solo día no avisa "se acaba hoy": avisa la víspera como recordatorio.
    if (oneDay && step === 0) continue
    const k = BBS_KINDS[item.kind]
    const title = oneDay
      ? `${k.emoji} ${step === 2 ? 'Pasado mañana' : 'Dentro de una semana'}: ${item.title}`
      : step === 0
        ? `⏳ Último día: ${item.title}`
        : `⏳ Se acaba ${step === 2 ? 'pasado mañana' : 'en una semana'}: ${item.title}`
    const fans = BBS_PEOPLE.filter((p) => item.hearts[p])
    const body = `${dateText(item)}${fans.length ? ` · ❤️ ${fans.map((p) => BBS_NAMES[p]).join(', ')}` : ''}`
    out.push({ id: item.id, step: String(step), pushes: BBS_PEOPLE.map((to) => ({ to, title, body, tag: `bbs-end-${item.id}`, kind: 'reminder' })) })
  }
  return out
}

// ─── Leer un documento (app y servidor) ────────────────────────────────────

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const ymdOrNull = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const isPerson = (v: unknown): v is BbsPerson => BBS_PEOPLE.includes(v as BbsPerson)

export function parseBbsItem(id: string, x: Record<string, any>, createdMs = 0): BbsItem {
  const hearts: BbsItem['hearts'] = {}
  const ratings: BbsItem['ratings'] = {}
  for (const p of BBS_PEOPLE) {
    if (x.hearts?.[p] === true) hearts[p] = true
    if (['again', 'good', 'meh'].includes(x.ratings?.[p])) ratings[p] = x.ratings[p]
  }
  const pl = x.place
  return {
    id,
    title: s(x.title) || 'Sin título',
    link: s(x.link),
    kind: BBS_KIND_IDS.includes(x.kind) ? x.kind : 'otro',
    place: pl?.name ? { name: s(pl.name), address: s(pl.address), placeId: typeof pl.placeId === 'string' ? pl.placeId : null, lat: n(pl.lat), lng: n(pl.lng) } : null,
    price: [1, 2, 3].includes(x.price) ? x.price : 0,
    setting: ['in', 'out', 'both'].includes(x.setting) ? x.setting : null,
    booking: x.booking === true,
    note: s(x.note),
    addedBy: isPerson(x.addedBy) ? x.addedBy : 'nita',
    status: ['done', 'dropped'].includes(x.status) ? x.status : 'pending',
    hearts,
    ratings,
    from: ymdOrNull(x.from),
    to: ymdOrNull(x.to),
    doneAt: ymdOrNull(x.doneAt),
    endingSent: Array.isArray(x.endingSent) ? x.endingSent.filter((v: unknown) => typeof v === 'string') : [],
    createdMs,
  }
}
