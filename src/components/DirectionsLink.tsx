import type { ReactNode } from 'react'
import { isAndroid, navigationHref } from '../lib/maps'
import type { PlaceInfo } from '../lib/types'

/** Botón "Ir": abre la app de Google Maps con la ruta y la navegación en marcha. */
export function DirectionsLink({ place, className, children }: { place: PlaceInfo; className: string; children: ReactNode }) {
  const android = isAndroid()
  return (
    <a
      href={navigationHref(place)}
      // En Android el enlace intent: abre la app de Maps sin salir de aquí; en el resto, pestaña nueva.
      {...(android ? {} : { target: '_blank', rel: 'noopener' })}
      aria-label={`Cómo llegar a ${place.name}`}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {children}
    </a>
  )
}
