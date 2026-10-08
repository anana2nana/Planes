import { useState } from 'react'
import { addWeight, deleteCare, markCareDone, removeWeight, saveCare, savePetProfile, usePet, type PetProfile } from '../../hooks/usePet'
import { useSheetState } from '../../hooks/useSheetState'
import { INTERVALS, TYPICAL_CARE, ageText, daysUntil, describeEvery, nextDue, ymd, type CareItem } from '../../lib/pet'
import { BottomSheet } from '../BottomSheet'
import { CheckIcon, PlusIcon, TrashIcon } from '../Icons'
import { LineChart } from './Charts'
import { Card, Label, NumberField, SectionTitle } from './ui'

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })
const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return dayFmt.format(new Date(y, m - 1, d))
}

function dueLabel(days: number): { text: string; tone: string } {
  if (days < 0) return { text: `Atrasado ${-days} ${days === -1 ? 'día' : 'días'}`, tone: 'bg-rose-100 text-rose-700' }
  if (days === 0) return { text: 'Hoy', tone: 'bg-amber-100 text-amber-700' }
  if (days === 1) return { text: 'Mañana', tone: 'bg-amber-100 text-amber-700' }
  if (days <= 7) return { text: `En ${days} días`, tone: 'bg-amber-50 text-amber-700' }
  return { text: `En ${days} días`, tone: 'bg-stone-100 text-stone-600' }
}

