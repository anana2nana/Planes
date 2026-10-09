import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { arr, oneOf, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { INTERVALS, daysUntil, describeEvery, nextDue, ymd, type CareItem, type IntervalUnit } from '../../lib/pet'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'
import { PapersView } from '../papers/PapersView'

export type UpkeepArea = 'casa' | 'coche'
export interface Upkeep extends CareItem {
  area: UpkeepArea
  notes: string
}
const parse = (id: string, x: Record<string, any>): Upkeep => ({
  id,
  title: str(x.title),
  area: x.area === 'coche' ? 'coche' : 'casa',
  every: x.every?.n && x.every?.unit ? { n: Number(x.every.n), unit: oneOf<IntervalUnit>(x.every.unit, ['week', 'month', 'year'], 'month') } : { n: 1, unit: 'year' },
  last: str(x.last) || null,
  history: arr(x.history).filter((h) => typeof h === 'string'),
  notes: str(x.notes),
})
export const useUpkeep = () => useList('upkeep', parse)

const TEMPLATES: Record<UpkeepArea, { title: string; every: CareItem['every'] }[]> = {
  casa: [
    { title: 'Revisión de la caldera', every: { n: 1, unit: 'year' } },
    { title: 'Limpiar filtros del aire acondicionado', every: { n: 6, unit: 'month' } },
    { title: 'Limpiar el filtro del lavavajillas', every: { n: 1, unit: 'month' } },
    { title: 'Limpiar el filtro de la lavadora', every: { n: 3, unit: 'month' } },
    { title: 'Descalcificar la cafetera', every: { n: 3, unit: 'month' } },
    { title: 'Purgar los radiadores', every: { n: 1, unit: 'year' } },
    { title: 'Probar el detector de humo', every: { n: 6, unit: 'month' } },
    { title: 'Limpiar la campana extractora', every: { n: 3, unit: 'month' } },
  ],
  coche: [
    { title: 'Cambio de aceite y filtros', every: { n: 1, unit: 'year' } },
    { title: 'Revisar la presión de las ruedas', every: { n: 1, unit: 'month' } },
    { title: 'Revisar neumáticos', every: { n: 6, unit: 'month' } },
    { title: 'Lavar el coche', every: { n: 1, unit: 'month' } },
    { title: 'Revisar el líquido limpiaparabrisas', every: { n: 3, unit: 'month' } },
  ],
}

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
const dueText = (days: number) => (days < 0 ? `Atrasado ${-days} ${days === -1 ? 'día' : 'días'}` : days === 0 ? 'Toca hoy' : days === 1 ? 'Toca mañana' : days < 60 ? `En ${days} días` : `En ${Math.round(days / 30)} meses`)
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

/** Mantenimiento: cosas que hay que hacer cada cierto tiempo, con la próxima vez calculada. */
export function UpkeepView({ me, area, onError }: { me: PersonId; area: UpkeepArea; onError: (m: string) => void }) {
  const { items, loading } = useUpkeep()
  const [sheet, openSheet, closeSheet] = useSheetState<Partial<Upkeep>>()
  const today = new Date()
  const list = items
    .filter((i) => i.area === area)
    .map((i) => ({ i, days: i.last ? daysUntil(nextDue(i, today), today) : null }))
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
  const templates = TEMPLATES[area].filter((t) => !items.some((i) => i.title === t.title))
  const done = (i: Upkeep) => {
    const t = ymd(today)
    saveItem('upkeep', { ...i, last: t, history: i.history.includes(t) ? i.history : [...i.history, t] }, me, onError)
    onError(`✅ ${i.title}: hecho. La próxima, ${fmtDate(nextDue({ every: i.every, last: t }, today))}`)
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-surface/70" />
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">{area === 'casa' ? 'Lo que hay que hacer de vez en cuando en casa. Apunta la última vez y os aviso cuando toque.' : 'Aceite, ruedas, lavado… Apunta la última vez y os aviso cuando toque.'}</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          {list.map(({ i, days }) => (
            <li key={i.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => openSheet(i)} className="min-w-0 flex-1 text-left">
                <span className="block truncate font-bold">{i.title}</span>
                <span className={`block text-xs ${days === null ? 'text-muted' : days <= 0 ? 'font-bold text-rose-600' : days <= 7 ? 'font-semibold text-amber-700' : 'text-muted'}`}>
                  {days === null ? `${describeEvery(i.every)} · apunta la última vez` : `${dueText(days)} · ${describeEvery(i.every).toLowerCase()}`}
                </span>
              </button>
              <button onClick={() => done(i)} aria-label={`${i.title}: hecho hoy`} className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 active:scale-95">
                ✓ Hecho
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => openSheet({ area })} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted">
        <PlusIcon className="size-4" /> Añadir
      </button>
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button key={t.title} onClick={() => openSheet({ area, title: t.title, every: t.every })} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-95">
              + {t.title}
            </button>
          ))}
        </div>
      )}
      {sheet && <UpkeepSheet item={sheet} me={me} area={area} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function UpkeepSheet({ item, me, area, onClose, onError }: { item: Partial<Upkeep>; me: PersonId; area: UpkeepArea; onClose: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState(item.title ?? '')
  const [every, setEvery] = useState<CareItem['every']>(item.every ?? { n: 1, unit: 'year' })
  const [last, setLast] = useState(item.last ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')
  const save = () => {
    if (!title.trim()) return
    const history = item.history ?? []
    saveItem('upkeep', { id: item.id, area, title: title.trim(), every, last: last || null, history: last && !history.includes(last) ? [...history, last].sort() : history, notes: notes.trim() }, me, onError)
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item.id ? 'Mantenimiento' : 'Nuevo'}
      footer={
        <button onClick={save} disabled={!title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <input autoFocus={!item.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Revisión de la caldera…" aria-label="Qué hay que hacer" maxLength={80} className={input} />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Cada cuánto</p>
          <div className="flex flex-wrap gap-2">
            {[...INTERVALS, { label: 'Cada 2 años', n: 2, unit: 'year' as const }].map((i) => {
              const on = i.n === every.n && i.unit === every.unit
              return (
                <button key={i.label} type="button" aria-pressed={on} onClick={() => setEvery({ n: i.n, unit: i.unit })} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
                  {i.label}
                </button>
              )
            })}
          </div>
        </div>
        <label className="block text-xs font-semibold text-muted">
          Última vez
          <input type="date" value={last} max={ymd(new Date())} onChange={(e) => setLast(e.target.value)} aria-label="Última vez" className={input} />
        </label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notas: teléfono del técnico, qué filtro compra…" aria-label="Notas" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        {item.history && item.history.length > 0 && <p className="text-xs text-muted">Veces anteriores: {[...item.history].sort().reverse().slice(0, 8).map(fmtDate).join(' · ')}</p>}
        {item.id && (
          <button
            type="button"
            onClick={() => {
              removeItem('upkeep', item.id!).catch((e: Error) => onError(e.message))
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

/** El coche: sus datos, el mantenimiento y sus papeles (ITV, seguro, impuesto…). */
export function CarView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const [car, setCar] = useState<{ model: string; plate: string; km: string } | null>(null)
  const [edit, setEdit] = useState(false)
  useEffect(() => onSnapshot(doc(db, 'home', 'car'), (s) => setCar({ model: str(s.get('model')), plate: str(s.get('plate')), km: str(s.get('km')) })), [])
  const save = (c: { model: string; plate: string; km: string }) => {
    setDoc(doc(db, 'home', 'car'), c, { merge: true }).catch((e: Error) => onError(e.message))
    setEdit(false)
  }
  return (
    <div className="space-y-5">
      {car && (edit || !car.model) ? (
        <CarForm car={car} onSave={save} />
      ) : (
        car && (
          <button onClick={() => setEdit(true)} className="flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            <span className="text-4xl" aria-hidden>
              🚗
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-extrabold">{car.model}</span>
              <span className="block text-sm text-muted">
                {car.plate && <span className="font-mono font-bold text-ink">{car.plate}</span>}
                {car.plate && car.km && ' · '}
                {car.km && `${car.km} km`}
              </span>
            </span>
            <span className="text-xs font-bold text-both">Editar</span>
          </button>
        )
      )}
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Mantenimiento</h2>
        <UpkeepView me={me} area="coche" onError={onError} />
      </section>
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">ITV, seguro y papeles</h2>
        <PapersView me={me} onError={onError} only={['coche']} />
      </section>
    </div>
  )
}

function CarForm({ car, onSave }: { car: { model: string; plate: string; km: string }; onSave: (c: { model: string; plate: string; km: string }) => void }) {
  const [c, setC] = useState(car)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ model: c.model.trim(), plate: c.plate.trim().toUpperCase(), km: c.km.trim() })
      }}
      className="space-y-2 rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]"
    >
      <p className="font-bold">🚗 Vuestro coche</p>
      <input value={c.model} onChange={(e) => setC({ ...c, model: e.target.value })} placeholder="Modelo (Seat Ibiza 2019)" aria-label="Modelo" maxLength={60} className={input} />
      <div className="grid grid-cols-2 gap-2">
        <input value={c.plate} onChange={(e) => setC({ ...c, plate: e.target.value })} placeholder="Matrícula" aria-label="Matrícula" maxLength={12} className={`${input} font-mono uppercase`} />
        <input value={c.km} onChange={(e) => setC({ ...c, km: e.target.value })} inputMode="numeric" placeholder="Kilómetros" aria-label="Kilómetros" maxLength={9} className={input} />
      </div>
      <button type="submit" disabled={!c.model.trim()} className="h-11 w-full rounded-xl bg-ink font-bold text-cream disabled:opacity-30">
        Guardar
      </button>
    </form>
  )
}

/**
 * En Agenda → Tareas: lo del mantenimiento (casa y coche) y de la gata que toca en los próximos días,
 * para hacerlo sin apuntarlo dos veces.
 */
export function DueChores({ me, onError, petName, petCare, onPetDone }: { me: PersonId; onError: (m: string) => void; petName: string; petCare: CareItem[]; onPetDone: (c: CareItem, date: string) => void }) {
  const { items } = useUpkeep()
  const today = new Date()
  const t = ymd(today)
  const due = [
    ...items.filter((u) => u.last).map((u) => ({ key: `u-${u.id}`, emoji: u.area === 'casa' ? '🧰' : '🚗', title: u.title, days: daysUntil(nextDue(u, today), today), done: () => saveItem('upkeep', { ...u, last: t, lastBy: me, history: u.history.includes(t) ? u.history : [...u.history, t] }, me, onError) })),
    ...petCare.filter((c) => c.last).map((c) => ({ key: `p-${c.id}`, emoji: '🐱', title: `${c.title}${petName ? ` (${petName})` : ''}`, days: daysUntil(nextDue(c, today), today), done: () => onPetDone(c, t) })),
  ]
    .filter((x) => x.days <= 3)
    .sort((a, b) => a.days - b.days)
  if (!due.length) return null
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Toca en casa</h2>
      <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
        {due.map((x) => (
          <li key={x.key} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl" aria-hidden>
              {x.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{x.title}</span>
              <span className={`block text-xs ${x.days <= 0 ? 'font-bold text-rose-600' : 'text-amber-700'}`}>{dueText(x.days)}</span>
            </span>
            <button
              onClick={() => {
                x.done()
                onError(`✅ ${x.title}: hecho`)
              }}
              aria-label={`${x.title}: hecho`}
              className="shrink-0 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 active:scale-95"
            >
              ✓ Hecho
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
