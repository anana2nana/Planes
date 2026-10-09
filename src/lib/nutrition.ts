// Nutrición aproximada: calorías y un color por plato (ligero · normal · contundente).
// No pretende contar al gramo: estima a partir de los ingredientes y se puede corregir a mano.
// Puro y testeado (tests/nutrition.test.ts).

import { splitQty, type IngItem } from './recipe.ts'

export type DishColor = 'green' | 'yellow' | 'red'

export const COLORS: Record<DishColor, { label: string; emoji: string; hint: string }> = {
  green: { label: 'Ligero', emoji: '🟢', hint: 'Mucha verdura o legumbre, poca grasa' },
  yellow: { label: 'Normal', emoji: '🟡', hint: 'Un plato completo de los de siempre' },
  red: { label: 'Contundente', emoji: '🔴', hint: 'Mucha energía, grasa o embutido: mejor de vez en cuando' },
}
export const COLOR_ORDER: DishColor[] = ['green', 'yellow', 'red']

/** Lo que se corrige a mano en una receta (o en un plato suelto del menú). */
export interface NutritionOverride {
  color: DishColor | null
  kcal: number | null
}
export const noOverride = (): NutritionOverride => ({ color: null, kcal: null })

// ─── Tabla de alimentos (por 100 g, aproximada) ─────────────────────────────

/** veg = verdura/fruta · leg = legumbre · carb = hidratos · prot = proteína · dairy = lácteo · fat = grasa · proc = embutido, nata, dulce… · misc = especias, caldos, salsas */
type Cat = 'veg' | 'leg' | 'carb' | 'prot' | 'dairy' | 'fat' | 'proc' | 'misc'
interface Food {
  aliases: string[]
  kcal: number
  p: number
  c: number
  f: number
  cat: Cat
  /** Gramos de una unidad ("2 tomates"). */
  unit?: number
  /** g/ml (aceite 0,92). */
  density?: number
}

