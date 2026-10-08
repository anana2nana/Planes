import { useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { logout } from '../hooks/useAuth'
import { PRIORITY_ORDER, SWATCHES } from '../lib/colors'
import { PEOPLE } from '../lib/people'
import { deleteTag, savePriority, saveTag } from '../services/plans'
import type { PersonId, Plan, PriorityConfig, PriorityId, Tag } from '../lib/types'
import { Avatar } from './Avatar'
import { ColorPicker } from './ColorPicker'
import { LogoutIcon, PlusIcon, TrashIcon } from './Icons'
import { NotificationsSection } from './NotificationsSection'
import { ErrorBoundary } from './ErrorBoundary'
import { CalendarSection } from './CalendarSection'
import { saveBirthday, saveCoupleSince, useCouple } from '../hooks/useCouple'
import { BirthdayInput } from './BirthdayInput'
import { daysTogether } from '../lib/couple'

interface Props {
  user: User
  me: PersonId
  tags: Tag[]
  plans: Plan[]
  priorities: PriorityConfig
  onError: (msg: string) => void
}

export function SettingsView({ user, me, tags, plans, priorities, onError }: Props) {
  const [openColor, setOpenColor] = useState<string | null>(null)
  const fail = (e: Error) => onError(e.message)

  return (
    <div className="space-y-8">
      <Section title="Notificaciones" hint="Cada uno las suyas">
        <ErrorBoundary inline>
          <NotificationsSection me={me} onError={onError} />
        </ErrorBoundary>
      </Section>

      <Section title="Nosotros">
        <CoupleRow onError={onError} />
        <BirthdayRow person="nita" onError={onError} />
        <BirthdayRow person="kitos" onError={onError} />
      </Section>

      <Section title="Google Calendar" hint="Ver la agenda allí">
        <CalendarSection me={me} onError={onError} />
      </Section>

      <Section title="Prioridades" hint="Toca el color para cambiarlo">
        {PRIORITY_ORDER.map((id) => (
          <PriorityRow
            key={`${id}:${priorities[id].label}`}
            id={id}
            level={priorities[id]}
            open={openColor === `p:${id}`}
            onToggle={() => setOpenColor(openColor === `p:${id}` ? null : `p:${id}`)}
            onSave={(lvl) => savePriority(id, lvl).catch(fail)}
          />
        ))}
      </Section>

      <Section title="Etiquetas" hint={`${tags.length} creadas`}>
        {tags.length === 0 && <p className="px-4 py-3 text-sm text-muted">Aún no hay etiquetas. ¡Crea la primera!</p>}
        {tags.map((t) => (
          <TagRow
            key={`${t.id}:${t.name}`}
            tag={t}
            uses={plans.filter((p) => p.tagIds.includes(t.id)).length}
            open={openColor === `t:${t.id}`}
            onToggle={() => setOpenColor(openColor === `t:${t.id}` ? null : `t:${t.id}`)}
            onSave={(patch) => saveTag({ ...t, ...patch }).committed.catch(fail)}
            onDelete={() => deleteTag(t.id, plans).catch(fail)}
          />
        ))}
        <NewTagRow onCreate={(name, color) => saveTag({ name, color }).committed.catch(fail)} />
      </Section>

      <Section title="Cuenta">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar mode={me} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{PEOPLE[me].name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold active:scale-95">
            <LogoutIcon className="size-4" /> Salir
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">{children}</div>
    </section>
  )
}

function Swatch({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="size-9 shrink-0 rounded-full shadow-inner ring-4 ring-white transition active:scale-90"
      style={{ background: color, boxShadow: `0 0 0 1px ${color}40` }}
      aria-label="Cambiar color"
    />
  )
}

function PriorityRow({
  id,
  level,
  open,
  onToggle,
  onSave,
}: {
  id: PriorityId
  level: PriorityConfig[PriorityId]
  open: boolean
  onToggle: () => void
  onSave: (lvl: PriorityConfig[PriorityId]) => void
}) {
  const [label, setLabel] = useState(level.label)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Swatch color={level.color} onClick={onToggle} />
        <input
          value={label}
          maxLength={20}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== level.label && onSave({ ...level, label: label.trim() })}
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
          aria-label={`Nombre de la prioridad ${id}`}
        />
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${level.color}1f`, color: level.color }}>
          {label || level.label}
        </span>
      </div>
      {open && (
        <div className="mt-3 animate-fade-in">
          <ColorPicker value={level.color} onChange={(color) => onSave({ ...level, color })} />
        </div>
      )}
    </div>
  )
}

function TagRow({
  tag,
  uses,
  open,
  onToggle,
  onSave,
  onDelete,
}: {
  tag: Tag
  uses: number
  open: boolean
  onToggle: () => void
  onSave: (patch: Partial<Tag>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(tag.name)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Swatch color={tag.color} onClick={onToggle} />
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== tag.name && onSave({ name })}
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none"
          aria-label="Nombre de la etiqueta"
        />
        <span className="text-xs text-muted">{uses}</span>
        {confirm ? (
          <button onClick={onDelete} className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white">
            Borrar
          </button>
        ) : (
          <button onClick={() => setConfirm(true)} className="grid size-8 place-items-center rounded-full text-stone-400 active:bg-stone-100" aria-label="Borrar etiqueta">
            <TrashIcon className="size-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 animate-fade-in">
          <ColorPicker value={tag.color} onChange={(color) => onSave({ color })} />
        </div>
      )}
    </div>
  )
}

function NewTagRow({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[4])
  const [open, setOpen] = useState(false)
  const submit = () => {
    if (!name.trim()) return
    onCreate(name, color)
    setName('')
    setColor(SWATCHES[Math.floor(Math.random() * SWATCHES.length)])
  }
  return (
    <div className="px-4 py-3">
      <form
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Swatch color={color} onClick={() => setOpen((v) => !v)} />
        <input
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva etiqueta…"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-medium placeholder:text-stone-300"
        />
        <button type="submit" disabled={!name.trim()} className="grid size-8 place-items-center rounded-full bg-ink text-cream disabled:opacity-20" aria-label="Crear etiqueta">
          <PlusIcon className="size-4" />
        </button>
      </form>
      {open && (
        <div className="mt-3 animate-fade-in">
          <ColorPicker value={color} onChange={setColor} />
        </div>
      )}
    </div>
  )
}

function CoupleRow({ onError }: { onError: (msg: string) => void }) {
  const { since } = useCouple()
  return (
    <label className="flex items-center gap-3 px-4 py-3">
      <span className="text-2xl" aria-hidden>
        💞
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Juntos desde</span>
        <span className="text-xs text-muted">
          {since ? `${daysTogether(since).toLocaleString('es-ES', { useGrouping: 'always' })} días · os felicitaremos en el aniversario` : 'Para el contador y felicitaros los días especiales'}
        </span>
      </span>
      <input
        type="date"
        value={since ?? ''}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => saveCoupleSince(e.target.value || null).catch((err: Error) => onError(err.message))}
        aria-label="Juntos desde"
        className="h-10 shrink-0 rounded-xl border border-stone-200 bg-surface px-2 text-sm font-semibold outline-none focus:border-both"
      />
    </label>
  )
}

function BirthdayRow({ person, onError }: { person: PersonId; onError: (msg: string) => void }) {
  const { birthdays } = useCouple()
  return (
    <div className="flex items-center gap-3 border-t border-stone-100 px-4 py-3">
      <Avatar mode={person} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Cumple de {PEOPLE[person].name}</span>
        <span className="text-xs text-muted">Para avisar de los regalos</span>
      </span>
      <BirthdayInput value={birthdays[person]} onChange={(v) => saveBirthday(person, v).catch((e: Error) => onError(e.message))} label={`Cumple de ${PEOPLE[person].name}`} />
    </div>
  )
}
