import { useCallback, useEffect, useRef } from 'react'

/**
 * Una capa a pantalla completa (o una hoja) que ocupa una entrada del historial,
 * para que el gesto "atrás" de Android la cierre a ella sola y no a lo de debajo.
 * Llama a `onClose` cuando el usuario vuelve atrás; `close()` hace lo mismo desde un botón.
 */
export function useLayer(name: string, onClose: () => void) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const pushed = useRef(false)

  useEffect(() => {
    if (!history.state?.[name]) {
      history.pushState({ ...(history.state ?? {}), [name]: true }, '')
      pushed.current = true
    }
    const onPop = () => {
      if (!history.state?.[name]) closeRef.current()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [name])

  return useCallback(() => {
    if (history.state?.[name]) history.back()
    else closeRef.current()
  }, [name])
}