// alias|alias, kcal, proteína, hidratos, grasa, categoría, peso por unidad
type Row = [string, number, number, number, number, Cat, number?]
const ROWS: Row[] = [
  // Carne, pescado, huevos
  ['pechuga de pollo|pechuga|pechugas de pollo|solomillo de pollo|solomillos de pollo|filete de pollo', 110, 23, 0, 1.5, 'prot', 200],
  ['pollo|pollo entero|alitas|alitas de pollo', 190, 19, 0, 12, 'prot', 1200],
  ['muslo de pollo|muslos de pollo|contramuslo|contramuslos|jamoncitos', 180, 18, 0, 12, 'prot', 120],
  ['pavo|pechuga de pavo', 105, 24, 0, 1, 'prot', 150],
  ['ternera|carne de ternera|filete de ternera|aguja de ternera|morcillo|carne para guisar|carne de vaca|vaca|entrecot|solomillo de ternera', 140, 21, 0, 6, 'prot', 150],
  ['carne picada|picada|carne picada mixta|carne picada de ternera', 230, 18, 0, 17, 'prot'],
  ['cerdo|lomo|lomo de cerdo|cinta de lomo|solomillo de cerdo|solomillo|filete de cerdo', 140, 21, 0, 6, 'prot', 150],
  ['costilla|costillas|costillas de cerdo|secreto|presa|pluma|carrillada|carrilleras', 280, 17, 0, 23, 'prot', 150],
  ['cordero|paletilla|chuletas de cordero', 250, 17, 0, 20, 'prot', 150],
  ['conejo', 135, 21, 0, 5.5, 'prot', 1200],
  ['hamburguesa|hamburguesas|burger', 240, 17, 2, 18, 'proc', 120],
  ['albondigas', 230, 15, 6, 16, 'prot', 30],
  ['salchicha|salchichas|frankfurt', 280, 12, 2, 25, 'proc', 50],
  ['chorizo|morcilla|salchichon|sobrasada|fuet|longaniza', 450, 24, 2, 38, 'proc', 80],
  ['jamon|jamon serrano|taquitos de jamon|tacos de jamon|jamon iberico|lacon', 240, 30, 0, 13, 'proc', 15],
  ['jamon cocido|jamon york|york|fiambre de pavo', 110, 18, 1, 3, 'prot', 15],
  ['bacon|beicon|panceta|tocino|guanciale|papada', 450, 13, 1, 44, 'proc', 15],
  ['huevo|huevos|huevo campero|huevos camperos', 145, 12.5, 0.7, 10, 'prot', 55],
  ['clara|claras|claras de huevo', 52, 11, 0.7, 0.2, 'prot', 33],
  ['yema|yemas', 320, 16, 3.6, 27, 'prot', 17],
  ['salmon|salmon ahumado', 200, 20, 0, 13, 'prot', 150],
  ['merluza|bacalao|rape|lenguado|pescadilla|abadejo|panga|pescado blanco|filete de merluza|lomos de bacalao', 80, 17, 0, 1, 'prot', 150],
  ['dorada|lubina|trucha|caballa|bonito|pez espada|emperador', 140, 20, 0, 6.5, 'prot', 150],
  ['atun|atun en aceite|lata de atun|latas de atun', 200, 25, 0, 11, 'prot', 60],
  ['atun al natural|atun fresco', 110, 25, 0, 1, 'prot', 60],
  ['sardina|sardinas|boquerones|anchoas', 180, 20, 0, 11, 'prot', 30],
  ['gambas|langostinos|gamba|langostino|camarones|mariscos', 90, 19, 0, 1.5, 'prot', 15],
  ['calamar|calamares|sepia|pulpo|chipirones|mejillones|almejas|berberechos', 80, 15, 2, 1.5, 'prot', 30],
  ['surimi|palitos de cangrejo|gulas', 100, 8, 15, 1, 'proc', 15],
  ['tofu', 120, 12, 2, 7, 'prot', 200],
  ['seitan', 120, 24, 4, 2, 'prot'],
  ['tempeh', 190, 19, 9, 11, 'prot'],
  ['soja texturizada', 330, 50, 30, 1, 'leg'],

  // Lácteos
  ['leche|leche entera|leche semidesnatada', 50, 3.3, 4.8, 1.6, 'dairy'],
  ['leche desnatada', 35, 3.4, 5, 0.1, 'dairy'],
  ['bebida de avena|leche de avena|bebida de soja|leche de soja|bebida vegetal|bebida de almendras', 45, 1.5, 6.5, 1.5, 'dairy'],
  ['yogur|yogures|yogur natural|kefir', 60, 3.5, 4.7, 3, 'dairy', 125],
  ['yogur griego', 120, 4, 4, 10, 'dairy', 125],
  ['queso|queso curado|queso semicurado|cheddar|emmental|gouda|manchego|gruyere|queso en lonchas', 370, 25, 1, 30, 'dairy', 20],
  ['queso fresco|queso de burgos|queso batido|skyr|requeson|ricotta|cottage', 120, 11, 3.5, 6.5, 'dairy', 250],
  ['mozzarella|burrata', 250, 18, 2, 19, 'dairy', 125],
  ['parmesano|queso parmesano|grana padano|pecorino|queso rallado', 400, 33, 1, 29, 'dairy'],
  ['queso crema|philadelphia|mascarpone|queso de untar|queso azul|gorgonzola|roquefort|brie|camembert', 300, 8, 3, 29, 'proc'],
  ['feta|queso feta|queso de cabra|rulo de cabra', 290, 17, 2, 24, 'dairy', 100],
  ['nata|nata liquida|nata para montar|crema de leche', 340, 2, 3, 35, 'proc'],
  ['nata para cocinar|nata ligera', 195, 2.5, 4, 18, 'proc'],
  ['mantequilla|margarina|ghee', 740, 0.6, 0.6, 82, 'fat'],
  ['leche de coco', 200, 2, 3, 21, 'fat', 400],

  // Grasas y frutos secos
  ['aceite|aceite de oliva|aove|aceite de oliva virgen extra|aceite de girasol|aceite de coco|aceite de sesamo', 884, 0, 0, 100, 'fat'],
  ['nueces|nuez|almendras|avellanas|anacardos|pistachos|cacahuetes|pipas|pinones|frutos secos|semillas|semillas de chia|chia|sesamo|lino', 600, 20, 12, 52, 'fat', 5],
  ['crema de cacahuete|mantequilla de cacahuete|tahini|tahin|crema de almendras', 600, 22, 18, 50, 'fat'],
  ['aguacate|aguacates', 160, 2, 8.5, 15, 'fat', 150],
  ['aceitunas|aceituna|olivas', 140, 1, 4, 14, 'fat', 4],
  ['mayonesa|alioli|salsa cesar|salsa tartara', 680, 1, 1, 75, 'proc'],
  ['pesto', 450, 5, 5, 45, 'fat'],

  // Hidratos
  ['pasta|espaguetis|spaghetti|macarrones|tallarines|fideos|fideua|penne|fusilli|rigatoni|lazos|tiburones|linguine|tagliatelle|placas de lasana|lasana|canelones|noodles|fideos de arroz|ramen|orzo', 355, 12, 72, 1.5, 'carb'],
  ['pasta fresca|tortellini|ravioli|gnocchi|noquis', 250, 9, 42, 5, 'carb'],
  ['arroz|arroz bomba|arroz basmati|arroz redondo|arroz largo|arroz jazmin|arroz para sushi|arroz integral', 350, 7, 78, 0.8, 'carb'],
  ['pan|barra de pan|pan de pueblo|pan integral|rebanada de pan|rebanadas de pan|pan de hamburguesa|panes de hamburguesa|pan de pita|pan pita|baguette|chapata|bollo', 260, 9, 50, 3, 'carb', 60],
  ['pan de molde|pan de molde integral', 265, 8, 48, 4, 'carb', 28],
  ['pan rallado|panko', 380, 12, 72, 5, 'carb'],
  ['picos|regana|reganas|tostas|biscotes|crackers', 420, 11, 70, 10, 'carb', 10],
  ['tortilla de trigo|tortillas de trigo|tortillas mexicanas|wrap|wraps|tortillas de maiz|fajitas', 300, 8, 50, 7, 'carb', 60],
  ['harina|harina de trigo|harina de fuerza|harina integral|harina de reposteria|harina de garbanzo', 350, 10, 73, 1.5, 'carb'],
  ['maicena|harina de maiz|fecula', 380, 0.3, 91, 0, 'carb'],
  ['patata|patatas|papas|patatas nuevas|patata agria', 77, 2, 17, 0.1, 'carb', 200],
  ['boniato|boniatos|batata|batatas', 86, 1.6, 20, 0.1, 'carb', 250],
  ['cuscus|bulgur', 360, 13, 72, 1.5, 'carb'],
  ['quinoa', 370, 14, 64, 6, 'carb'],
  ['avena|copos de avena|harina de avena', 380, 13, 60, 7, 'carb'],
  ['masa de pizza|base de pizza|masa de empanada|obleas|obleas de empanadilla', 280, 8, 50, 5, 'carb', 250],
  ['hojaldre|masa de hojaldre|masa quebrada|masa brisa|lamina de hojaldre', 520, 6, 40, 36, 'proc', 230],
  ['patatas fritas|patatas chips|nachos|totopos', 530, 6, 52, 33, 'proc'],

  // Legumbres (secas salvo que digan cocidas o de bote)
  ['garbanzo|garbanzos|alubia|alubias|judias blancas|judion|judiones|frijoles|alubias rojas|alubias pintas|lentejas|lenteja|lentejas pardinas|lentejas rojas|habas secas|azukis', 340, 21, 58, 2.5, 'leg'],
  ['garbanzos cocidos|garbanzos de bote|bote de garbanzos|alubias cocidas|alubias de bote|bote de alubias|lentejas cocidas|lentejas de bote|bote de lentejas|frijoles cocidos|legumbre cocida', 120, 7.5, 19, 1.5, 'leg', 400],
  ['hummus|humus', 170, 8, 14, 10, 'leg'],
  ['guisantes|habas|habitas|edamame', 85, 6, 13, 1, 'leg'],

  // Verdura y fruta
  ['tomate|tomates|tomate pera|tomates cherry|tomate cherry|cherrys|tomate rama', 18, 0.9, 3.9, 0.2, 'veg', 120],
  ['tomate triturado|tomate natural triturado|tomate rallado|tomate en conserva|tomates pelados|passata', 30, 1.3, 5, 0.2, 'veg', 400],
  ['tomate frito|salsa de tomate', 75, 1.5, 9, 3.7, 'misc', 400],
  ['tomate concentrado|concentrado de tomate|tomates secos', 90, 4.5, 18, 0.5, 'veg'],
  ['cebolla|cebollas|cebolla morada|cebolla dulce|chalota|chalotas|cebolleta|cebolletas|cebolla tierna|cebollino', 40, 1.1, 9, 0.1, 'veg', 150],
  ['puerro|puerros', 60, 1.5, 14, 0.3, 'veg', 150],
  ['pimiento|pimientos|pimiento rojo|pimiento verde|pimiento amarillo|pimiento italiano|pimientos de padron|pimientos del piquillo', 25, 1, 5, 0.3, 'veg', 150],
  ['calabacin|calabacines', 17, 1.2, 3, 0.3, 'veg', 250],
  ['berenjena|berenjenas', 25, 1, 6, 0.2, 'veg', 300],
  ['zanahoria|zanahorias', 41, 0.9, 10, 0.2, 'veg', 80],
  ['espinacas|espinaca|acelgas|acelga|kale|berza|grelos', 23, 2.8, 3.6, 0.4, 'veg', 300],
  ['brocoli|brocolis|coliflor|romanesco|coles de bruselas|col|repollo|lombarda|col lombarda|pak choi', 30, 2.5, 6, 0.3, 'veg', 400],
  ['champinon|champinones|setas|seta|boletus|shiitake|portobello|hongos', 22, 3, 3, 0.3, 'veg', 20],
  ['lechuga|lechugas|canonigos|rucula|escarola|brotes|brotes tiernos|ensalada|mezclum|cogollo|cogollos|endibia|endibias|hojas verdes', 15, 1.4, 2.9, 0.2, 'veg', 250],
  ['pepino|pepinos|apio|rabanos|rabano', 15, 0.7, 3, 0.1, 'veg', 200],
  ['judias verdes|judia verde|vainas', 31, 1.8, 7, 0.2, 'veg'],
  ['alcachofa|alcachofas', 47, 3, 11, 0.2, 'veg', 120],
  ['esparragos|esparrago|esparragos verdes|trigueros', 20, 2.2, 3.9, 0.1, 'veg', 20],
  ['calabaza', 26, 1, 6.5, 0.1, 'veg', 1000],
  ['remolacha', 43, 1.6, 10, 0.2, 'veg', 100],
  ['maiz|maiz dulce|mazorca', 90, 3, 19, 1.2, 'veg', 150],
  ['limon|limones|lima|limas|zumo de limon|zumo de lima|ralladura de limon', 29, 1.1, 9, 0.3, 'veg', 100],
  ['naranja|naranjas|mandarina|mandarinas|zumo de naranja|pomelo', 47, 0.9, 12, 0.1, 'veg', 200],
  ['manzana|manzanas|pera|peras|melocoton|nectarina|ciruela|ciruelas|kiwi|kiwis|melon|sandia|pina|fruta', 52, 0.4, 13, 0.2, 'veg', 180],
  ['platano|platanos|banana', 89, 1.1, 23, 0.3, 'veg', 120],
  ['fresas|fresa|frutos rojos|arandanos|frambuesas|moras|uvas|cerezas|mango|granada|higos', 55, 0.8, 13, 0.3, 'veg', 15],
  ['pasas|datiles|orejones|ciruelas pasas|higos secos', 290, 2.5, 70, 0.5, 'proc', 8],

  // Dulce
  ['azucar|azucar moreno|azucar glas|panela|sirope|sirope de agave|miel', 390, 0, 98, 0, 'proc'],
  ['chocolate|chocolate negro|chocolate con leche|pepitas de chocolate|nocilla|nutella', 540, 6, 50, 33, 'proc', 10],
  ['cacao|cacao en polvo|cacao puro', 230, 20, 58, 14, 'misc'],
  ['mermelada|confitura|dulce de leche|leche condensada', 300, 2, 65, 3, 'proc'],
  ['galletas|galleta|bizcocho|magdalenas|croissant|bolleria', 450, 7, 65, 18, 'proc', 10],
  ['helado', 210, 3.5, 24, 11, 'proc'],

  // Salsas, caldos y especias (casi nada)
  ['salsa de soja|soja|tamari|salsa teriyaki|salsa de ostras|salsa hoisin', 70, 6, 10, 0.5, 'misc'],
  ['ketchup|salsa barbacoa|salsa bbq|salsa agridulce|salsa chili dulce', 120, 1, 28, 0.2, 'proc'],
  ['mostaza|sriracha|tabasco|salsa picante|harissa|pasta de curry|curry rojo|curry verde|miso|gochujang', 60, 3, 6, 3, 'misc'],
  ['caldo|caldo de pollo|caldo de verduras|caldo de pescado|fumet|pastilla de caldo|agua|hielo', 5, 0.5, 0.5, 0.2, 'misc'],
  ['vino|vino blanco|vino tinto|cerveza|brandy|cognac|cava|jerez|vermut|licor', 80, 0.1, 3, 0, 'misc'],
  ['vinagre|vinagre de modena|vinagre balsamico|reduccion de modena|levadura|levadura quimica|impulsor|bicarbonato|gelatina|agar agar|esencia de vainilla|vainilla|extracto de vainilla|sal|sal en escamas|escamas de sal|pimienta|pimienta negra|pimenton|pimenton dulce|pimenton picante|comino|oregano|curry|curcuma|canela|tomillo|romero|perejil|cilantro|albahaca|laurel|hoja de laurel|nuez moscada|jengibre|guindilla|guindillas|cayena|eneldo|hierbas provenzales|especias|ajo en polvo|cebolla en polvo|menta|hierbabuena|azafran|colorante|clavo|clavos|anis|cardamomo|garam masala|ras el hanout|zaatar|sesamo negro|cebollino picado|ajo|ajos|dientes de ajo|ajo picado', 0, 0, 0, 0, 'misc', 5],
]

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ')
    .trim()

