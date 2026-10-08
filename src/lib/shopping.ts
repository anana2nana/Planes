export type SectionId = 'super' | 'fresco' | 'casa' | 'farmacia' | 'gata' | 'otros'

export const SECTIONS: Record<SectionId, { label: string; emoji: string }> = {
  super: { label: 'Súper', emoji: '🛒' },
  fresco: { label: 'Fresco', emoji: '🥦' },
  casa: { label: 'Limpieza y casa', emoji: '🧽' },
  farmacia: { label: 'Farmacia', emoji: '💊' },
  gata: { label: 'Gata', emoji: '🐱' },
  otros: { label: 'Otros', emoji: '📦' },
}
export const SECTION_ORDER: SectionId[] = ['super', 'fresco', 'casa', 'farmacia', 'gata', 'otros']

export interface ShoppingItem {
  id: string
  name: string
  section: SectionId
  done: boolean
  addedBy: 'nita' | 'kitos' | null
  createdAt: number
  doneAt: number | null
}

/** Lo que soléis comprar (para las sugerencias): veces y última sección usada. */
export interface Frequent {
  key: string
  name: string
  section: SectionId
  n: number
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
