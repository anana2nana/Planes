// Catálogos de Mercadona y Ahorramás para la lista de la compra.
// Ninguno tiene una API oficial: se lee lo mismo que ve su web. Si cambian su web,
// estos lectores devuelven [] (la lista sigue funcionando, sin precios) y hay que ajustarlos.

export type Store = 'mercadona' | 'ahorramas'

export interface ShopProduct {
  store: Store
  id: string
  name: string
  /** Formato: "Brick 1 l", "Paquete 500 g"… */
  pack: string
  /** Precio del envase (€). */
  price: number
  /** Precio por kilo/litro: "0,94 €/L". */
  ref: string
  image: string
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : null
}
const euro = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 3 })

// ─── Mercadona (tienda.mercadona.es/api) ───────────────────────────────────

/** Ids de las subcategorías de /api/categories/ (que son las que llevan productos). */
export function mercadonaCategoryIds(json: unknown): number[] {
  const out: number[] = []
  const results = (json as { results?: unknown[] })?.results
  for (const top of Array.isArray(results) ? results : []) {
    const subs = (top as { categories?: unknown[] })?.categories
    for (const s of Array.isArray(subs) ? subs : []) {
      const id = num((s as { id?: unknown })?.id)
      if (id !== null) out.push(id)
    }
  }
  return out
}

/** Productos de una subcategoría (/api/categories/{id}/). Busca en todo el árbol, por si cambia de forma. */
export function parseMercadonaCategory(json: unknown): ShopProduct[] {
  const out: ShopProduct[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const x = node as Record<string, any>
    const pi = x.price_instructions ?? x
    if (typeof x.display_name === 'string' && x.id != null && num(pi?.unit_price) !== null) {
      const size = num(pi.unit_size)
      const fmt = typeof pi.size_format === 'string' ? pi.size_format : ''
      const pack = [typeof x.packaging === 'string' ? x.packaging : '', size !== null && fmt ? `${pi.approx_size ? '~' : ''}${qty(size)} ${fmt}` : ''].filter(Boolean).join(' ')
      const refPrice = num(pi.reference_price ?? pi.bulk_price)
      out.push({
        store: 'mercadona',
        id: String(x.id),
        name: x.display_name.trim(),
        pack,
        price: num(pi.unit_price)!,
        ref: refPrice !== null && pi.reference_format ? `${euro(refPrice)} €/${pi.reference_format}` : '',
        image: typeof x.thumbnail === 'string' ? x.thumbnail.split('?')[0] : '',
      })
      return
    }
    Object.values(x).forEach(walk)
  }
  walk(json)
  return out
}