const FOODS: Food[] = ROWS.map(([a, kcal, p, c, f, cat, unit]) => ({ aliases: a.split('|').map(norm), kcal, p, c, f, cat, unit, density: cat === 'fat' && /aceite/.test(a) ? 0.92 : 1 }))

/** Alias de más largo a más corto: "garbanzos cocidos" gana a "garbanzos", "pechuga de pollo" a "pollo". */
const INDEX = FOODS.flatMap((food) => food.aliases.map((a) => ({ alias: a, food, re: new RegExp(`(?:^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?(?![a-z])`) }))).sort((x, y) => y.alias.length - x.alias.length)

/** El alimento de un nombre de ingrediente, o null si no lo conozco. */
export function findFood(name: string): Food | null {
  const n = norm(name.replace(/\(.*?\)/g, ' ').split(/[,;]/)[0])
  // Lo que va tras "o" es una alternativa ("mantequilla o aceite"): manda lo primero.
  const first = n.split(/\s+o\s+/)[0]
  for (const s of first === n ? [n] : [first, n]) {
    let best: { pos: number; len: number; food: Food } | null = null
    for (const { alias, food, re } of INDEX) {
      const m = s.match(re)
      if (!m || m.index === undefined) continue
      // El más largo; si empatan, el que sale antes ("tomate con atún" → tomate).
      if (!best || alias.length > best.len || (alias.length === best.len && m.index < best.pos)) best = { pos: m.index, len: alias.length, food }
      if (best && alias.length < best.len) break
    }
    if (best) return best.food
  }
  return null
}

