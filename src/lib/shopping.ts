import type { Product } from './prices.ts'

export type SectionId = 'super' | 'fresco' | 'deco' | 'farmacia' | 'gata' | 'otros'

export const SECTIONS: Record<SectionId, { label: string; emoji: string }> = {
  super: { label: 'Súper', emoji: '🛒' },
  fresco: { label: 'Fresco', emoji: '🥦' },
  deco: { label: 'Mobiliario y decoración', emoji: '🛋️' },
  farmacia: { label: 'Farmacia', emoji: '💊' },
  gata: { label: 'Gata', emoji: '🐱' },
  otros: { label: 'Otros', emoji: '📦' },
}
export const SECTION_ORDER: SectionId[] = ['super', 'fresco', 'deco', 'farmacia', 'gata', 'otros']

export interface ShoppingItem {
  id: string
  name: string
  section: SectionId
  done: boolean
  addedBy: 'nita' | 'kitos' | null
  createdAt: number
  doneAt: number | null
  /** Precio de una unidad (€), a mano o del catálogo. */
  price: number | null
  /** Cuántas (para el total). */
  qty: number
  /** Producto elegido en Mercadona o Ahorramás. */
  product: Product | null
}

/** Lo que soléis comprar (para las sugerencias): veces y última sección usada. */
export interface Frequent {
  key: string
  name: string
  section: SectionId
  n: number
  /** Último precio y producto (se ponen solos la próxima vez). */
  price: number | null
  product: Product | null
}

/** "Leche  semidesnatada " y "leche semidesnatada" son lo mismo (sin mayúsculas, tildes ni espacios de más). */
export function itemKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export const capitalizeFirst = (s: string) => {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
