import { deepen, tint } from '../lib/colors'
import type { Tag } from '../lib/types'

export function TagChip({ tag, size = 'sm', active = true }: { tag: Tag; size?: 'sm' | 'md'; active?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full font-semibold ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-sm'
      }`}
      style={
        active
          ? { background: tint(tag.color, 0.16), color: deepen(tag.color) }
          : { background: 'var(--color-stone-100)', color: 'var(--color-muted)' }
      }
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: active ? tag.color : '#d6d3d1' }} />
      <span className="truncate">{tag.name}</span>
    </span>
  )
}
