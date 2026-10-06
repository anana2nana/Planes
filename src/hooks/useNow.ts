import { useSyncExternalStore } from 'react'

// Un único reloj compartido para todas las cuentas atrás:
// un solo setInterval aunque haya 50 tarjetas en pantalla.
let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/**
 * Hora actual que se actualiza sola.
 * `precision` (ms) controla cada cuánto re-renderiza el componente:
 * 1000 para cuentas atrás, 60_000 para agrupar listas, etc.
 */
export function useNow(precision = 1000): number {
  return useSyncExternalStore(subscribe, () => Math.floor(now / precision) * precision)
}
