import { BBS_PEOPLE, heartsText, type BbsItem, type BbsPerson } from '../lib/bbs.ts'
import { BBS_COLORS, nameFor } from './people'

/** Quién quiere ir: las tres iniciales, encendidas las que tienen ❤️. */
export function Hearts({ item, me }: { item: BbsItem; me: BbsPerson }) {
  const text = heartsText(item, me)
  return (
    <span className="flex items-center gap-1.5" aria-label={text || 'Sin ❤️ todavía'}>
      <span className="flex -space-x-1">
        {BBS_PEOPLE.map((p) => (
          <span
            key={p}
            title={nameFor(p, me)}
            className={`grid size-5 place-items-center rounded-full text-[9px] font-extrabold ring-2 ring-surface ${item.hearts[p] ? `${BBS_COLORS[p].solid} text-white` : 'bg-stone-100 text-stone-400'}`}
          >
            {p === 'maria' ? 'M' : p === 'nita' ? 'N' : 'K'}
          </span>
        ))}
      </span>
      {text && <span className="text-[11px] font-semibold text-muted">{text}</span>}
    </span>
  )
}
