import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { oneOf, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { daysTo, ymdOf } from '../../lib/due'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'

export type HealthKind = 'cita' | 'revision' | 'vacuna' | 'analitica' | 'medicacion' | 'otro'
export const HEALTH_KINDS: Record<HealthKind, { label: string; emoji: string }> = {
  cita: { label: 'Cita', emoji: '🩺' },
  revision: { label: 'Revisión', emoji: '🦷' },
  vacuna: { label: 'Vacuna', emoji: '💉' },
  analitica: { label: 'Análisis', emoji: '🧪' },
  medicacion: { label: 'Medicación', emoji: '💊' },
  otro: { label: 'Otro', emoji: '📋' },
}
const KIND_ORDER = Object.keys(HEALTH_KINDS) as HealthKind[]

export interface HealthItem {
  id: string
  owner: PersonId
  kind: HealthKind
  title: string
  /** Cuándo fue (o es) la cita. */
  date: string | null
  /** Próxima vez (revisión anual, dosis de recuerdo…). */
  next: string | null
  doctor: string
  notes: string
  /** Medicación que se toma ahora. */
  active: boolean
}
const parse = (id: string, x: Record<string, any>): HealthItem => ({
  id,
  owner: x.owner === 'kitos' ? 'kitos' : 'nita',
  kind: oneOf<HealthKind>(x.kind, KIND_ORDER, 'otro'),
  title: str(x.title),
  date: str(x.date) || null,
  next: str(x.next) || null,
  doctor: str(x.doctor),
  notes: str(x.notes),
  active: x.active === true,
})
/** Solo los tuyos: las reglas no dejan leer los de la pareja. */
export const useHealth = (me: PersonId) => useList('health', parse, me)

/** La fecha que importa: la próxima si la hay, si no la de la cita. */
export const upcomingDate = (h: HealthItem, today: string) => (h.next && h.next >= today ? h.next : h.date && h.date >= today ? h.date : null)

interface Profile {
  blood: string
  allergies: string
  conditions: string
  meds: string
  doctor: string
  emergency: string
}
const PROFILE_FIELDS: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: 'blood', label: 'Grupo sanguíneo', placeholder: 'A+, 0-…' },
  { key: 'allergies', label: 'Alergias', placeholder: 'Penicilina, frutos secos…' },
  { key: 'conditions', label: 'Enfermedades o cosas a tener en cuenta', placeholder: 'Asma, migrañas…' },
  { key: 'meds', label: 'Medicación habitual', placeholder: 'Nombre y dosis' },
  { key: 'doctor', label: 'Médico de cabecera y centro de salud', placeholder: 'Dra. …, C.S. …' },
  { key: 'emergency', label: 'Contacto de emergencia', placeholder: 'Nombre y teléfono' },
]

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const whenText = (n: number) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : n < 60 ? `En ${n} días` : `En ${Math.round(n / 30.4)} meses`)
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'

