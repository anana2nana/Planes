import { PEOPLE } from '../lib/people'
import type { AssignMode } from '../lib/types'

const SIZES = {
  xs: 'size-5 text-[9px]',
  sm: 'size-7 text-[11px]',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
}

export function Avatar({ mode, size = 'sm', className = '' }: { mode: AssignMode; size?: keyof typeof SIZES; className?: string }) {
  const p = PEOPLE[mode]
  return (
    <span
      title={p.name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold tracking-tight text-white ${p.solid} ${SIZES[size]} ${className}`}
    >
      {p.initials}
    </span>
  )
}
