// Precios de la lista de la compra: catálogo de Mercadona (descargado) y Ahorramás (búsqueda), y el total.

export type Store = 'mercadona' | 'ahorramas'
export const STORES: Record<Store, { label: string; color: string }> = {
  mercadona: { label: 'Mercadona', color: 'bg-emerald-50 text-emerald-700' },
  ahorramas: { label: 'Ahorramás', color: 'bg-rose-50 text-rose-700' },
}

export interface Product {
  store: Store
  id: string
  name: string
  pack: string
  price: number
  /** "0,94 €/L" */
  ref: string
  image: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Filas compactas guardadas por el servidor → productos. */
export function unpackRows(json: string, store: Store): Product[] {
  try {
    const rows = JSON.parse(json) as unknown[]
    return rows
      .filter((r): r is [string, string, string, number, string, string] => Array.isArray(r) && typeof r[1] === 'string' && typeof r[3] === 'number')
      .map(([id, name, pack, price, ref, image]) => ({ store, id: String(id), name, pack: pack ?? '', price, ref: ref ?? '', image: image ?? '' }))
  } catch {
    return []
  }
}

/**
 * Buscar en un catálogo: tienen que estar todas las palabras (sin tildes ni mayúsculas; "huevo" encuentra "huevos").
 * Primero lo que empieza por lo buscado y los nombres más cortos (lo más básico).
 */
export function searchCatalog(list: Product[], q: string, max = 40): Product[] {
  const words = norm(q)
    .split(' ')
    .filter((w) => w.length > 1)
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w))
  if (!words.length) return []
  const scored: { p: Product; score: number }[] = []
  for (const p of list) {
    const n = norm(p.name)
    if (!words.every((w) => n.includes(w))) continue
    let score = n.length
    if (n.startsWith(words[0])) score -= 40
    if (words.every((w) => new RegExp(`(^| )${w}`).test(n))) score -= 20
    scored.push({ p, score })
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map((x) => x.p)
}

/** Total de lo que queda por comprar (precio × cantidad) y cuántas cosas tienen precio. */
export function shoppingTotal(items: { price?: number | null; qty?: number; done: boolean }[]) {
  const pending = items.filter((i) => !i.done)
  const priced = pending.filter((i) => typeof i.price === 'number' && i.price > 0)
  const total = Math.round(priced.reduce((s, i) => s + i.price! * Math.max(1, i.qty ?? 1), 0) * 100) / 100
  return { total, priced: priced.length, count: pending.length }
}

export const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)

/** "1,25" o "1.25" → 1.25 (o null). */
export function parsePrice(s: string): number | null {
  const n = Number(s.replace('€', '').trim().replace(',', '.'))
  return s.trim() && Number.isFinite(n) && n >= 0 && n < 10000 ? Math.round(n * 100) / 100 : null
}

/** Miniatura pequeña (las de Mercadona se piden ya recortadas). */
export const thumb = (url: string) => (url.includes('imgix.net') ? `${url.split('?')[0]}?fit=crop&h=96&w=96` : url)
