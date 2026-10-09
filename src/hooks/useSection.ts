import { useCallback, useEffect, useState } from 'react'

/**
 * Espacio abierto dentro de un área (Hogar → La gata, Nosotros → Diario…). Cada espacio
 * ocupa una entrada del historial: el "atrás" de Android vuelve a la portada del área.
 * `key` es el nombre del área en `history.state` (p. ej. 'hogar').
 */
export function useSection<T extends string>(key: string) {
  const read = () => (history.state?.[key] as T | undefined) ?? null
  const [section, setSection] = useState<T | null>(read)
  useEffect(() => {
    const onPop = () => setSection((history.state?.[key] as T | undefined) ?? null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [key])
  const open = useCallback(
    (s: T) => {
      history.pushState({ [key]: s }, '')
      setSection(s)
      window.scrollTo({ top: 0 })
    },
    [key],
  )
  return [section, open] as const
}

/** Las claves de área que se usan en el historial (para limpiarlas al cambiar de pestaña). */
export const AREA_KEYS = ['hogar', 'bienestar', 'nosotros', 'casa'] as const
