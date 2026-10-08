import { useState } from 'react'
import { saveBirthday, useCouple } from '../hooks/useCouple'
import { deleteGift, saveGift, setGiftStatus, useGifts } from '../hooks/useGifts'
import { useSheetState } from '../hooks/useSheetState'
import { OCCASIONS, OCCASION_ORDER, STATUS, upcomingOccasions, type Gift, type GiftOccasion, type GiftStatus } from '../lib/gifts'
import { eur } from '../lib/home'
import { PEOPLE } from '../lib/people'
import type { PersonId } from '../lib/types'
import { BirthdayInput } from './BirthdayInput'
import { BottomSheet } from './BottomSheet'
import { PlusIcon, TrashIcon } from './Icons'
import { NumberField } from './home/ui'

const STATUS_TONE: Record<GiftStatus, string> = {
  idea: 'bg-stone-100 text-stone-600',
  comprado: 'bg-amber-100 text-amber-700',
  regalado: 'bg-emerald-100 text-emerald-700',
}

const whenText = (days: number) => (days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`)

export type GiftDraft = Omit<Gift, 'id' | 'owner' | 'createdAt'> & { id?: string }
const toDraft = ({ id, title, occasion, url, price, notes, status }: Gift): GiftDraft => ({ id, title, occasion, url, price, notes, status })
export const emptyGift = (o: Partial<GiftDraft> = {}): GiftDraft => ({ title: '', occasion: 'otra', url: '', price: null, notes: '', status: 'idea', ...o })

/** Ideas de regalo para la pareja: solo las ve quien las apunta. */
export function GiftsView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const { gifts, loading } = useGifts(me)
  const { since, birthdays } = useCouple()
  const [sheet, openSheet, closeSheet] = useSheetState<GiftDraft>()
  const [showGiven, setShowGiven] = useState(false)
  const today = new Date()
  const upcoming = upcomingOccasions(birthdays[partner], since, today)
  const daysOf = (o: GiftOccasion) => upcoming.find((u) => u.id === o)?.days ?? Infinity

  const pending = gifts.filter((g) => g.status !== 'regalado')
  const given = gifts.filter((g) => g.status === 'regalado')
  const groups = [...OCCASION_ORDER]
    .sort((a, b) => daysOf(a) - daysOf(b))
    .map((o) => ({ o, items: pending.filter((g) => g.occasion === o) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-400 via-pink-400 to-violet-400 p-5 text-white shadow-lg shadow-pink-300/40">
        <div className="pointer-events-none absolute -right-3 -top-3 text-[90px] leading-none opacity-25" aria-hidden>
          🎁
        </div>
        <p className="text-2xl font-extrabold">Para {PEOPLE[partner].name}</p>
        <p className="mt-0.5 text-sm font-semibold opacity-95">🤫 Solo lo ves tú: {PEOPLE[partner].name} no puede ver esta lista.</p>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          {upcoming.map((u) => {
            const n = pending.filter((g) => g.occasion === u.id).length
            return (
              <span key={u.id} className="shrink-0 rounded-2xl bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm">
                {OCCASIONS[u.id].emoji} {u.id === 'cumple' ? 'Su cumple' : OCCASIONS[u.id].label} · {whenText(u.days)}
                {n > 0 && <span className="opacity-80"> · {n} {n === 1 ? 'idea' : 'ideas'}</span>}
              </span>
            )
          })}
        </div>
      </div>

      {!birthdays[partner] && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          <span className="text-sm font-semibold">🎂 ¿Cuándo es el cumple de {PEOPLE[partner].name}?</span>
          <BirthdayInput value={null} onChange={(v) => v && saveBirthday(partner, v).catch((e: Error) => onError(e.message))} label={`Cumple de ${PEOPLE[partner].name}`} />
        </div>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-3xl bg-surface/70" />
      ) : pending.length === 0 ? (
        <p className="px-4 py-4 text-center text-sm text-muted">
          Apunta aquí lo que se le antoje cuando lo diga de pasada. Te avisaremos unas semanas antes de cada fecha. También puedes compartir un enlace de una tienda con Nitakitos.
        </p>
      ) : (
        groups.map(({ o, items }) => (
          <section key={o}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
              {OCCASIONS[o].emoji} {o === 'cumple' ? `Cumple de ${PEOPLE[partner].name}` : OCCASIONS[o].label}
              {Number.isFinite(daysOf(o)) && <span className="opacity-70"> · {whenText(daysOf(o))}</span>}
            </h2>
            <div className="space-y-2">
              {items.map((g) => (
                <GiftCard key={g.id} gift={g} onOpen={() => openSheet(toDraft(g))} onError={onError} />
              ))}
            </div>
          </section>
        ))
      )}

      <button
        onClick={() => openSheet(emptyGift({ occasion: upcoming[0]?.id ?? 'otra' }))}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Apuntar idea de regalo
      </button>

      {given.length > 0 && (
        <section>
          <button onClick={() => setShowGiven((v) => !v)} className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted" aria-expanded={showGiven}>
            {showGiven ? '▾' : '▸'} Ya regalados · {given.length}
          </button>
          {showGiven && (
            <div className="space-y-2 opacity-70">
              {given.map((g) => (
                <GiftCard key={g.id} gift={g} onOpen={() => openSheet(toDraft(g))} onError={onError} />
              ))}
            </div>
          )}
        </section>
      )}

      {sheet && <GiftForm draft={sheet} me={me} partner={partner} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function GiftCard({ gift, onOpen, onError }: { gift: Gift; onOpen: () => void; onError: (m: string) => void }) {
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate font-semibold">{gift.title}</span>
        <span className="block truncate text-xs text-muted">
          {[gift.price !== null ? eur(gift.price) : null, gift.url ? hostOf(gift.url) : null, gift.notes || null].filter(Boolean).join(' · ')}
        </span>
      </button>
      {gift.url && (
        <a href={gift.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 active:scale-95">
          Ver
        </a>
      )}
      <button
        onClick={() => setGiftStatus(gift.id, STATUS[gift.status].next).catch((e: Error) => onError(e.message))}
        aria-label={`Estado: ${STATUS[gift.status].label}. Cambiar a ${STATUS[STATUS[gift.status].next].label}`}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold active:scale-95 ${STATUS_TONE[gift.status]}`}
      >
        {STATUS[gift.status].label}
      </button>
    </article>
  )
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function GiftForm({ draft, me, partner, onClose, onError, onSaved }: { draft: GiftDraft; me: PersonId; partner: PersonId; onClose: () => void; onError: (m: string) => void; onSaved?: () => void }) {
  const [d, setD] = useState(draft)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const canSave = d.title.trim() !== ''
  const save = () => {
    if (!canSave) return
    saveGift({ ...d, title: d.title.trim(), url: d.url.trim(), notes: d.notes.trim() }, me).catch((e: Error) => onError(e.message))
    onSaved?.()
    onClose()
  }
  const input = 'h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? '🎁 Regalo' : `🎁 Idea para ${PEOPLE[partner].name}`}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar idea'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <input
          autoFocus={!isEdit && !d.title}
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="Esas zapatillas, un libro, una escapada…"
          aria-label="Regalo"
          maxLength={120}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Para cuándo">
          {OCCASION_ORDER.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={d.occasion === o}
              onClick={() => setD({ ...d, occasion: o })}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${d.occasion === o ? 'bg-ink text-cream' : 'bg-stone-100'}`}
            >
              {OCCASIONS[o].emoji} {OCCASIONS[o].label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_8rem] gap-2">
          <input value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} type="url" inputMode="url" placeholder="Enlace (opcional)" aria-label="Enlace" className={input} />
          <NumberField value={d.price} onChange={(v) => setD({ ...d, price: v })} suffix="€" label="Precio" placeholder="Precio" />
        </div>
        <textarea
          value={d.notes}
          onChange={(e) => setD({ ...d, notes: e.target.value })}
          rows={2}
          placeholder="Talla, color, dónde lo vio…"
          aria-label="Notas"
          className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both"
        />
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Estado">
          {(Object.keys(STATUS) as GiftStatus[]).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={d.status === s} onClick={() => setD({ ...d, status: s })} className={`h-9 rounded-xl text-sm font-bold ${d.status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {STATUS[s].label}
            </button>
          ))}
        </div>
        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar esta idea?</p>
              <button
                onClick={() => {
                  deleteGift(draft.id!).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