// ─── Cantidades → gramos ────────────────────────────────────────────────────

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 }
const WORD_NUM: Record<string, number> = { un: 1, una: 1, uno: 1, unos: 2, unas: 2, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, ocho: 8, diez: 10 }
const toNum = (s: string) => {
  if (s in FRACTIONS) return FRACTIONS[s]
  if (s.includes('/')) {
    const [a, b] = s.split('/').map((x) => Number(x.trim()))
    return b ? a / b : NaN
  }
  return Number(s.replace(',', '.'))
}

/** Gramos (o ml) que vale una unidad de medida; `null` = cuenta de piezas. */
const UNIT_G: [RegExp, number | null][] = [
  [/^(kg|kilos?)$/, 1000],
  [/^(g|gr|grs|gramos?)$/, 1],
  [/^mg$/, 0.001],
  [/^(l|litros?)$/, 1000],
  [/^ml$/, 1],
  [/^cl$/, 10],
  [/^dl$/, 100],
  [/^(cdas?|cucharadas?|cuchara)$/, 15],
  [/^(cdtas?|cdta|cucharaditas?)$/, 5],
  [/^tazas?$/, 240],
  [/^(vasos?|briks?)$/, 200],
  [/^(vasitos?|tacitas?|cucharon)$/, 100],
  [/^pizcas?$/, 0.5],
  [/^(chorritos?|chorros?)$/, 10],
  [/^punados?$/, 30],
  [/^dientes?$/, 5],
  [/^(ramas?|ramitas?|hojas?)$/, 1],
  [/^(latas?)$/, 250],
  [/^(botes?|tarros?)$/, 400],
  [/^sobres?$/, 10],
  [/^paquetes?$/, 400],
  [/^(rodajas?|lonchas?|lonchitas?)$/, 20],
  [/^filetes?$/, 130],
  [/^trozos?$/, 50],
  [/^(nuez|nueces)$/, 10],
  [/^cabezas?$/, 40],
  [/^tiras?$/, 15],
  [/^tarrinas?$/, 200],
  [/^(manojos?|bolsas?)$/, 150],
  [/^(unidades?|uds?|piezas?)$/, null],
]