// ─── Ahorramás (www.ahorramas.com, Salesforce Commerce Cloud) ──────────────

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
const clean = (s: string) =>
  decode(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
const priceIn = (s: string): number | null => {
  const m = s.match(/(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|&euro;|EUR)/) ?? s.match(/content=["'](\d{1,4}(?:\.\d{1,2})?)["']/)
  return m ? num(m[1]) : null
}
const unitName = (u: string) => (({ kilo: 'kg', litro: 'L', l: 'L', unidad: 'ud' }) as Record<string, string>)[u.toLowerCase()] ?? u.toLowerCase()
const absolute = (src: string) => (src.startsWith('//') ? `https:${src}` : src.startsWith('/') ? `https://www.ahorramas.com${src}` : src)

/** Productos de una página de búsqueda de Ahorramás: datos estructurados (JSON-LD) y, si no, las fichas del listado. */
export function parseAhorramas(html: string): ShopProduct[] {
  const out = new Map<string, ShopProduct>()
  const add = (p: Omit<ShopProduct, 'store'>) => {
    if (!p.id || !p.name || !(p.price > 0) || out.has(p.id)) return
    out.set(p.id, { store: 'ahorramas', ...p })
  }

  // 1) JSON-LD (schema.org Product / ItemList)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const walk = (n: unknown) => {
      if (Array.isArray(n)) return n.forEach(walk)
      if (!n || typeof n !== 'object') return
      const x = n as Record<string, any>
      if (x['@type'] === 'Product' && typeof x.name === 'string') {
        const offer = Array.isArray(x.offers) ? x.offers[0] : x.offers
        const price = num(offer?.price ?? offer?.lowPrice)
        const img = Array.isArray(x.image) ? x.image[0] : x.image
        if (price !== null) add({ id: String(x.sku ?? x.productID ?? x.url ?? x.name), name: decode(x.name).trim(), pack: '', price, ref: '', image: typeof img === 'string' ? absolute(img) : '' })
        return
      }
      Object.values(x).forEach(walk)
    }
    walk(data)
  }
  if (out.size) return [...out.values()]

  // 2) Fichas del listado: cada una empieza con data-pid="…"
  const parts = html.split(/(?=<[^>]+\sdata-pid=["'])/i).slice(1)
  for (const tile of parts) {
    const id = tile.match(/data-pid=["']([^"']+)["']/i)?.[1]
    if (!id) continue
    // Toda la ficha (hasta la siguiente), sin comentarios HTML (Ahorramás deja datos viejos comentados).
    const chunk = tile.slice(0, 40000).replace(/<!--[\s\S]*?-->/g, '')
    let name = ''
    let price: number | null = null
    // Datos de analítica: en Ahorramás, data-gtm-layer="%7B%22id%22…" (JSON codificado como URL); en otras, JSON con &quot;.
    for (const m of chunk.matchAll(/data-(?:gtm|product|impression)[\w-]*=["']([^"']+)["']/gi)) {
      let raw = decode(m[1])
      if (/^%7B/i.test(raw)) {
        try {
          raw = decodeURIComponent(raw)
        } catch {
          continue
        }
      }
      if (!raw.startsWith('{')) continue
      try {
        const g = JSON.parse(raw)
        const item = g?.ecommerce?.items?.[0] ?? g?.ecommerce?.click?.products?.[0] ?? g?.ecommerce?.impressions?.[0] ?? g?.items?.[0] ?? g
        if (!name && typeof (item?.item_name ?? item?.name) === 'string') name = (item.item_name ?? item.name).trim()
        if (price === null) price = num(item?.price)
      } catch {
        /* sigue con el HTML */
      }
    }
    if (!name) {
      const n =
        chunk.match(/<(a|h\d|div|span|p)\b[^>]*class=["'][^"']*(?:product-name|pdp-link|tile-name|product-tile__name|link-name)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)?.[2] ??
        chunk.match(/itemprop=["']name["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
        chunk.match(/<a[^>]+title=["']([^"']{3,})["']/i)?.[1] ??
        chunk.match(/<img[^>]+alt=["']([^"']{3,})["']/i)?.[1] ??
        ''
      name = clean(n)
    }
    if (price === null || !(price > 0)) {
      // El bloque del precio: desde class="price" hasta el precio por kilo/litro (que no es el del envase).
      const at = chunk.search(/class=["'][^"']*\b(?:price|sales|product-price)\b[^"']*["']/i)
      if (at >= 0) {
        let block = chunk.slice(at, at + 2500)
        const unitAt = block.search(/unit-price|precio-unidad|price-per-unit/i)
        if (unitAt > 0) block = block.slice(0, unitAt)
        price = priceIn(block) ?? num(block.match(/content=["'](\d{1,4}(?:\.\d{1,2})?)["']/)?.[1]) ?? num(clean(block).match(/(\d{1,4}[.,]\d{2})/)?.[1])
      }
    }
    const ref = chunk.match(/(\d{1,4}[.,]\d{2})\s*(?:€|&euro;)\s*\/\s*(kg|kilo|l|litro|ud|unidad|docena)\b/i)
    const pack = clean(chunk.match(/class=["'][^"']*(?:format|size|grammage|weight)[^"']*["'][^>]*>([^<]{1,40})</i)?.[1] ?? '')
    const img =
      chunk.match(/<img[^>]+class=["'][^"']*tile-image[^"']*["'][^>]*?\s(?:data-src|src)=["']([^"']+)["']/i)?.[1] ??
      chunk.match(/<img[^>]+(?:data-src|src)=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i)?.[1] ??
      ''
    if (price !== null && price > 0)
      add({ id, name, pack: /\d/.test(pack) && !/€/.test(pack) ? pack : '', price, ref: ref ? `${euro(num(ref[1])!)} €/${unitName(ref[2])}` : '', image: img ? absolute(decode(img)) : '' })
  }
  return [...out.values()]
}

/** Para guardar el catálogo en pocos documentos: filas compactas en JSON. */
export const packRows = (list: ShopProduct[]) => JSON.stringify(list.map((p) => [p.id, p.name, p.pack, p.price, p.ref, p.image]))
