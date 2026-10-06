import { useState, type ReactNode } from 'react'
import { PEOPLE } from '../lib/people'
import { dateToDraft, formatDue } from '../lib/time'
import { DAY_NAME, DAY_SHORT, WEEK_ORDER, describeRepeat, firstOccurrence, nextOccurrence, type Weekday } from '../lib/recurrence'
import { createPlan, deletePlans, updatePlan } from '../services/plans'
import type { Plan, PersonId, PlanDraft, PriorityConfig, Tag } from '../lib/types'
import { BottomSheet } from './BottomSheet'
import { CalendarIcon, CopyIcon, FlagIcon, NoteIcon, RepeatIcon, TagIcon, TrashIcon, UsersIcon } from './Icons'
import { AssigneePicker, PriorityPicker, TagPicker } from './Pickers'

interface Props {
  plan: Plan | null
  /** Fecha (yyyy-mm-dd) para un plan nuevo, p. ej. al crearlo desde el calendario. */
  defaultDate?: string
  siblings: Plan[]
  me: PersonId
  tags: Tag[]
  priorities: PriorityConfig
  onClose: () => void
  onError: (msg: string) => void
}

function initialDraft(plan: Plan | null, defaultDate?: string): PlanDraft {
  if (!plan) {
    return { title: '', notes: '', mode: 'both', dueDate: defaultDate ?? '', dueTime: '', priority: 'medium', tagIds: [], repeatDays: [] }
  }
  return {
    title: plan.title,
    notes: plan.notes,
    mode: plan.assignee,
    ...dateToDraft(plan.dueAt?.toDate() ?? null, plan.allDay),
    priority: plan.priority,
    tagIds: plan.tagIds,
    repeatDays: plan.repeatDays ?? [],
  }
}

const iso = (d: Date) => dateToDraft(d, true).dueDate

function quickDates() {
  const today = new Date()
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const daysToSat = (6 - today.getDay() + 7) % 7 || 7
  const saturday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToSat)
  const nextWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)
  return [
    { label: 'Hoy', value: iso(today) },
    { label: 'Mañana', value: iso(tomorrow) },
    { label: 'Finde', value: iso(saturday) },
    { label: '+1 semana', value: iso(nextWeek) },
  ]
}

