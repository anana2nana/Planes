// Importar recetas desde un archivo HTML (en el navegador, con DOMParser).
// Entiende el formato de las recetas de Nita (tarjetas de ingredientes con .q,
// fases con pasos .step, señales .cue/.fix, "Técnica al detalle", temporizadores)
// y, si no, intenta con datos schema.org (JSON-LD) o con encabezados
// "Ingredientes" / "Preparación" y sus listas.

import { emptyStep, parseServings, splitQty, type IngGroup, type Phase, type RichRecipe, type Step, type Tip } from './recipe'

const txt = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const all = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll(sel))
const strip = (s: string, prefix: RegExp) => s.replace(prefix, '').trim()

function nitaFormat(doc: Document): Pick<RichRecipe, 'groups' | 'phases' | 'tips' | 'gear' | 'gearNote' | 'notes'> | null {
  const lists = all(doc, 'ul.ing')
  if (lists.length === 0 && all(doc, '.step').length === 0) return null
  const groups: IngGroup[] = lists.map((ul) => {
    const card = ul.closest('.card') ?? ul.parentElement
    return {
      name: txt(card?.querySelector('h3')),
      note: all(card ?? ul, '.note')
        .map(txt)
        .join(' '),
      items: all(ul, 'li').map((li) => {
        const q = li.querySelector('.q')
        if (!q) return splitQty(txt(li))
        const name = all(li, 'span')
          .filter((s) => s !== q && !s.classList.contains('q'))
          .map(txt)
          .join(' ')
        return { q: txt(q), name }
      }),
    }
  })
  const ingSection = lists[0]?.closest('section')
  const notes = ingSection
    ? all(ingSection, ':scope > p.note')
        .map(txt)
        .join('\n')
    : ''
  const gearCard = doc.querySelector('.gear')?.closest('.card')
  const phases: Phase[] = all(doc, '.phase').map((ph) => ({
    title: txt(ph.querySelector('h3')),
    why: txt(ph.querySelector('.why')),
    steps: all(ph, '.step').map(stepOf),
  }))
  // Pasos sueltos sin fases.
  if (phases.length === 0) {
    const steps = all(doc, '.step').map(stepOf)
    if (steps.length) phases.push({ title: '', why: '', steps })
  }
  const tips: Tip[] = all(doc, '.tips .card').map((c) => ({ title: txt(c.querySelector('h3')), text: all(c, 'p').map(txt).join('\n'), kind: c.classList.contains('warn') ? 'warn' : 'good' }))
  return {
    groups,
    notes,
    gear: all(doc, '.gear li').map(txt),
    gearNote: gearCard ? all(gearCard, '.note').map(txt).join(' ') : '',
    phases,
    tips,
  }
}

function stepOf(li: Element): Step {
  const body = li.querySelector('.body') ?? li
  const timerEl = body.querySelector('.timer[data-seconds]')
  return emptyStep({
    title: txt(body.querySelector('h4')),
    text: all(body, ':scope > p').map(txt).join('\n'),
    chips: all(body, '.kv span').map(txt),
    cue: strip(txt(body.querySelector('.cue')), /^señal de que va bien:\s*/i),
    fix: strip(txt(body.querySelector('.fix')), /^si no est[aá] bien:\s*/i),
    tech: all(body, 'details li').map(txt),
    timer: timerEl ? { seconds: Number(timerEl.getAttribute('data-seconds')) || 0, label: txt(timerEl) } : null,
  })
}

/** schema.org/Recipe en JSON-LD (webs de recetas). */
function jsonLd(doc: Document): Partial<RichRecipe> | null {
  for (const s of all(doc, 'script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent ?? '')
      const nodes: unknown[] = Array.isArray(data) ? data : data['@graph'] ?? [data]
      const r = nodes.find((n) => {
        const t = (n as { '@type'?: unknown })['@type']
        return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe'))
      }) as Record<string, unknown> | undefined
      if (!r) continue
      const instr = (x: unknown): Step[] => {
        if (typeof x === 'string') return [emptyStep({ text: x })]
        if (Array.isArray(x)) return x.flatMap(instr)
        const o = x as Record<string, unknown>
        if (o?.itemListElement) return instr(o.itemListElement)
        return o?.text ? [emptyStep({ title: typeof o.name === 'string' && o.name !== o.text ? o.name : '', text: String(o.text) })] : []
      }
      const ing = Array.isArray(r.recipeIngredient) ? (r.recipeIngredient as string[]) : []
      return {
        title: typeof r.name === 'string' ? r.name : '',
        description: typeof r.description === 'string' ? r.description : '',
        servings: parseServings([String(r.recipeYield ?? '')]) ?? (Number.parseInt(String(r.recipeYield ?? ''), 10) || null),
        groups: ing.length ? [{ name: '', note: '', items: ing.map(splitQty) }] : [],
        phases: [{ title: '', why: '', steps: instr(r.recipeInstructions) }],
      }
    } catch {
      /* JSON mal formado: seguimos */
    }
  }
  return null
}

