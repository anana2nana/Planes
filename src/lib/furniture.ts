// Muebles y deco: lo que necesitáis por habitación, opciones de cualquier tienda con los votos de cada uno,
// lo elegido sumando al presupuesto de MEROE y lo comprado. Puro y testeado (tests/furniture.test.ts).

export type RoomId = 'salon' | 'dormitorio' | 'cocina' | 'bano' | 'terraza' | 'entrada' | 'estudio' | 'otros'
export const ROOMS: Record<RoomId, { label: string; emoji: string }> = {
  salon: { label: 'Salón', emoji: '🛋️' },
  dormitorio: { label: 'Dormitorio', emoji: '🛏️' },
  cocina: { label: 'Cocina', emoji: '🍳' },
  bano: { label: 'Baño', emoji: '🛁' },
  terraza: { label: 'Terraza', emoji: '🌿' },
  entrada: { label: 'Entrada', emoji: '🚪' },
  estudio: { label: 'Estudio', emoji: '💻' },
  otros: { label: 'Otros', emoji: '📦' },
}
export const ROOM_ORDER = Object.keys(ROOMS) as RoomId[]

/** Las mismas categorías que el presupuesto de MEROE. */
export type FurnCategory = 'muebles' | 'electro' | 'reforma'
export const FURN_CATEGORIES: Record<FurnCategory, string> = { muebles: '🛋️ Mueble o deco', electro: '🧺 Electrodoméstico', reforma: '🔨 Reforma' }

export type Vote = -1 | 0 | 1

export interface FurnOption {
  id: string
  title: string
  store: string
  url: string
  image: string
  price: number | null
  /** Precio anterior, si bajó (para enseñarlo tachado). */
  prevPrice: number | null
  /** Último día en que se miró el precio en la tienda (yyyy-mm-dd). */
  priceAt: string | null
  votes: Record<'nita' | 'kitos', Vote>
}

export interface FurnItem {
  id: string
  name: string
  room: RoomId
  category: FurnCategory
  status: 'open' | 'bought'
  options: FurnOption[]
  chosenId: string | null
  /** Al comprarlo: lo que costó y el gasto que se creó en MEROE. */
  boughtPrice: number | null
  boughtAt: string | null
  homeItemId: string | null
  notes: string
}

export const chosenOf = (i: Pick<FurnItem, 'options' | 'chosenId'>) => i.options.find((o) => o.id === i.chosenId) ?? null

/** En qué punto está: necesitáis algo, tenéis opciones, ya elegisteis, o ya lo comprasteis. */
export function stage(i: Pick<FurnItem, 'status' | 'options' | 'chosenId'>): 'need' | 'choosing' | 'chosen' | 'bought' {
  if (i.status === 'bought') return 'bought'
  if (chosenOf(i)) return 'chosen'
  return i.options.length ? 'choosing' : 'need'
}

/** Las opciones de la mejor a la peor según vuestros votos (a igualdad, la más barata). */
export function ranked(options: FurnOption[]): FurnOption[] {
  const score = (o: FurnOption) => o.votes.nita + o.votes.kitos
  return [...options].sort((a, b) => score(b) - score(a) || (a.price ?? Infinity) - (b.price ?? Infinity))
}

export const bothLike = (o: FurnOption) => o.votes.nita === 1 && o.votes.kitos === 1

/** Lo que cuesta (o costará) cada cosa: lo pagado si está comprada; si no, la opción elegida. */
export function cost(i: FurnItem): { spent: number; planned: number } {
  if (i.status === 'bought') return { spent: i.boughtPrice ?? chosenOf(i)?.price ?? 0, planned: 0 }
  return { spent: 0, planned: chosenOf(i)?.price ?? 0 }
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Por habitación: cuántas cosas, cuántas compradas, lo gastado y lo elegido pendiente de comprar. */
export function roomSummary(items: FurnItem[]) {
  return ROOM_ORDER.map((room) => {
    const list = items.filter((i) => i.room === room)
    const c = list.map(cost)
    return {
      room,
      count: list.length,
      bought: list.filter((i) => i.status === 'bought').length,
      spent: cents(c.reduce((s, x) => s + x.spent, 0)),
      planned: cents(c.reduce((s, x) => s + x.planned, 0)),
    }
  }).filter((r) => r.count > 0)
}

/** Lo elegido pero aún sin comprar, por categoría del presupuesto (lo comprado ya está en los gastos de MEROE). */
export function plannedByCategory(items: FurnItem[]): Record<FurnCategory, number> {
  const out: Record<FurnCategory, number> = { muebles: 0, electro: 0, reforma: 0 }
  for (const i of items) out[i.category] = cents(out[i.category] + cost(i).planned)
  return out
}

/** Enlaces de tiendas de muebles, deco y electrodomésticos (para sugerirlo al compartir). */
export const isFurnitureLink = (url: string) =>
  /ikea\.|sklum\.|kavehome\.|maisonsdumonde\.|leroymerlin\.|zarahome\.|westwing\.|conforama\.|mediamarkt\.|laredoute\.|habitat\.|bauhaus\.|hm\.com\/[a-z_-]+\/home|elcorteingles\.es\/(hogar|electrodomesticos|muebles)|pccomponentes\.com\/(frigorifico|lavadora|lavavajillas|horno|microondas)/i.test(
    url,
  )

/** Qué necesidad suena a qué habitación ("sofá" → salón), para proponerla al guardar. */
export function guessRoom(text: string): RoomId {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/sofa|chaise|butaca|mesa (de )?(centro|baja)|mueble (de )?tv|televis|alfombra|estanteria|aparador/.test(t)) return 'salon'
  if (/cama|colchon|canape|cabecero|mesita|armario|comoda|edredon|sabana/.test(t)) return 'dormitorio'
  if (/nevera|frigorific|horno|microondas|lavavajillas|vitro|induccion|campana|cafetera|taburete|sarten|olla/.test(t)) return 'cocina'
  if (/bano|lavabo|espejo de bano|toalla|mampara|ducha|inodoro/.test(t)) return 'bano'
  if (/terraza|jardin|exterior|tumbona|maceta|toldo/.test(t)) return 'terraza'
  if (/recibidor|zapatero|perchero|entrada/.test(t)) return 'entrada'
  if (/escritorio|silla de oficina|monitor|estudio/.test(t)) return 'estudio'
  return 'otros'
}

/** Electrodomésticos al presupuesto de electrodomésticos; pintura u obra a reformas; el resto, muebles. */
export function guessCategory(text: string): FurnCategory {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (/nevera|frigorific|horno|microondas|lavavajillas|lavadora|secadora|vitro|induccion|campana|aspirador|televis|tv\b|aire acondicionado/.test(t)) return 'electro'
  if (/pintura|pintar|obra|reforma|suelo|tarima|azulejo|alicatado|instalacion/.test(t)) return 'reforma'
  return 'muebles'
}
