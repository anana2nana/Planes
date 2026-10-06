import { useState, type ReactNode } from 'react'
import { KINDS, KIND_ORDER } from '../lib/kinds'
import { PEOPLE, partnerOf } from '../lib/people'
import { dateToDraft, formatDue } from '../lib/time'
import { DAY_NAME, DAY_SHORT, WEEK_ORDER, describeRepeat, firstOccurrence, nextOccurrence, type Weekday } from '../lib/recurrence'
import { createPlan, deletePlans, updatePlan } from '../services/plans'
import type { Kind, Plan, PersonId, PlanDraft, PriorityConfig, Tag } from '../lib/types'
import { BottomSheet } from './BottomSheet'
import { BellIcon, CalendarIcon, CopyIcon, FlagIcon, NoteIcon, RepeatIcon, TagIcon, TrashIcon, UsersIcon } from './Icons'
import { AssigneePicker, PriorityPicker, TagPicker } from './Pickers'

interface Props {
  plan: Plan | null
  /** Tipo por defecto para algo nuevo (según la pestaña desde la que se crea). */
  defaultKind?: Kind
  /** Fecha (yyyy-mm-dd) para algo nuevo, p. ej. al crearlo desde el calendario. */
  defaultDate?: string
  siblings: Plan[]
  me: PersonId
  tags: Tag[]
  priorities: PriorityConfig
  onClose: () => void
  onError: (msg: string) => void
}

