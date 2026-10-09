import { useProfilePhotos } from '../hooks/useProfiles'
import { PEOPLE } from '../lib/people'
import type { AssignMode } from '../lib/types'

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-2xl',
}

export function Avatar({ mode, size = 'sm', className = '' }: { mode: AssignMode; size?: keyof typeof SIZES; className?: string }) {
  const photos = useProfilePhotos()
  const p = PEOPLE[mode]
  const photo = mode === 'nita' || mode === 'kitos' ? photos[mode] : null
  if (photo)
    return <img src={photo} alt={p.name} title={p.name} className={`inline-block shrink-0 rounded-full object-cover ${SIZES[size]} ${className}`} />
  // "Los dos": las dos fotos juntas, si hay.
  if (mode === 'both' && photos.nita && photos.kitos)
    return (
      <span title={p.name} className={`relative inline-block shrink-0 overflow-hidden rounded-full ${SIZES[size]} ${className}`}>
        <img src={photos.nita} alt="" className="absolute inset-y-0 left-0 h-full w-1/2 object-cover" />
        <img src={photos.kitos} alt="" className="absolute inset-y-0 right-0 h-full w-1/2 object-cover" />
      </span>
    )
  return (
    <span title={p.name} className={`inline-grid shrink-0 place-items-center rounded-full font-bold tracking-tight text-white ${p.solid} ${SIZES[size]} ${className}`}>
      {p.initials}
    </span>
  )
}