/** Último recurso: listas bajo encabezados "Ingredientes" y "Preparación/Pasos". */
function byHeadings(doc: Document): Partial<RichRecipe> {
  const heads = all(doc, 'h1,h2,h3,h4,strong,b,p')
  const listAfter = (re: RegExp) => {
    const h = heads.find((x) => re.test(txt(x)) && txt(x).length < 40)
    if (!h) return []
    let el: Element | null = h.nextElementSibling ?? h.parentElement?.nextElementSibling ?? null
    for (let i = 0; el && i < 5; i++, el = el.nextElementSibling) {
      const list = el.matches('ul,ol') ? el : el.querySelector('ul,ol')
      if (list) return all(list, 'li').map(txt)
    }
    return []
  }
  const ing = listAfter(/^ingredientes/i)
  const steps = listAfter(/^(preparaci[oó]n|elaboraci[oó]n|pasos|paso a paso|instrucciones)/i)
  return {
    groups: ing.length ? [{ name: '', note: '', items: ing.map(splitQty) }] : [],
    phases: steps.length ? [{ title: '', why: '', steps: steps.map((t) => emptyStep({ text: t })) }] : [],
  }
}

export function parseRecipeHtml(html: string): RichRecipe {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const title = txt(doc.querySelector('h1')) || txt(doc.querySelector('title')) || 'Receta'
  const tags = all(doc, '.chips li').map(txt)
  const credit = doc.querySelector('.credit') ?? doc.querySelector('footer p')
  const link = (credit?.querySelector('a[href^="http"]') ?? doc.querySelector('footer a[href^="http"]')) as HTMLAnchorElement | null
  const base: RichRecipe = {
    title,
    description: txt(doc.querySelector('.lede')) || (doc.querySelector('meta[name="description"]')?.getAttribute('content') ?? '').trim(),
    tags,
    servings: parseServings([...tags, txt(doc.querySelector('.lede'))]),
    groups: [],
    notes: '',
    gear: [],
    gearNote: '',
    phases: [],
    tips: [],
    credit: txt(credit),
    url: link?.getAttribute('href') ?? '',
  }
  const nita = nitaFormat(doc)
  if (nita) return { ...base, ...nita }
  const ld = jsonLd(doc)
  if (ld) return { ...base, ...ld, title: ld.title || title, description: ld.description || base.description, servings: ld.servings ?? base.servings } as RichRecipe
  return { ...base, ...byHeadings(doc) } as RichRecipe
}

/** Elige un emoji según el título. */
export function guessEmoji(title: string): string {
  const t = title.toLowerCase()
  const map: [RegExp, string][] = [
    [/pasta|espagueti|tallar|fettucc|macarr|carbonara|boloñesa|lasaña|ñoqui|tagliat/, '🍝'],
    [/arroz|paella|risotto/, '🥘'],
    [/curry/, '🍛'],
    [/ensalada/, '🥗'],
    [/pollo/, '🍗'],
    [/pescado|merluza|salm[oó]n|bacalao|at[uú]n|dorada/, '🐟'],
    [/ternera|cerdo|carne|filete|solomillo|costilla/, '🥩'],
    [/huevo|tortilla/, '🍳'],
    [/pizza/, '🍕'],
    [/taco|burrito|fajita/, '🌮'],
    [/sopa|caldo|ramen|crema/, '🍜'],
    [/lenteja|garbanzo|alubia|jud[ií]a/, '🫘'],
    [/patata/, '🥔'],
    [/tarta|bizcocho|postre|galleta/, '🍰'],
  ]
  return map.find(([re]) => re.test(t))?.[1] ?? '🍲'
}