/** Si no pone cantidad: lo típico por ración según el tipo de alimento. */
const TYPICAL: Record<Cat, number> = { veg: 80, leg: 60, carb: 80, prot: 130, dairy: 30, fat: 8, proc: 25, misc: 0 }

/**
 * Gramos de una línea de ingrediente. `perServing` indica que el valor ya es por ración
 * (cuando no hay cantidad, se supone lo típico de una ración).
 */
export function gramsOf(item: IngItem, food: Food): { grams: number; perServing: boolean } {
  let q = norm(item.q)
  let name = norm(item.name)
  // "Una cebolla", "medio limón": la cantidad va en palabras.
  if (!q) {
    const w = name.match(/^(un|una|uno|unos|unas|medio|media|dos|tres|cuatro|cinco|seis|ocho|diez)\s+(.*)$/)
    if (w) {
      q = String(WORD_NUM[w[1]])
      name = w[2]
    }
  }
  if (!q || /al gusto|a mano|c\/n/.test(q)) return { grams: /al gusto|a mano/.test(q) || food.cat === 'misc' ? 0 : TYPICAL[food.cat], perServing: true }
  const nums = [...q.matchAll(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾/g)].map((m) => toNum(m[0])).filter((n) => Number.isFinite(n))
  const n = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 1
  const unitWord = q
    .replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|¼|¾/g, ' ')
    .replace(/\b(a|-|–)\b/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .pop()
    ?.replace(/\.$/, '')
  // La unidad puede venir pegada al nombre ("2 dientes de ajo" → q "2", name "dientes de ajo").
  const unitInName = name.match(/^(\p{L}+)\s+de\s/u)?.[1]
  const word = unitWord || unitInName
  const rule = word ? UNIT_G.find(([re]) => re.test(word)) : undefined
  if (rule && rule[1] !== null) {
    const ml = /^(l|litros?|ml|cl|dl|cdas?|cucharadas?|cuchara|cdtas?|cdta|cucharaditas?|tazas?|vasos?|briks?|vasitos?|tacitas?|cucharon|chorritos?|chorros?)$/.test(word!)
    return { grams: n * rule[1] * (ml ? (food.density ?? 1) : 1), perServing: false }
  }
  return { grams: n * (food.unit ?? TYPICAL[food.cat] * 1.5), perServing: false }
}

