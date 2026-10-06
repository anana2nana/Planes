import { useState } from 'react'
import { PRIORITY_ORDER, SWATCHES } from '../lib/colors'
import { PEOPLE, relativeLabel } from '../lib/people'
import { saveTag } from '../services/plans'
import type { AssignMode, PersonId, PriorityConfig, PriorityId, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { ColorPicker } from './ColorPicker'
import { CheckIcon, PlusIcon } from './Icons'
import { TagChip } from './TagChip'

// ─── Asignación ─────────────────────────────────────────────────────────────

const MODES: AssignMode[] = ['nita', 'kitos', 'both', 'duplicate']

export function AssigneePicker({
  value,
  onChange,
  me,
  allowDuplicate = true,
}: {
  value: AssignMode
  onChange: (m: AssignMode) => void
  me: PersonId
  allowDuplicate?: boolean
}) {
  const modes = allowDuplicate ? MODES : MODES.filter((m) => m !== 'duplicate')
  return (
    <div className={`grid gap-2 ${allowDuplicate ? 'grid-cols-4' : 'grid-cols-3'}`} role="radiogroup" aria-label="Asignar a">
      {modes.map((m) => {
        const p = PEOPLE[m]
        const active = value === m
        const sub = m === 'nita' || m === 'kitos' ? relativeLabel(m, me) : p.short
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${p.name} (${sub})`}
            onClick={() => onChange(m)}
            className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1 py-2.5 transition active:scale-95 ${
              active ? `${p.soft} border-current ${p.text}` : 'border-stone-100 bg-stone-50 text-muted'
            }`}
          >
            <Avatar mode={m} size="md" className={active ? '' : 'opacity-50 grayscale'} />
            <span className={`text-xs font-bold ${active ? '' : 'text-ink'}`}>{p.name}</span>
            <span className="-mt-1 text-[10px] font-medium opacity-80">{sub}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Prioridad ──────────────────────────────────────────────────────────────

export function PriorityPicker({ value, onChange, priorities }: { value: PriorityId; onChange: (p: PriorityId) => void; priorities: PriorityConfig }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Prioridad">
      {[...PRIORITY_ORDER].reverse().map((id) => {
        const p = priorities[id]
        const active = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className="flex items-center justify-center gap-1.5 truncate rounded-2xl px-2 py-2.5 text-sm font-bold transition active:scale-95"
            style={active ? { background: p.color, color: '#fff' } : { background: `${p.color}1a`, color: p.color }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────

export function TagPicker({ tags, value, onChange }: { tags: Tag[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[Math.floor(Math.random() * SWATCHES.length)])

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const create = () => {
    if (!name.trim()) return
    // Escritura optimista: Firestore genera el id al instante, sin esperar a la red.
    const { id, committed } = saveTag({ name, color })
    onChange([...value, id])
    committed.catch(console.error)
    setName('')
    setCreating(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const active = value.includes(t.id)
          return (
            <button key={t.id} type="button" onClick={() => toggle(t.id)} className="relative transition active:scale-95" aria-pressed={active}>
              <TagChip tag={t} size="md" active={active} />
              {active && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full text-white" style={{ background: t.color }}>
                  <CheckIcon className="size-2.5" />
                </span>
              )}
            </button>
          )
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-stone-200 px-3 py-1 text-sm font-semibold text-muted active:scale-95"
          >
            <PlusIcon className="size-3.5" /> Nueva
          </button>
        )}
      </div>

      {creating && (
        <div className="space-y-3 rounded-2xl bg-stone-50 p-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  create()
                }
              }}
              placeholder="Nombre de la etiqueta"
              className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 outline-none focus:border-both"
            />
            <button type="button" onClick={create} disabled={!name.trim()} className="rounded-xl px-4 font-bold text-white disabled:opacity-40" style={{ background: color }}>
              Crear
            </button>
          </div>
          <ColorPicker value={color} onChange={setColor} />
          <button type="button" onClick={() => setCreating(false)} className="text-sm font-semibold text-muted">
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
