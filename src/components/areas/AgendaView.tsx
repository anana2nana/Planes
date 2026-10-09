import { useEffect, useState } from 'react'
import type { Kind, Plan, PersonId, PriorityConfig, Tag } from '../../lib/types'
import { CalendarView } from '../CalendarView'
import { PlansView } from '../PlansView'
import { useTimeline } from '../../hooks/useTimeline'
import { markCareDone, usePet } from '../../hooks/usePet'
import { DueChores } from '../upkeep/UpkeepView'
import type { TimelineItem } from '../../lib/timeline'

export type AgendaMode = 'calendario' | 'planes' | 'tareas'
const KEY = 'nitakitos.agenda.mode'
const read = (): AgendaMode => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'planes' || v === 'tareas' ? v : 'calendario'
  } catch {
    return 'calendario'
  }
}
/** Para abrir la Agenda directamente en un apartado (p. ej. "tareas atrasadas" desde Hoy). */
export function rememberAgendaMode(m: AgendaMode) {
  try {
    localStorage.setItem(KEY, m)
  } catch {
    /* sin almacenamiento */
  }
}
/** Qué crea el botón + en cada apartado. */
export const AGENDA_KIND: Record<AgendaMode, Kind> = { calendario: 'event', planes: 'plan', tareas: 'task' }

/** Agenda: el calendario con todo, y las listas de planes y de tareas. */
export function AgendaView({
  plans,
  me,
  tags,
  priorities,
  loading,
  onOpen,
  onToggle,
  onCreate,
  onMode,
  onGo,
  onToast,
}: {
  plans: Plan[]
  me: PersonId
  tags: Tag[]
  priorities: PriorityConfig
  loading: boolean
  onOpen: (p: Plan) => void
  onToggle: (p: Plan) => void
  onCreate: (date: string) => void
  onMode: (m: AgendaMode) => void
  onGo: (area: TimelineItem['area'], section: string) => void
  onToast: (m: string) => void
}) {
  const extra = useTimeline(me)
  const { profile, care } = usePet()
  const [mode, setModeState] = useState<AgendaMode>(read)
  useEffect(() => onMode(mode), [mode, onMode])
  const setMode = (m: AgendaMode) => {
    setModeState(m)
    rememberAgendaMode(m)
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 rounded-2xl bg-stone-200/60 p-1 text-[13px] font-bold" role="tablist" aria-label="Calendario, planes o tareas">
        {(
          [
            { v: 'calendario', label: '📅 Calendario' },
            { v: 'planes', label: '💞 Planes' },
            { v: 'tareas', label: '🧹 Tareas' },
          ] as const
        ).map((o) => (
          <button key={o.v} role="tab" aria-selected={mode === o.v} onClick={() => setMode(o.v)} className={`rounded-xl py-2 transition ${mode === o.v ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {o.label}
          </button>
        ))}
      </div>
      {mode === 'calendario' ? (
        <CalendarView plans={plans} me={me} tags={tags} priorities={priorities} onOpen={onOpen} onToggle={onToggle} onCreate={onCreate} extra={extra} onGo={onGo} />
      ) : (
        <>
          {mode === 'tareas' && <DueChores me={me} onError={onToast} petName={profile?.name ?? ''} petCare={care} onPetDone={(c, d) => markCareDone(c, d).catch((e: Error) => onToast(e.message))} />}
          <PlansView kind={mode === 'planes' ? 'plan' : 'task'} plans={plans} me={me} tags={tags} priorities={priorities} loading={loading} onOpen={onOpen} onToggle={onToggle} />
        </>
      )}
    </div>
  )
}
