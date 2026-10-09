import type { ReactNode } from 'react'
import { ChevronIcon } from '../Icons'

/** Baldosa de una portada (Hogar, Bienestar, Nosotros…): icono, nombre y un resumen. */
export function Tile({ emoji, title, children, onClick, muted, wide }: { emoji: string; title: string; children?: ReactNode; onClick: () => void; muted?: boolean; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-32 flex-col rounded-3xl p-4 text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] transition active:scale-[0.98] ${muted ? 'bg-surface/60' : 'bg-surface'} ${wide ? 'col-span-2' : ''}`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="mt-2 flex items-center gap-1 font-extrabold">
        {title} <ChevronIcon className="size-3.5 text-stone-400" />
      </span>
      {children && <span className="mt-1 text-xs text-muted">{children}</span>}
    </button>
  )
}

/** Una baldosa de algo que aún no existe (para que se vea hacia dónde crece la app). */
export function SoonTile({ emoji, title, children }: { emoji: string; title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col rounded-3xl border-2 border-dashed border-stone-200 p-4 text-left">
      <span className="text-2xl opacity-60" aria-hidden>
        {emoji}
      </span>
      <span className="mt-2 font-extrabold text-muted">{title}</span>
      <span className="mt-1 text-xs text-muted">{children}</span>
    </div>
  )
}

export function AreaTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-1 px-1 text-xs font-bold uppercase tracking-wider text-muted">{children}</h2>
}
