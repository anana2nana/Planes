import { useCallback, useEffect, useState } from 'react'

/**
 * Estado de una hoja/formulario que se cierra con el gesto "atrás" de Android:
 * al abrirla se añade una entrada al historial (conservando el resto del estado,
 * p. ej. en qué espacio de Casa estamos) y el "atrás" la quita.
 */
export function useSheetState<T>() {
  const [value, setValue] = useState<T | null>(null)

  useEffect(() => {
    const onPop = () => {
      if (!history.state?.sheet) setValue(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((v: T) => {
    if (!history.state?.sheet) history.pushState({ ...(history.state ?? {}), sheet: true }, '')
    setValue(v)
  }, [])

  const close = useCallback(() => {
    if (history.state?.sheet) history.back()
    else setValue(null)
  }, [])

  return [value, open, close] as const
}