// ─── Estimación de un plato ─────────────────────────────────────────────────

export interface Estimate {
  /** Por ración. */
  kcal: number
  protein: number
  carbs: number
  fat: number
  color: DishColor | null
  /** Ingredientes reconocidos / total (sin contar sal, agua…). */
  matched: number
  total: number
  /** Los que no he sabido reconocer. */
  unknown: string[]
  /** Hay datos suficientes para fiarse un poco. */
  confident: boolean
}

export interface EstimateInput {
  title?: string
  servings: number | null
  groups?: { items: IngItem[] }[]
  ingredients?: string[]
  steps?: string
}

const FRY = /\bfre[ií]r\b|\bfrit[oa]s?\b|rebozad|empanad[oa]s?\b|tempura|\bfritura/i

export function estimateRecipe(r: EstimateInput): Estimate {
  const items: IngItem[] = r.groups?.some((g) => g.items.length) ? r.groups.flatMap((g) => g.items) : (r.ingredients ?? []).map(splitQty)
  const servings = r.servings && r.servings > 0 ? r.servings : 2
  let kcal = 0
  let p = 0
  let c = 0
  let f = 0
  const grams: Record<Cat, number> = { veg: 0, leg: 0, carb: 0, prot: 0, dairy: 0, fat: 0, proc: 0, misc: 0 }
  let matched = 0
  let total = 0
  const unknown: string[] = []
  for (const it of items) {
    if (!it.name.trim()) continue
    const food = findFood(it.name)
    if (!food) {
      total++
      unknown.push(it.name)
      continue
    }
    if (food.cat === 'misc' && food.kcal < 10) continue // sal, especias, agua: ni suman ni restan
    total++
    matched++
    const g = gramsOf(it, food)
    // "Aceite para freír": no se come todo; cuenta lo que absorbe (abajo).
    if (food.cat === 'fat' && /fre[ií]r/i.test(it.name)) continue
    const per = g.perServing ? g.grams : g.grams / servings
    kcal += (food.kcal * per) / 100
    p += (food.p * per) / 100
    c += (food.c * per) / 100
    f += (food.f * per) / 100
    grams[food.cat] += per
  }
  // Lo frito absorbe aceite aunque no lo pongan en la lista.
  if (FRY.test(`${r.title ?? ''}\n${items.map((i) => i.name).join('\n')}\n${r.steps ?? ''}`)) {
    kcal += 110
    f += 12
    grams.fat += 12
  }
  const confident = total > 0 && matched / total >= 0.6 && kcal >= 120
  return { kcal: Math.round(kcal), protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f), color: total && kcal >= 60 ? colorOf(kcal, f, grams) : null, matched, total, unknown, confident }
}

