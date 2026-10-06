import type { PriorityConfig, PriorityId } from './types'

export const SWATCHES = [
  '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1',
  '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e',
  '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#78716c',
]

export const PRIORITY_ORDER: PriorityId[] = ['urgent', 'high', 'medium', 'low']

export const PRIORITY_WEIGHT: Record<PriorityId, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

export const DEFAULT_PRIORITIES: PriorityConfig = {
  urgent: { label: 'Urgente', color: '#ef4444' },
  high: { label: 'Alta', color: '#f97316' },
  medium: { label: 'Media', color: '#eab308' },
  low: { label: 'Baja', color: '#10b981' },
}

/** Fondo suave a partir de un color (hex + alfa). */
export function tint(hex: string, alpha = 0.14): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

/** Color de texto legible encima de `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#2a2233' : '#ffffff'
}

/** Oscurece un color para usarlo como texto sobre su propio tinte. */
export function deepen(hex: string, amount = 0.35): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.round(c * (1 - amount))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