function initialDraft(plan: Plan | null, kind: Kind, defaultDate?: string): PlanDraft {
  if (!plan) {
    return {
      kind,
      title: '',
      notes: '',
      mode: 'both',
      dueDate: defaultDate ?? '',
      dueTime: '',
      priority: 'medium',
      tagIds: [],
      repeatDays: [],
      repeatYearly: false,
      rotate: false,
      remindWeekBefore: false,
    }
  }
  return {
    kind: plan.kind,
    title: plan.title,
    notes: plan.notes,
    mode: plan.assignee,
    ...dateToDraft(plan.dueAt?.toDate() ?? null, plan.allDay),
    priority: plan.priority,
    tagIds: plan.tagIds,
    repeatDays: plan.repeat?.days ?? [],
    repeatYearly: plan.repeat?.yearly ?? false,
    rotate: plan.repeat?.rotate ?? false,
    remindWeekBefore: plan.remindWeekBefore,
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

export function PlanForm({ plan, defaultKind = 'plan', defaultDate, siblings, me, tags, priorities, onClose, onError }: Props) {
  const [draft, setDraft] = useState<PlanDraft>(() => initialDraft(plan, defaultKind, defaultDate))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = <K extends keyof PlanDraft>(k: K, v: PlanDraft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const kind = KINDS[draft.kind]
  const isEvent = draft.kind === 'event'
  const isEdit = !!plan
  const isDuplicated = !!plan?.groupId
  const repeats = draft.repeatYearly || draft.repeatDays.length > 0
  const canRotate = !isEvent && !isDuplicated && repeats && (draft.mode === 'nita' || draft.mode === 'kitos')
  const canSave = draft.title.trim().length > 0 && !(isEvent && !draft.dueDate)

  const setKind = (k: Kind) =>
    setDraft((d) => ({
      ...d,
      kind: k,
      // Las citas no se duplican ni tienen turnos; "cada año" es solo para citas.
      mode: k === 'event' && d.mode === 'duplicate' ? 'both' : d.mode,
      repeatYearly: k === 'event' ? d.repeatYearly : false,
    }))

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
        {isEdit ? 'Guardar cambios' : draft.mode === 'duplicate' ? 'Crear para los dos' : `Crear ${kind.one.toLowerCase()}`}
      </button>
    </div>
  )

  return (
    <BottomSheet open onClose={onClose} title={isEdit ? `Editar ${kind.one.toLowerCase()}` : kind.new} footer={footer}>
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
            <p className="text-sm font-semibold text-rose-700">
              ¿Seguro que quieres borrarl{kind.article === 'un' ? 'o' : 'a'}?
              {plan.repeat && ' Dejará de repetirse.'}
            </p>
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

        {/* Tipo */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Tipo">
          {KIND_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft.kind === k}
              onClick={() => setKind(k)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition ${
                draft.kind === k ? 'bg-white shadow-sm' : 'text-muted'
              }`}
            >
              <span aria-hidden>{KINDS[k].emoji}</span> {KINDS[k].one}
            </button>
          ))}
        </div>

        <input
          autoFocus={!isEdit}
          value={draft.title}
          maxLength={200}
          onChange={(e) => set('title', e.target.value)}
          placeholder={kind.placeholder}
          aria-label="Título"
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />

        <Field icon={<UsersIcon className="size-4" />} label="Para quién">
          {isDuplicated ? (
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm">
              <CopyIcon className="size-5 shrink-0 text-amber-600" />
              <p className="text-amber-800">
                Duplicado · esta es la copia de <b>{PEOPLE[plan!.assignee].name}</b>. Los cambios se aplican a las dos copias; cada uno lo
                completa por su cuenta.
              </p>
            </div>
          ) : (
            <>
              <AssigneePicker value={draft.mode} onChange={(m) => set('mode', m)} me={me} allowDuplicate={!isEvent} />
              {draft.mode === 'duplicate' && (
                <p className="mt-2 text-xs text-muted">Se crearán dos iguales, una para cada uno, que completaréis por separado.</p>
              )}
            </>
          )}
        </Field>

        <Field icon={<CalendarIcon className="size-4" />} label={kind.dateLabel}>
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
            {draft.dueDate && !isEvent && (
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
              aria-label="Fecha"
              onChange={(e) => set('dueDate', e.target.value)}
              className="h-12 min-w-0 rounded-2xl border border-stone-200 bg-white px-3 font-semibold outline-none focus:border-both"
            />
            <input
              type="time"
              value={draft.dueTime}
              aria-label="Hora"
              disabled={!draft.dueDate}
              onChange={(e) => set('dueTime', e.target.value)}
              className="h-12 w-32 rounded-2xl border border-stone-200 bg-white px-3 font-semibold outline-none focus:border-both disabled:opacity-40"
            />
          </div>
          {isEvent && !draft.dueDate && <p className="mt-1.5 text-xs text-muted">Las citas necesitan un día.</p>}
          {draft.dueDate && !draft.dueTime && (
            <p className="mt-1.5 text-xs text-muted">{isEvent ? 'Sin hora: todo el día.' : 'Sin hora: vence al final del día.'}</p>
          )}
        </Field>

        <Field icon={<RepeatIcon className="size-4" />} label="Repetir">
          <RepeatPicker
            kind={draft.kind}
            days={draft.repeatDays}
            yearly={draft.repeatYearly}
            dueDate={draft.dueDate}
            dueTime={draft.dueTime}
            onChange={(days, yearly) =>
              setDraft((d) => {
                // Si se repite y aún no tiene fecha, empieza el primer día que toque.
                const first = days.length && !d.dueDate ? firstOccurrence(days) : null
                return {
                  ...d,
                  repeatDays: days,
                  repeatYearly: yearly,
                  // Al marcar "cada año" (cumpleaños), por defecto también avisa una semana antes.
                  remindWeekBefore: yearly && !d.repeatYearly ? true : d.remindWeekBefore,
                  dueDate: first ? dateToDraft(first, true).dueDate : d.dueDate,
                }
              })
            }
          />
          {canRotate && (
            <Toggle
              className="mt-3"
              checked={draft.rotate}
              onChange={(v) => set('rotate', v)}
              label="🔄 Turnos: alternar entre Nita y Kitos"
              hint={
                draft.rotate
                  ? `Ahora le toca a ${PEOPLE[draft.mode as PersonId].name}; la próxima vez, a ${PEOPLE[partnerOf(draft.mode as PersonId)].name}.`
                  : 'Cada vez que se complete, le tocará a la otra persona.'
              }
            />
          )}
          {!isEvent && repeats && !isDuplicated && (draft.mode === 'both' || draft.mode === 'duplicate') && (
            <p className="mt-2 text-xs text-muted">Para hacerlo por turnos, asígnalo a quien le toca primero (Nita o Kitos).</p>
          )}
        </Field>

        {isEvent && (
          <Field icon={<BellIcon className="size-4" />} label="Aviso">
            <Toggle
              checked={draft.remindWeekBefore}
              onChange={(v) => set('remindWeekBefore', v)}
              label="Avisarnos también una semana antes"
              hint="Para que dé tiempo a comprar el regalo o prepararlo. Además del aviso de siempre."
            />
          </Field>
        )}

        {!isEvent && (
          <Field icon={<FlagIcon className="size-4" />} label="Prioridad">
            <PriorityPicker value={draft.priority} onChange={(p) => set('priority', p)} priorities={priorities} />
          </Field>
        )}

        <Field icon={<NoteIcon className="size-4" />} label="Notas">
          <textarea
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            placeholder={isEvent ? 'Dirección, qué llevar, idea de regalo…' : 'Dirección, enlaces, lo que haga falta…'}
            className="w-full resize-none rounded-2xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-both"
          />
        </Field>

        <Field icon={<TagIcon className="size-4" />} label="Etiquetas (opcional)">
          <TagPicker tags={tags} value={draft.tagIds} onChange={(ids) => set('tagIds', ids)} />
        </Field>
      </form>
    </BottomSheet>
  )
}

const WEEKLY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Todos los días', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Entre semana', days: [1, 2, 3, 4, 5] },
  { label: 'Fines de semana', days: [0, 6] },
]

const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((d) => b.includes(d))

function RepeatPicker({
  kind,
  days,
  yearly,
  dueDate,
  dueTime,
  onChange,
}: {
  kind: Kind
  days: number[]
  yearly: boolean
  dueDate: string
  dueTime: string
  onChange: (days: number[], yearly: boolean) => void
}) {
  const isEvent = kind === 'event'
  const toggle = (d: number) => onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d], false)
  const due = dueDate ? new Date(`${dueDate}T${dueTime || '23:59'}`) : null
  const repeat = { days, yearly, rotate: false }
  const repeats = yearly || days.length > 0
  const next = due && repeats ? nextOccurrence(due, repeat, due) : null
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition active:scale-95 ${active ? 'bg-ink text-white' : 'bg-stone-100 text-ink'}`

  return (
    <div className="space-y-3">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <button type="button" onClick={() => onChange([], false)} className={chip(!repeats)}>
          No se repite
        </button>
        {isEvent && (
          <button type="button" onClick={() => onChange([], true)} className={chip(yearly)}>
            🎂 Cada año
          </button>
        )}
        {WEEKLY_PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.days, false)} className={chip(!yearly && sameDays(days, p.days))}>
            {p.label}
          </button>
        ))}
      </div>
      {!yearly && (
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
      )}
      {repeats && (
        <p className="text-xs text-muted">
          <b className="text-ink">{describeRepeat(repeat)}</b>
          {next &&
            (isEvent
              ? ` · la siguiente: ${formatDue(next, !dueTime).toLowerCase()}${yearly ? ` de ${next.getFullYear()}` : ''}`
              : ` · al completarlo aparecerá el siguiente (${formatDue(next, !dueTime).toLowerCase()})`)}
        </p>
      )}
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  className = '',
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  className?: string
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl bg-stone-50 p-3 ${className}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-stone-200 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
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