/** El color: por calorías, un punto más si va cargado de grasa o embutido, uno menos si manda la verdura o la legumbre. */
function colorOf(kcal: number, fat: number, g: Record<Cat, number>): DishColor {
  const solid = g.veg + g.leg + g.carb + g.prot + g.dairy + g.fat + g.proc || 1
  let level = kcal < 500 ? 0 : kcal <= 800 ? 1 : 2
  if (kcal >= 400 && (fat * 9) / kcal > 0.5) level++
  if (g.proc / solid >= 0.1) level++
  // La verdura aligera, pero no convierte en ligero un plato de muchas calorías.
  if (kcal <= 700 && (g.veg + g.leg) / solid >= 0.45) level--
  return COLOR_ORDER[Math.max(0, Math.min(2, level))]
}

// ─── Plato del menú y resumen de la semana ─────────────────────────────────

export interface DishNutrition {
  color: DishColor | null
  kcal: number | null
  /** De dónde sale: corregido a mano o calculado. */
  manual: boolean
}

/** El color y las calorías de un plato: lo corregido manda sobre lo calculado. */
export function dishNutrition(meal: { color?: DishColor | null; title?: string }, recipe?: (EstimateInput & { nutrition?: NutritionOverride }) | null): DishNutrition {
  const est = recipe ? estimateRecipe(recipe) : null
  const auto = est && est.total > 0 ? est : null
  const color = meal.color ?? recipe?.nutrition?.color ?? auto?.color ?? guessFromTitle(meal.title ?? recipe?.title ?? '')
  const kcal = recipe?.nutrition?.kcal ?? (auto?.confident ? auto.kcal : null)
  return { color, kcal, manual: !!(meal.color || recipe?.nutrition?.color) }
}

