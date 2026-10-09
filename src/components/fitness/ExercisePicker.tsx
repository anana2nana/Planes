import { useState } from 'react'
import { CATALOG, GROUPS, GROUP_ORDER, type MuscleGroup } from '../../lib/fitness'

/** Elegir un ejercicio: por grupo muscular, del catálogo o escrito a mano. */
export function ExercisePicker({ onPick, initialGroup = 'pecho', exclude = [] }: { onPick: (name: string, group: MuscleGroup) => void; initialGroup?: MuscleGroup; exclude?: string[] }) {
  const [group, setGroup] = useState<MuscleGroup>(initialGroup)
  const [custom, setCustom] = useState('')
  const taken = new Set(exclude.map((e) => e.toLowerCase()))
  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Grupo muscular">
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={group === g}
            onClick={() => setGroup(g)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${group === g ? 'bg-ink text-cream' : 'bg-stone-100'}`}
          >
            {GROUPS[g].emoji} {GROUPS[g].label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATALOG[group].map((name) => (
          <button
            key={name}
            type="button"
            disabled={taken.has(name.toLowerCase())}
            onClick={() => onPick(name, group)}
            className="rounded-xl bg-surface px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-stone-200 active:scale-95 disabled:opacity-40"
          >
            {name}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (custom.trim()) onPick(custom.trim(), group)
          setCustom('')
        }}
        className="flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={`Otro de ${GROUPS[group].label.toLowerCase()}…`}
          aria-label="Otro ejercicio"
          maxLength={60}
          className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
        />
        <button type="submit" disabled={!custom.trim()} className="rounded-xl bg-ink px-4 text-sm font-bold text-cream disabled:opacity-30">
          Añadir
        </button>
      </form>
    </div>
  )
}
