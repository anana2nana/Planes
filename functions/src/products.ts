// Leer nombre, foto y precio de la página de un producto de cualquier tienda (Sklum, Kave Home, IKEA…).
// No hay API: se usa lo que las tiendas ponen en la página para que se vea bien al compartir
// (Open Graph, datos estructurados schema.org). Puro y testeado.

export interface ProductInfo {
  title: string
  image: string
  /** € (o null si la página no lo dice). */
  price: number | null
  store: string
}

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .trim()

/** "1.299,00" / "1299.00" / "1,299.00" / 899 → número. */
export function parsePrice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
  if (typeof v !== 'string') return null
  let s = v.replace(/[^\d.,]/g, '')
  if (!s) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (hasComma) s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/** "www.kavehome.com" → "Kave Home" (las conocidas) o el dominio sin www. */
export function storeName(url: string): string {
  let host = ''
  try {
    host = new URL(url).hostname.replace(/^www\d?\./, '').replace(/^m\./, '')
  } catch {
    return ''
  }
  const KNOWN: [RegExp, string][] = [
    [/ikea\./, 'IKEA'],
    [/sklum\./, 'Sklum'],
    [/kavehome\./, 'Kave Home'],
    [/maisonsdumonde\./, 'Maisons du Monde'],
    [/leroymerlin\./, 'Leroy Merlin'],
    [/zarahome\./, 'Zara Home'],
    [/westwing\./, 'Westwing'],
    [/conforama\./, 'Conforama'],
    [/elcorteingles\./, 'El Corte Inglés'],
    [/mediamarkt\./, 'MediaMarkt'],
    [/amazon\./, 'Amazon'],
    [/laredoute\./, 'La Redoute'],
    [/habitat\./, 'Habitat'],
    [/hm\.com/, 'H&M Home'],
    [/bauhaus\./, 'Bauhaus'],
    [/carrefour\./, 'Carrefour'],
    [/pccomponentes\./, 'PcComponentes'],
    [/wallapop\./, 'Wallapop'],
  ]
  return KNOWN.find(([re]) => re.test(host))?.[1] ?? host
}

const meta = (html: string, key: string) => {
  const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${key}["']`, 'i')
  return (html.match(re1) ?? html.match(re2))?.[1]
}

/** Lo que se pueda sacar de la página: JSON-LD Product primero, luego Open Graph y microdatos. */
export function parseProductPage(html: string, url: string): ProductInfo {
  let title = ''
  let image = ''
  let price: number | null = null

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(m[1].trim())
    } catch {
      continue
    }
    const walk = (n: unknown): boolean => {
      if (Array.isArray(n)) return n.some(walk)
      if (!n || typeof n !== 'object') return false
      const x = n as Record<string, any>
      const type = x['@type']
      if ((type === 'Product' || (Array.isArray(type) && type.includes('Product'))) && typeof x.name === 'string') {
        title ||= decode(x.name)
        const img = Array.isArray(x.image) ? x.image[0] : x.image
        image ||= typeof img === 'string' ? img : typeof img?.url === 'string' ? img.url : ''
        const offers = Array.isArray(x.offers) ? x.offers[0] : x.offers
        price ??= parsePrice(offers?.price ?? offers?.lowPrice ?? offers?.priceSpecification?.price)
        return true
      }
      return Object.values(x).some(walk)
    }
    if (walk(data)) break
  }

  title ||= decode(meta(html, 'og:title') ?? meta(html, 'twitter:title') ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '')
  image ||= decode(meta(html, 'og:image') ?? meta(html, 'twitter:image') ?? '')
  price ??= parsePrice(meta(html, 'product:price:amount') ?? meta(html, 'og:price:amount') ?? meta(html, 'price') ?? html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i)?.[1])

  const store = storeName(url)
  // Quitar el nombre de la tienda del título ("Sofá Dyna | Kave Home").
  title = title
    .replace(/\s*[|–—-]\s*(IKEA|Sklum|Kave ?Home|Maisons du Monde|Leroy Merlin|Zara Home|Westwing|Conforama|El Corte Ingl[ée]s|Amazon\.es|MediaMarkt)[^|–—-]*$/i, '')
    .trim()
    .slice(0, 120)
  if (image.startsWith('//')) image = `https:${image}`
  else if (image.startsWith('/')) {
    try {
      image = new URL(image, url).toString()
    } catch {
      image = ''
    }
  }
  return { title, image, price, store }
}

/** ¿Ha bajado el precio lo bastante para avisar? (al menos 1 € y 1 %). */
export const priceDropped = (before: number | null, now: number | null) => before !== null && now !== null && now <= before - 1 && now <= before * 0.99