/** Salud de cada uno (privada): ficha, próximas citas, medicación e historial. */
export function HealthView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useHealth(me)
  const [sheet, openSheet, closeSheet] = useSheetState<Partial<HealthItem>>()
  const today = ymdOf(new Date())
  const upcoming = items
    .map((h) => ({ h, d: upcomingDate(h, today) }))
    .filter((x): x is { h: HealthItem; d: string } => x.d !== null)
    .sort((a, b) => a.d.localeCompare(b.d))
  const meds = items.filter((h) => h.kind === 'medicacion' && h.active)
  const history = items.filter((h) => h.date && h.date < today && !(h.kind === 'medicacion' && h.active)).sort((a, b) => b.date!.localeCompare(a.date!))
  const partner = me === 'nita' ? 'kitos' : 'nita'

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs font-semibold text-muted">🔒 Solo lo ves tú: ni {PEOPLE[partner].name} puede verlo.</p>
      <ProfileCard me={me} onError={onError} />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Próximo</h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-3xl bg-surface/70" />
        ) : upcoming.length === 0 ? (
          <p className="px-1 text-sm text-muted">Nada pendiente. Apunta citas y revisiones (dentista, ginecólogo, oculista…) y te aviso la víspera.</p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {upcoming.map(({ h, d }) => (
              <Row key={h.id} h={h} line={`${whenText(daysTo(d, new Date()))} · ${dateFmt.format(parseYmd(d))}`} onOpen={() => openSheet(h)} />
            ))}
          </ul>
        )}
      </section>

      {meds.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Tomando ahora</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {meds.map((h) => (
              <Row key={h.id} h={h} line={[h.notes, h.date ? `desde el ${dateFmt.format(parseYmd(h.date))}` : ''].filter(Boolean).join(' · ')} onOpen={() => openSheet(h)} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-1.5">
        {KIND_ORDER.map((k) => (
          <button key={k} onClick={() => openSheet({ kind: k, date: k === 'medicacion' ? today : null, active: k === 'medicacion' })} className="flex items-center gap-1 rounded-full bg-surface px-3 py-2 text-sm font-semibold shadow-sm active:scale-95">
            <PlusIcon className="size-3.5" /> {HEALTH_KINDS[k].emoji} {HEALTH_KINDS[k].label}
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Historial</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {history.map((h) => (
              <Row key={h.id} h={h} line={[dateFmt.format(parseYmd(h.date!)), h.doctor].filter(Boolean).join(' · ')} onOpen={() => openSheet(h)} />
            ))}
          </ul>
        </section>
      )}

      {sheet && <HealthSheet item={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function Row({ h, line, onOpen }: { h: HealthItem; line: string; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
        <span className="text-2xl" aria-hidden>
          {HEALTH_KINDS[h.kind].emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{h.title}</span>
          {line && <span className="block truncate text-xs text-muted">{line}</span>}
        </span>
      </button>
    </li>
  )
}

function ProfileCard({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const [p, setP] = useState<Profile | null>(null)
  const [edit, setEdit] = useState<Profile | null>(null)
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'healthProfile', me),
        (s) => setP(Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, str(s.get(f.key))])) as unknown as Profile),
        () => setP(null),
      ),
    [me],
  )
  if (!p) return null
  const filled = PROFILE_FIELDS.filter((f) => p[f.key])
  if (edit)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setDoc(doc(db, 'healthProfile', me), { ...Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, v.trim()])), owner: me }).catch((err: Error) => onError(err.message))
          setEdit(null)
        }}
        className={`${card} space-y-2`}
      >
        <p className="font-bold">🩹 Tu ficha</p>
        {PROFILE_FIELDS.map((f) => (
          <label key={f.key} className="block text-xs font-semibold text-muted">
            {f.label}
            <input value={edit[f.key]} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} placeholder={f.placeholder} aria-label={f.label} maxLength={200} className={input} />
          </label>
        ))}
        <button type="submit" className="h-11 w-full rounded-xl bg-ink font-bold text-cream">
          Guardar
        </button>
      </form>
    )
  return (
    <button onClick={() => setEdit(p)} className={`${card} block w-full text-left`}>
      <p className="flex items-center justify-between font-bold">
        🩹 Tu ficha <span className="text-xs font-bold text-both">{filled.length ? 'Editar' : 'Rellenar'}</span>
      </p>
      {filled.length === 0 ? (
        <p className="mt-1 text-sm text-muted">Grupo sanguíneo, alergias, medicación… por si alguna vez hace falta a mano.</p>
      ) : (
        <dl className="mt-2 space-y-1 text-sm">
          {filled.map((f) => (
            <div key={f.key} className="flex gap-2">
              <dt className="w-28 shrink-0 text-xs font-semibold text-muted">{f.label.split(' ')[0] === 'Médico' ? 'Médico' : f.label.split(' o ')[0]}</dt>
              <dd className="min-w-0 flex-1 font-semibold">{p[f.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </button>
  )
}

function HealthSheet({ item, me, onClose, onError }: { item: Partial<HealthItem>; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState({ kind: 'cita' as HealthKind, title: '', date: null as string | null, next: null as string | null, doctor: '', notes: '', active: false, ...item })
  const set = (o: Partial<typeof d>) => setD((x) => ({ ...x, ...o }))
  const save = () => {
    if (!d.title.trim()) return
    saveItem('health', { ...d, owner: me, title: d.title.trim(), doctor: d.doctor.trim(), notes: d.notes.trim() }, me, onError)
    onClose()
  }
  const med = d.kind === 'medicacion'
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item.id ? `${HEALTH_KINDS[d.kind].emoji} ${d.title}` : `${HEALTH_KINDS[d.kind].emoji} ${HEALTH_KINDS[d.kind].label}`}
      footer={
        <button onClick={save} disabled={!d.title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Tipo">
          {KIND_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${d.kind === k ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {HEALTH_KINDS[k].emoji} {HEALTH_KINDS[k].label}
            </button>
          ))}
        </div>
        <input autoFocus={!item.id} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={med ? 'Nombre del medicamento' : d.kind === 'revision' ? 'Dentista, oculista…' : d.kind === 'vacuna' ? 'Gripe, tétanos…' : 'Qué es'} aria-label="Qué es" maxLength={80} className={input} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            {med ? 'Desde' : 'Fecha'}
            <input type="date" value={d.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} aria-label="Fecha" className={input} />
          </label>
          {!med && (
            <label className="text-xs font-semibold text-muted">
              Próxima vez
              <input type="date" value={d.next ?? ''} onChange={(e) => set({ next: e.target.value || null })} aria-label="Próxima vez" className={input} />
            </label>
          )}
        </div>
        {!med && <input value={d.doctor} onChange={(e) => set({ doctor: e.target.value })} placeholder="Médico o centro" aria-label="Médico o centro" maxLength={80} className={input} />}
        <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} placeholder={med ? 'Dosis: 1 cada 8 h…' : 'Qué te dijeron, resultados, qué preguntar la próxima vez…'} aria-label="Notas" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        {med && (
          <label className="flex items-center justify-between rounded-2xl bg-stone-50 p-3 text-sm font-semibold">
            La estoy tomando ahora
            <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} aria-label="La estoy tomando ahora" className="size-5 accent-both" />
          </label>
        )}
        {item.id && (
          <button
            type="button"
            onClick={() => {
              removeItem('health', item.id!).catch((e: Error) => onError(e.message))
              onClose()
            }}
            className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600"
          >
            <TrashIcon className="size-4" /> Borrar
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