export function PlanForm({ plan, defaultDate, siblings, me, tags, priorities, onClose, onError }: Props) {
  const [draft, setDraft] = useState<PlanDraft>(() => initialDraft(plan, defaultDate))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const isEdit = !!plan
  const isDuplicated = !!plan?.groupId
  const canSave = draft.title.trim().length > 0

  // Las escrituras no se esperan: Firestore las aplica en local al instante
  // (también sin conexión) y las sincroniza en segundo plano.
  const save = () => {
    if (!canSave) return
    const op = plan ? updatePlan(plan, draft, siblings) : createPlan(draft, me)
    op.catch((e: Error) => onError(`No se pudo guardar: ${e.message}`))
    onClose()
  }

  const remove = (ids: string[]) => {
    deletePlans(ids).catch((e: Error) => onError(`No se pudo borrar: ${e.message}`))
    onClose()
  }

  const footer = (
    <div className="flex gap-2">
      {isEdit && (
        <button
          type="button"
          onClick={() => setConfirmDelete((v) => !v)}
          className="grid size-13 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600 active:scale-95"
          aria-label="Borrar"
        >
          <TrashIcon className="size-5" />
        </button>
      )}
      <button
        type="submit"
        form="plan-form"
        disabled={!canSave}
        className="h-13 flex-1 rounded-2xl bg-ink text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-30"
      >
        {isEdit ? 'Guardar cambios' : draft.mode === 'duplicate' ? 'Crear para los dos' : 'Crear plan'}
      </button>
    </div>
  )

  return (
    <BottomSheet open onClose={onClose} title={isEdit ? 'Editar plan' : 'Nuevo plan'} footer={footer}>
      <form
        id="plan-form"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="space-y-6"
      >
        {confirmDelete && plan && (
          <div className="animate-fade-in space-y-2 rounded-2xl bg-rose-50 p-3">
            <p className="text-sm font-semibold text-rose-700">¿Seguro que quieres borrarlo?</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => remove([plan.id])} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">
                {isDuplicated ? 'Solo esta copia' : 'Sí, borrar'}
              </button>
              {isDuplicated && siblings.length > 0 && (
                <button
                  type="button"
                  onClick={() => remove([plan.id, ...siblings.map((s) => s.id)])}
                  className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
                >
                  Borrar las dos copias
                </button>
              )}
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <input
          autoFocus={!isEdit}
          value={draft.title}
          maxLength={200}
          onChange={(e) => set('title', e.target.value)}
          placeholder="¿Qué plan tenemos?"
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />

        <Field icon={<UsersIcon className="size-4" />} label="Para quién">
          {isDuplicated ? (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm">
              <CopyIcon className="size-5 shrink-0 text-amber-600" />
              <p className="text-amber-800">
                Tarea duplicada · esta es la copia de <b>{PEOPLE[plan!.assignee].name}</b>. Los cambios se aplican a las dos
                copias; cada uno la completa por su cuenta.
              </p>
            </div>
          ) : (
            <>
              <AssigneePicker value={draft.mode} onChange={(m) => set('mode', m)} me={me} />
              {draft.mode === 'duplicate' && (
                <p className="mt-2 text-xs text-muted">Se crearán dos tareas iguales, una para cada uno, que completaréis por separado.</p>
              )}
            </>
          )}
        </Field>

        <Field icon={<CalendarIcon className="size-4" />} label="Fecha tope">
          <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
            {quickDates().map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => set('dueDate', q.value)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${
                  draft.dueDate === q.value ? 'bg-ink text-white' : 'bg-stone-100 text-ink'
                }`}
              >
                {q.label}
              </button>
            ))}
            {draft.dueDate && (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, dueDate: '', dueTime: '' }))}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted"
              >
                Sin fecha
              </button>
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className="h-12 min-w-0 rounded-2xl border border-stone-200 bg-white px-3 font-semibold outline-none focus:border-both"
            />
            <input
              type="time"
              value={draft.dueTime}
              disabled={!draft.dueDate}
              onChange={(e) => set('dueTime', e.target.value)}
              className="h-12 w-32 rounded-2xl border border-stone-200 bg-white px-3 font-semibold outline-none focus:border-both disabled:opacity-40"
            />
          </div>
          {draft.dueDate && !draft.dueTime && <p className="mt-1.5 text-xs text-muted">Sin hora: vence al final del día.</p>}
        </Field>

        <Field icon={<RepeatIcon className="size-4" />} label="Repetir">
          <RepeatPicker
            days={draft.repeatDays}
            dueDate={draft.dueDate}
            dueTime={draft.dueTime}
            onChange={(days) =>
              setDraft((d) => {
                // Si se repite y aún no tiene fecha, empieza el primer día que toque.
                const first = days.length && !d.dueDate ? firstOccurrence(days) : null
                return { ...d, repeatDays: days, dueDate: first ? dateToDraft(first, true).dueDate : d.dueDate }
              })
            }
          />
        </Field>

        <Field icon={<FlagIcon className="size-4" />} label="Prioridad">
          <PriorityPicker value={draft.priority} onChange={(p) => set('priority', p)} priorities={priorities} />
        </Field>

        <Field icon={<TagIcon className="size-4" />} label="Etiquetas">
          <TagPicker tags={tags} value={draft.tagIds} onChange={(ids) => set('tagIds', ids)} />
        </Field>

        <Field icon={<NoteIcon className="size-4" />} label="Notas">
          <textarea
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder="Dirección, enlaces, lo que haga falta…"
            className="w-full resize-none rounded-2xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-both"
          />
        </Field>
      </form>
    </BottomSheet>
  )
}

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'No se repite', days: [] },
  { label: 'Todos los días', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Entre semana', days: [1, 2, 3, 4, 5] },
  { label: 'Fines de semana', days: [0, 6] },
]

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d))

function RepeatPicker({ days, dueDate, dueTime, onChange }: { days: number[]; dueDate: string; dueTime: string; onChange: (d: number[]) => void }) {
  const toggle = (d: number) => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])
  const due = dueDate ? new Date(`${dueDate}T${dueTime || '23:59'}`) : null
  const next = due && days.length ? nextOccurrence(due, days, due) : null
  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.days)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${
              sameDays(days, p.days) ? 'bg-ink text-white' : 'bg-stone-100 text-ink'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Días que se repite">
        {WEEK_ORDER.map((d: Weekday) => {
          const active = days.includes(d)
          return (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-pressed={active}
              aria-label={DAY_NAME[d]}
              className={`grid aspect-square place-items-center rounded-full text-sm font-bold transition active:scale-90 ${
                active ? 'bg-both text-white shadow-md shadow-violet-500/30' : 'bg-stone-100 text-muted'
              }`}
            >
              {DAY_SHORT[d]}
            </button>
          )
        })}
      </div>
      {days.length > 0 && (
        <p className="text-xs text-muted">
          <b className="text-ink">{describeRepeat(days)}</b>
          {next && ` · al completarlo aparecerá el siguiente (${formatDue(next, !dueTime).toLowerCase()})`}
        </p>
      )}
    </div>
  )
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        {icon}
        {label}
      </h3>
      {children}
    </section>
  )
}