export type Verdict = 'light' | 'balanced' | 'heavy'
export interface WeekBalance {
  green: number
  yellow: number
  red: number
  unknown: number
  verdict: Verdict | null
  text: string
}

/** Cómo va la semana: cuenta colores y da un consejo corto. */
export function weekBalance(colors: (DishColor | null)[]): WeekBalance {
  const count = (c: DishColor) => colors.filter((x) => x === c).length
  const green = count('green')
  const yellow = count('yellow')
  const red = count('red')
  const known = green + yellow + red
  const unknown = colors.length - known
  if (known < 3) return { green, yellow, red, unknown, verdict: null, text: known ? 'Aún pocos platos para saber cómo va la semana' : 'Sin platos con color todavía' }
  if (red >= 3 || (red >= 2 && red > green)) return { green, yellow, red, unknown, verdict: 'heavy', text: 'Semana contundente: toca algo más ligero 🥗' }
  if (green * 2 >= known && red <= 1) return { green, yellow, red, unknown, verdict: 'light', text: 'Semana ligera, ¡bien! 🌿' }
  return { green, yellow, red, unknown, verdict: 'balanced', text: 'Semana equilibrada 👌' }
}

/** Platos sin receta: una pista por el nombre ("ensalada" → ligero, "pizza" → contundente). */
const TITLE_RED = /pizza|hamburguesa|burger|\bfrit[oa]s?\b|rebozad|empanad[oa]s?\b|lasa[nñ]a|carbonara|cachopo|kebab|\bcocido\b|fabada|callos|croquetas|nachos|perritos?|chulet[oó]n|torreznos|bravas|churros|tarta|fondue|raclette|barbacoa|torrijas|san jacobo|flamenquines?|sushi frito|alitas/i
const TITLE_GREEN = /ensalada|\bcrema de|pur[eé] de|verduras?|\bsopa\b|a la plancha|al vapor|al horno con verduras|gazpacho|salmorejo|\bwok\b|poke|hervid|menestra|pisto|br[oó]coli|calabac[ií]n|espinacas|jud[ií]as verdes|merluza|lubina|dorada|bacalao|pescado|lentejas|garbanzos con espinacas|caldo|consom[eé]|tortilla francesa|revuelto de/i
export function guessFromTitle(title: string): DishColor | null {
  if (TITLE_RED.test(title)) return 'red'
  if (TITLE_GREEN.test(title)) return 'green'
  return null
}
