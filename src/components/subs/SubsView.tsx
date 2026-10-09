import { useState } from 'react'
import { num, oneOf, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { daysTo, expiryText, monthlyCost, nextRenewal, ymdOf, type Period } from '../../lib/due'
import type { AssignMode, PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'

export interface Sub {
  id: string
  name: string
  price: number
  period: Period
  /** Una fecha de cobro conocida (yyyy-mm-dd): de ahí salen las siguientes. */
  from: string
  payer: AssignMode
  /** Avisar unos días antes de cada cobro. */
  remind: boolean
  active: boolean
  notes: string
}
const parse = (id: string, x: Record<string, any>): Sub => ({
  id,
  name: str(x.name),
  price: num(x.price) ?? 0,
  period: oneOf<Period>(x.period, ['month', 'quarter', 'year'], 'month'),
  from: str(x.from) || ymdOf(new Date()),
  payer: oneOf<AssignMode>(x.payer, ['nita', 'kitos', 'both'], 'both'),
  remind: x.remind === true,
  active: x.active !== false,
  notes: str(x.notes),
})
export const useSubs = () => useList('subs', parse)
type SubDraft = Omit<Sub, 'id'> & { id?: string }

const PERIOD: Record<Period, { label: string; per: string }> = { month: { label: 'Mensual', per: '/mes' }, quarter: { label: 'Trimestral', per: '/trim.' }, year: { label: 'Anual', per: '/año' } }
const TEMPLATES: Partial<SubDraft>[] = [
  { name: 'Netflix', price: 13.99 },
  { name: 'Spotify', price: 17.99 },
  { name: 'HBO Max', price: 9.99 },
  { name: 'Prime', price: 49.9, period: 'year' },
  { name: 'Disney+', price: 9.99 },
  { name: 'Gimnasio' },
  { name: 'Móvil' },
  { name: 'Internet y fibra' },
  { name: 'Google One / iCloud' },
  { name: 'Seguro de hogar', period: 'year' },
]
const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Suscripciones y cobros fijos: cuánto suman al mes y cuándo se renueva cada uno. */
export function SubsView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useSubs()
  const [sheet, openSheet, closeSheet] = useSheetState<SubDraft>()
  const today = new Date()
  const active = items
    .filter((s) => s.active)
    .map((s) => ({ s, next: nextRenewal(s.from, s.period, today) }))
    .sort((a, b) => a.next.localeCompare(b.next))
  const paused = items.filter((s) => !s.active)
  const month = active.reduce((t, { s }) => t + monthlyCost(s.price, s.period), 0)
  const by = (p: AssignMode) => active.filter(({ s }) => s.payer === p).reduce((t, { s }) => t + monthlyCost(s.price, s.period), 0)
  const templates = TEMPLATES.filter((t) => !items.some((s) => s.name === t.name))
  const empty = (o: Partial<SubDraft> = {}): SubDraft => ({ name: '', price: 0, period: 'month', from: ymdOf(today), payer: 'both', remind: false, active: true, notes: '', ...o })

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Al mes</p>
          <p className="tabular text-3xl font-extrabold">{eur(Math.round(month * 100) / 100)}</p>
          <p className="text-sm text-muted">{eur(Math.round(month * 12))} al año</p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            {(['nita', 'kitos', 'both'] as AssignMode[])
              .filter((p) => by(p) > 0)
              .map((p) => (
                <span key={p} className="flex items-center gap-1">
                  <Avatar mode={p} size="xs" /> {eur(Math.round(by(p) * 100) / 100)}
                </span>
              ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-32 animate-pulse rounded-3xl bg-surface/70" />
      ) : active.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">Netflix, el gimnasio, el móvil… Apuntadlos y veréis cuánto suman al mes y cuándo se renueva cada uno (y os aviso antes de las renovaciones anuales).</p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          {active.map(({ s, next }) => {
            const d = daysTo(next, today)
            return (
              <li key={s.id}>
                <button onClick={() => openSheet(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.name}</span>
                    <span className={`block text-xs ${d <= 7 ? 'font-semibold text-amber-700' : 'text-muted'}`}>
                      {expiryText(d, ['Se cobra', 'Se cobró'])} · {dateFmt.format(parseYmd(next))}
                      {s.remind && ' · 🔔'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tabular block font-bold">{eur(s.price)}</span>
                    <span className="block text-[10px] text-muted">{PERIOD[s.period].per}</span>
                  </span>
                  {s.payer !== 'both' && <Avatar mode={s.payer} size="xs" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button onClick={() => openSheet(empty())} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Añadir
      </button>
      {templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <button key={t.name} onClick={() => openSheet(empty(t))} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-95">
              + {t.name}
            </button>
          ))}
        </div>
      )}
      {paused.length > 0 && (
        <p className="px-1 text-xs text-muted">
          Dadas de baja:{' '}
          {paused.map((s, i) => (
            <button key={s.id} onClick={() => openSheet(s)} className="font-semibold underline">
              {s.name}
              {i < paused.length - 1 ? ', ' : ''}
            </button>
          ))}
        </p>
      )}
      {sheet && <SubSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function SubSheet({ draft, me, onClose, onError }: { draft: SubDraft; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const [price, setPrice] = useState(draft.price ? String(draft.price).replace('.', ',') : '')
  const set = (o: Partial<SubDraft>) => setD((x) => ({ ...x, ...o }))
  const p = Number(price.replace(',', '.'))
  const valid = d.name.trim() && p > 0
  const save = () => {
    if (!valid) return
    saveItem('subs', { ...d, name: d.name.trim(), notes: d.notes.trim(), price: Math.round(p * 100) / 100 }, me, onError)
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={draft.id ? d.name : 'Nueva suscripción'}
      footer={
        <button onClick={save} disabled={!valid} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <input autoFocus={!d.name} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Netflix, gimnasio…" aria-label="Nombre" maxLength={60} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Precio €" aria-label="Precio" className={input} />
          <div className="flex gap-0.5 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Cada cuánto">
            {(Object.keys(PERIOD) as Period[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={d.period === k} onClick={() => set({ period: k })} className={`h-9 rounded-lg px-2 text-xs font-bold ${d.period === k ? 'bg-surface shadow-sm' : 'text-muted'}`}>
                {PERIOD[k].label}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-xs font-semibold text-muted">
          Un día en que se cobra (el último o el próximo)
          <input type="date" value={d.from} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="Día de cobro" className={input} />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Quién paga">
          {(['nita', 'kitos', 'both'] as AssignMode[]).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={d.payer === o} onClick={() => set({ payer: o })} className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold ${d.payer === o ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              <Avatar mode={o} size="xs" /> {o === 'both' ? 'A medias' : o === 'nita' ? 'Nita' : 'Kitos'}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 p-3 text-sm font-semibold">
          <span>
            🔔 Avisarme antes de cada cobro
            <span className="block text-xs font-medium text-muted">{d.period === 'month' ? 'Las anuales avisan siempre una semana antes' : 'Una semana antes'}</span>
          </span>
          <input type="checkbox" checked={d.remind || d.period !== 'month'} disabled={d.period !== 'month'} onChange={(e) => set({ remind: e.target.checked })} aria-label="Avisar antes del cobro" className="size-5 accent-both" />
        </label>
        <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Notas: con qué tarjeta, cómo darse de baja…" aria-label="Notas" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        {draft.id && (
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => set({ active: !d.active })} className="text-sm font-bold text-both">
              {d.active ? 'Dar de baja (se guarda)' : 'Volver a activarla'}
            </button>
            <button
              type="button"
              onClick={() => {
                removeItem('subs', draft.id!).catch((e: Error) => onError(e.message))
                onClose()
              }}
              className="flex items-center gap-1 text-sm font-semibold text-rose-600"
            >
              <TrashIcon className="size-4" /> Borrar
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
