// "Compartir con Nitakitos": entender lo que llega desde otra app (Google Maps, una tienda, una lista…).

export type ShareTarget = 'idea' | 'gift' | 'shopping' | 'note' | 'plan'

export interface Shared {
  /** Nombre o título principal (sin enlaces). */
  name: string
  /** Segunda línea (en Google Maps, normalmente la dirección). */
  detail: string
  /** El primer enlace que venga, si viene alguno. */
  link: string
  /** Todas las líneas de texto sin enlaces (para la lista de la compra). */
  lines: string[]
  isMaps: boolean
  /** Adónde parece que va mejor. */
  suggested: ShareTarget
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi
const MAPS_RE = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i
const SHOP_RE = /(amazon\.|zara\.|etsy\.|aliexpress\.|elcorteingles\.|ikea\.|decathlon\.|fnac\.|pccomponentes\.|shein\.|mango\.|nike\.|adidas\.|wallapop\.|vinted\.|casadellibro\.|sephora\.|primor\.|hm\.com|pullandbear\.|bershka\.|stradivarius\.|massimodutti\.|uniqlo\.|lego\.)/i

const clean = (s: string) => s.replace(/^["'«“\s]+|["'»”\s]+$/g, '').trim()

export function parseShared(p: { title?: string | null; text?: string | null; url?: string | null }): Shared {
  const all = [p.title ?? '', p.text ?? '', p.url ?? ''].join('\n')
  const link = (p.url && /^https?:\/\//i.test(p.url) ? p.url : all.match(URL_RE)?.[0]) ?? ''
  const textLines = (p.text ?? '')
    .replace(URL_RE, '')
    .split(/\r?\n/)
    .map((l) => clean(l).replace(/^([-•*·]|\d+[.)])\s*/, ''))
    .filter(Boolean)
  const title = clean((p.title ?? '').replace(URL_RE, ''))
  const lines = title && !textLines.includes(title) ? [title, ...textLines] : textLines
  const isMaps = MAPS_RE.test(link)
  const name = lines[0] ?? ''
  const detail = lines[1] ?? ''

  let suggested: ShareTarget = 'idea'
  if (link && SHOP_RE.test(link)) suggested = 'gift'
  else if (!link && lines.length >= 2 && lines.every((l) => l.length <= 40)) suggested = 'shopping'
  else if (!link && name.length > 60) suggested = 'note'

  return { name: name.slice(0, 120), detail, link, lines, isMaps, suggested }
}