export function PetView({ onError }: { onError: (m: string) => void }) {
  const { profile, care, loading } = usePet()
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'profile' } | { type: 'care'; item: CareItem | null } | { type: 'weight' }>()
  const today = new Date()
  const fail = (e: Error) => onError(e.message)

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />

  const sorted = [...care].sort((a, b) => nextDue(a, today).localeCompare(nextDue(b, today)))
  const name = profile?.name || 'la gata'
  const weights = profile?.weights ?? []

  return (
    <div className="space-y-5">
      {/* Ficha */}
      <button onClick={() => openSheet({ type: 'profile' })} className="block w-full text-left">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-300 via-orange-300 to-pink-300 p-5 text-ink shadow-lg shadow-orange-200/50">
          <div className="pointer-events-none absolute -right-4 -top-4 text-[96px] leading-none opacity-30" aria-hidden>
            🐱
          </div>
          <p className="text-2xl font-extrabold">{profile?.name || 'Vuestra gata'}</p>
          <p className="text-sm font-semibold opacity-80">
            {profile?.birth ? ageText(profile.birth, today) : 'Toca para poner su nombre y su fecha de nacimiento'}
            {weights.length > 0 && ` · ${weights[weights.length - 1].kg.toLocaleString('es-ES')} kg`}
          </p>
          {profile?.chip && <p className="mt-1 text-xs font-semibold opacity-70">Chip: {profile.chip}</p>}
        </div>
      </button>

      {profile?.vetPhone && (
        <a href={`tel:${profile.vetPhone.replace(/\s/g, '')}`} className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] active:scale-[0.99]">
          <span className="text-2xl" aria-hidden>
            🩺
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{profile.vetName || 'Veterinario'}</span>
            <span className="text-xs text-muted">{profile.vetPhone}</span>
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">📞 Llamar</span>
        </a>
      )}

      {/* Cuidados */}
      <section>
        <SectionTitle>Cuidados</SectionTitle>
        {care.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="text-sm text-muted">Apunta sus cuidados y os avisaremos la víspera de cada uno.</p>
            <button
              onClick={() => TYPICAL_CARE.forEach((c) => saveCare({ title: c.title, every: c.every, last: null, history: [] }).catch(fail))}
              className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-cream active:scale-95"
            >
              Añadir los típicos (vacuna, desparasitar…)
            </button>
          </Card>
        ) : (
          <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {sorted.map((c) => {
              const due = nextDue(c, today)
              const days = daysUntil(due, today)
              const label = c.last ? dueLabel(days) : { text: 'Sin apuntar', tone: 'bg-stone-100 text-stone-600' }
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => openSheet({ type: 'care', item: c })} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold">{c.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${label.tone}`}>{label.text}</span>
                      <span className="text-muted">
                        {describeEvery(c.every)}
                        {c.last && ` · última ${fmtDate(c.last)}`}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      navigator.vibrate?.(10)
                      markCareDone(c, ymd(today)).catch(fail)
                    }}
                    disabled={c.last === ymd(today)}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 active:scale-95 disabled:opacity-40"
                    aria-label={`${c.title}: hecho hoy`}
                  >
                    <CheckIcon className="size-3.5" /> Hoy
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {care.length > 0 && (
          <button
            onClick={() => openSheet({ type: 'care', item: null })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted active:scale-[0.99]"
          >
            <PlusIcon className="size-4" /> Añadir cuidado
          </button>
        )}
      </section>

      {/* Peso */}
      <section>
        <SectionTitle
          right={
            <button onClick={() => openSheet({ type: 'weight' })} className="text-xs font-bold text-both">
              + Apuntar peso
            </button>
          }
        >
          Peso
        </SectionTitle>
        <Card>
          {weights.length >= 2 ? (
            <LineChart
              title={`Peso de ${name}`}
              points={weights.map((w) => ({ x: w.date, y: w.kg }))}
              color="#eb6834"
              formatY={(v) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 2 })} kg`}
              formatX={fmtDate}
              zeroBased={false}
              height={120}
            />
          ) : (
            <p className="text-sm text-muted">{weights.length === 1 ? `${weights[0].kg.toLocaleString('es-ES')} kg el ${fmtDate(weights[0].date)}. Con otro peso veréis la evolución.` : 'Apunta su peso de vez en cuando (en el veterinario, por ejemplo).'}</p>
          )}
          {weights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[...weights].reverse().slice(0, 6).map((w) => (
                <button
                  key={`${w.date}-${w.kg}`}
                  onClick={() => removeWeight(w, weights).catch(fail)}
                  className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-muted"
                  title="Tocar para borrar"
                >
                  {fmtDate(w.date)} · {w.kg.toLocaleString('es-ES')} kg ×
                </button>
              ))}
            </div>
          )}
        </Card>
      </section>

      {sheet?.type === 'profile' && <ProfileSheet profile={profile} onClose={closeSheet} onError={onError} />}
      {sheet?.type === 'care' && <CareSheet item={sheet.item} onClose={closeSheet} onError={onError} />}
      {sheet?.type === 'weight' && <WeightSheet onClose={closeSheet} onError={onError} />}
    </div>
  )
}

const input = 'h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

function ProfileSheet({ profile, onClose, onError }: { profile: PetProfile | null; onClose: () => void; onError: (m: string) => void }) {
  const [p, setP] = useState({
    name: profile?.name ?? '',
    birth: profile?.birth ?? '',
    chip: profile?.chip ?? '',
    vetName: profile?.vetName ?? '',
    vetPhone: profile?.vetPhone ?? '',
    notes: profile?.notes ?? '',
  })
  const set = (k: keyof typeof p, v: string) => setP((x) => ({ ...x, [k]: v }))
  const save = () => {
    savePetProfile({ ...p, birth: p.birth || null, name: p.name.trim() }).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet open onClose={onClose} title="🐱 Ficha" footer={<button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">Guardar</button>}>
      <div className="space-y-4">
        <div>
          <Label>Nombre</Label>
          <input value={p.name} onChange={(e) => set('name', e.target.value)} aria-label="Nombre" className={input} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nacimiento</Label>
            <input type="date" value={p.birth} onChange={(e) => set('birth', e.target.value)} aria-label="Fecha de nacimiento" className={input} />
          </div>
          <div>
            <Label>Chip</Label>
            <input value={p.chip} onChange={(e) => set('chip', e.target.value)} inputMode="numeric" aria-label="Número de chip" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Veterinario</Label>
            <input value={p.vetName} onChange={(e) => set('vetName', e.target.value)} aria-label="Veterinario" className={input} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <input value={p.vetPhone} onChange={(e) => set('vetPhone', e.target.value)} type="tel" aria-label="Teléfono del veterinario" className={input} />
          </div>
        </div>
        <div>
          <Label>Notas (alergias, pienso…)</Label>
          <textarea value={p.notes} onChange={(e) => set('notes', e.target.value)} rows={2} aria-label="Notas" className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both" />
        </div>
      </div>
    </BottomSheet>
  )
}

function CareSheet({ item, onClose, onError }: { item: CareItem | null; onClose: () => void; onError: (m: string) => void }) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [every, setEvery] = useState(item?.every ?? { n: 1, unit: 'month' as const })
  const [last, setLast] = useState(item?.last ?? '')
  const save = () => {
    if (!title.trim()) return
    const history = item?.history ?? []
    saveCare({ id: item?.id, title: title.trim(), every, last: last || null, history: last && !history.includes(last) ? [...history, last] : history }).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item ? 'Cuidado' : 'Nuevo cuidado'}
      footer={
        <button onClick={save} disabled={!title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Vacuna, pipeta, revisión…" aria-label="Cuidado" className={input} autoFocus={!item} />
        <div>
          <Label>Cada cuánto</Label>
          <div className="flex flex-wrap gap-2">
            {INTERVALS.map((i) => {
              const active = i.n === every.n && i.unit === every.unit
              return (
                <button key={i.label} type="button" onClick={() => setEvery({ n: i.n, unit: i.unit })} aria-pressed={active} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
                  {i.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <Label>Última vez</Label>
          <input type="date" value={last} max={ymd(new Date())} onChange={(e) => setLast(e.target.value)} aria-label="Última vez" className={input} />
        </div>
        {item && item.history.length > 0 && (
          <p className="text-xs text-muted">Historial: {[...item.history].sort().reverse().slice(0, 8).map(fmtDate).join(' · ')}</p>
        )}
        {item && (
          <button
            type="button"
            onClick={() => {
              deleteCare(item.id).catch((e: Error) => onError(e.message))
              onClose()
            }}
            className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-rose-600"
          >
            <TrashIcon className="size-4" /> Borrar este cuidado
          </button>
        )}
      </div>
    </BottomSheet>
  )
}

function WeightSheet({ onClose, onError }: { onClose: () => void; onError: (m: string) => void }) {
  const [kg, setKg] = useState<number | null>(null)
  const [date, setDate] = useState(ymd(new Date()))
  const save = () => {
    if (!kg) return
    addWeight(date, kg).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet open onClose={onClose} title="⚖️ Peso" footer={<button onClick={save} disabled={!kg} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">Guardar</button>}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField value={kg} onChange={setKg} suffix="kg" label="Peso" placeholder="4,2" />
        <input type="date" value={date} max={ymd(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Fecha" className={input} />
      </div>
    </BottomSheet>
  )
}
