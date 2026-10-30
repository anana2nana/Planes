import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { num, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useSheetState } from '../../hooks/useSheetState'
import { EFFORT, STARTER_CHORES, leaderText, monthName, monthRange, pastMonths, score, weekRange, ymd, type Chore, type ChoreLog, type Who } from '../../lib/chores'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { CloseIcon, PlusIcon, TrashIcon } from '../Icons'

type Doc = { id?: string } & Record<string, unknown>
const who = (v: unknown): Who => (v === 'kitos' ? 'kitos' : 'nita')
const parseChore = (id: string, x: Record<string, any>): Chore => ({
  id,
  name: str(x.name),
  emoji: str(x.emoji) || '🧹',
  points: Math.min(5, Math.max(1, num(x.points) ?? 1)),
  agreed: x.agreed === true,
  proposedBy: who(x.proposedBy),
})
const parseLog = (id: string, x: Record<string, any>): ChoreLog => ({ id, choreId: str(x.choreId), by: who(x.by), date: str(x.date), points: num(x.points) ?? 1 })

export const useChores = () => useList('chores', parseChore)
export const useChoreLogs = () => useList('choreLogs', parseLog)
const names = { nita: PEOPLE.nita.name, kitos: PEOPLE.kitos.name }
const other = (p: Who): Who => (p === 'nita' ? 'kitos' : 'nita')
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Premio del mes (lo que os jugáis), en config/chores.prizes[yyyy-mm]. */
function usePrizes() {
  const [prizes, setPrizes] = useState<Record<string, string>>({})
  useEffect(() => onSnapshot(doc(db, 'config', 'chores'), (s) => setPrizes((s.get('prizes') as Record<string, string>) ?? {})), [])
  return prizes
}

/** Reto de tareas: cada uno apunta lo que hace, cada tarea vale sus puntos (acordados) y gana el mes quien más suma. */
export function ChoresView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items: chores, loading } = useChores()
  const { items: logs } = useChoreLogs()
  const prizes = usePrizes()
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'chore'; chore: Chore | null } | { type: 'prize' }>()
  const [yesterday, setYesterday] = useState(false)
  const now = new Date()
  const month = monthRange(now)
  const week = weekRange(now)
  const m = score(chores, logs, month.from, month.to)
  const w = score(chores, logs, week.from, week.to)
  const monthKey = month.from.slice(0, 7)
  const byId = new Map(chores.map((c) => [c.id, c]))
  const sorted = [...chores].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const toAgree = chores.filter((c) => !c.agreed && c.proposedBy !== me)
  const waiting = chores.filter((c) => !c.agreed && c.proposedBy === me)
  const recent = logs.filter((l) => l.date >= month.from && l.date <= month.to).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const past = pastMonths(chores, logs, now)
  const total = m.nita + m.kitos

  const log = (c: Chore) => {
    const date = ymd(yesterday ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now)
    saveItem<Doc>('choreLogs', { choreId: c.id, by: me, date, points: c.points }, me, onError)
    navigator.vibrate?.(15)
    onError(`✓ ${c.emoji} ${c.name}: +${c.points} ${c.points === 1 ? 'punto' : 'puntos'}`)
  }
  const accept = (c: Chore) => saveItem<Doc>('chores', { id: c.id, agreed: true }, me, onError)

  return (
    <div className="space-y-4">
      {/* Marcador del mes */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-4 text-white shadow-lg shadow-orange-300/40">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">🏆 Reto de {monthName(now)}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(['nita', 'kitos'] as Who[]).map((p) => (
            <div key={p} className={`flex items-center gap-2 rounded-2xl p-2.5 ${m[p] > m[other(p)] ? 'bg-white/30' : 'bg-white/15'}`}>
              <Avatar mode={p} size="md" />
              <span>
                <span className="block text-xs font-semibold opacity-90">{names[p]}</span>
                <span className="tabular block text-3xl font-extrabold leading-none">{m[p]}</span>
              </span>
            </div>
          ))}
        </div>
        {total > 0 && (
          <div className="mt-3 flex h-2 gap-0.5" role="img" aria-label={`${names.nita} ${m.nita}, ${names.kitos} ${m.kitos}`}>
            {m.nita > 0 && <div className="rounded-full bg-white" style={{ width: `${(m.nita / total) * 100}%` }} />}
            {m.kitos > 0 && <div className="rounded-full bg-white/50" style={{ width: `${(m.kitos / total) * 100}%` }} />}
          </div>
        )}
        <p className="mt-2 text-sm font-bold">{leaderText(m, names)}</p>
        <p className="text-xs opacity-90">
          Esta semana: {names.nita} {w.nita} · {names.kitos} {w.kitos}
          {total > 0 && ` · Juntos, ${total} puntos 💪`}
        </p>
        <button onClick={() => openSheet({ type: 'prize' })} className="mt-2 w-full rounded-2xl bg-white/20 px-3 py-2 text-left text-sm font-semibold">
          🎁 {prizes[monthKey] ? prizes[monthKey] : 'Poned un premio para quien gane (o un castigo cariñoso)'}
        </button>
      </div>

      {/* Acuerdos pendientes */}
      {toAgree.length > 2 ? (
        <div className="space-y-2 rounded-3xl bg-violet-50 p-3">
          <p className="text-sm">
            <b>{names[toAgree[0].proposedBy]}</b> ha propuesto los puntos de {toAgree.length} tareas. Míralos abajo («Tareas del reto») y cambia los que no te parezcan bien.
          </p>
          <button onClick={() => toAgree.forEach(accept)} className="w-full rounded-2xl bg-violet-600 py-2 text-sm font-bold text-white">
            Vale a todas
          </button>
        </div>
      ) : (
        toAgree.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-3xl bg-violet-50 p-3">
            <span className="text-2xl" aria-hidden>
              {c.emoji}
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <b>{names[c.proposedBy]}</b> propone que «{c.name}» valga <b>{c.points}</b> ({EFFORT[c.points].toLowerCase()})
            </span>
            <button onClick={() => accept(c)} className="shrink-0 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">
              Vale
            </button>
            <button onClick={() => openSheet({ type: 'chore', chore: c })} className="shrink-0 text-xs font-bold text-violet-700">
              Otro
            </button>
          </div>
        ))
      )}

      {/* Apuntar */}
      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : chores.length === 0 ? (
        <div className={`${card} space-y-3 text-center`}>
          <p className="text-sm text-muted">Primero, las tareas del reto y cuánto vale cada una (de 1 a 5 según el esfuerzo). Lo que ponga uno lo tiene que aceptar el otro.</p>
          <button
            onClick={() => STARTER_CHORES.forEach((c) => saveItem<Doc>('chores', { ...c, agreed: false, proposedBy: me }, me, onError))}
            className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-cream"
          >
            Empezar con las típicas
          </button>
          <button onClick={() => openSheet({ type: 'chore', chore: null })} className="block w-full text-sm font-bold text-muted">
            O añadir una a mano
          </button>
        </div>
      ) : (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted">¿Qué has hecho?</h2>
            <div className="flex rounded-full bg-stone-100 p-0.5 text-xs font-bold" role="radiogroup" aria-label="Cuándo">
              {[false, true].map((y) => (
                <button
                  key={String(y)}
                  role="radio"
                  aria-checked={yesterday === y}
                  onClick={() => setYesterday(y)}
                  className={`rounded-full px-3 py-1 ${yesterday === y ? 'bg-surface shadow-sm' : 'text-muted'}`}
                >
                  {y ? 'Ayer' : 'Hoy'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {sorted.map((c) => (
              <button
                key={c.id}
                onClick={() => log(c)}
                aria-label={`${c.name}: hecho (${c.points} puntos)`}
                className="relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-surface p-2 text-center shadow-sm active:scale-95"
              >
                <span className="text-2xl" aria-hidden>
                  {c.emoji}
                </span>
                <span className="line-clamp-2 text-[11px] font-bold leading-tight">{c.name}</span>
                <span className={`absolute right-1.5 top-1.5 rounded-full px-1.5 text-[10px] font-extrabold ${c.agreed ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-muted'}`}>
                  {c.agreed ? '' : '⏳'}+{c.points}
                </span>
              </button>
            ))}
          </div>
          {waiting.length > 0 && <p className="mt-2 px-1 text-xs text-muted">⏳ = esperando a que {names[other(me)]} acepte los puntos (mientras, cuentan igual).</p>}
        </section>
      )}

      {/* Lo apuntado este mes */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Este mes</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {recent.slice(0, 40).map((l, i) => {
              const c = byId.get(l.choreId)
              const newDay = i === 0 || recent[i - 1].date !== l.date
              return (
                <li key={l.id}>
                  {newDay && <p className="bg-stone-50 px-4 py-1 text-[11px] font-bold capitalize text-muted">{dayFmt.format(parseYmd(l.date))}</p>}
                  <div className="flex items-center gap-3 px-4 py-2">
                    <Avatar mode={l.by} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {c?.emoji ?? '🧹'} {c?.name ?? 'Tarea borrada'}
                    </span>
                    <span className="tabular text-sm font-bold text-amber-700">+{c?.points ?? l.points}</span>
                    {l.by === me && (
                      <button
                        onClick={() => removeItem('choreLogs', l.id).catch((e: Error) => onError(e.message))}
                        aria-label="Quitar"
                        className="grid size-7 place-items-center rounded-full text-stone-300"
                      >
                        <CloseIcon className="size-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Tareas y sus puntos */}
      {chores.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Tareas del reto y sus puntos</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {sorted.map((c) => (
              <li key={c.id}>
                <button onClick={() => openSheet({ type: 'chore', chore: c })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                  <span className="text-xl" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block text-[11px] text-muted">
                      {c.agreed ? `${EFFORT[c.points]} · de acuerdo los dos` : `Propuesta de ${names[c.proposedBy]} · falta que ${names[other(c.proposedBy)]} diga que vale`}
                    </span>
                  </span>
                  <span className="tabular rounded-full bg-amber-100 px-2 py-0.5 text-sm font-extrabold text-amber-800">{c.points}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => openSheet({ type: 'chore', chore: null })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted"
          >
            <PlusIcon className="size-4" /> Añadir tarea al reto
          </button>
        </section>
      )}

      {/* Meses anteriores */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Meses anteriores</h2>
          <ul className="space-y-1.5">
            {past.map((p) => (
              <li key={p.key} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-2.5 text-sm shadow-sm">
                <span className="font-semibold capitalize">{p.label}</span>
                <span className="text-right text-xs">
                  <b className="tabular">
                    {names.nita} {p.score.nita} · {names.kitos} {p.score.kitos}
                  </b>
                  <span className="block text-muted">{leaderText(p.score, names, true)}</span>
                  {prizes[p.key] && <span className="block text-muted">🎁 {prizes[p.key]}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="px-2 text-center text-[11px] text-muted">Es un juego: lo importante es que se vea todo lo que hacéis los dos 💛. Cada uno apunta lo suyo y solo puede quitar lo suyo.</p>

      {sheet?.type === 'chore' && <ChoreSheet chore={sheet.chore} me={me} onClose={closeSheet} onError={onError} />}
      {sheet?.type === 'prize' && <PrizeSheet monthKey={monthKey} label={monthName(now)} value={prizes[monthKey] ?? ''} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

const EMOJIS = ['🧹', '🍽️', '🍳', '🧺', '👕', '♨️', '🗑️', '🪣', '🚽', '🧽', '🛏️', '🛒', '🐱', '🪴', '🚗', '🔧', '📦', '🪟', '🧴', '💡']

function ChoreSheet({ chore, me, onClose, onError }: { chore: Chore | null; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(chore?.name ?? '')
  const [emoji, setEmoji] = useState(chore?.emoji ?? '🧹')
  const [points, setPoints] = useState(chore?.points ?? 2)
  const [confirm, setConfirm] = useState(false)
  const changedPoints = !chore || points !== chore.points
  const dirty = !chore || name !== chore.name || emoji !== chore.emoji || changedPoints
  const save = () => {
    if (!name.trim()) return
    // Cambiar los puntos es una propuesta: el otro tiene que decir que vale. Cambiar solo el nombre, no.
    saveItem<Doc>('chores', { id: chore?.id, name: name.trim().slice(0, 60), emoji, points, ...(changedPoints ? { agreed: false, proposedBy: me } : {}) }, me, onError)
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={chore ? 'Tarea del reto' : 'Nueva tarea del reto'}
      footer={
        dirty ? (
          <button onClick={save} disabled={!name.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {chore && changedPoints ? `Proponer ${points} ${points === 1 ? 'punto' : 'puntos'}` : 'Guardar'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!chore}
          maxLength={60}
          placeholder="Limpiar los cristales, regar las plantas…"
          aria-label="Tarea"
          className="h-12 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
        />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icono">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={`grid size-10 place-items-center rounded-xl text-xl ${emoji === e ? 'bg-ink' : 'bg-stone-100'}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">¿Cuánto esfuerzo? (los puntos que suma cada vez)</p>
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Puntos">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={points === n}
                onClick={() => setPoints(n)}
                className={`rounded-xl py-2 text-center ${points === n ? 'bg-amber-400 text-white' : 'bg-stone-100'}`}
              >
                <span className="block text-lg font-extrabold">{n}</span>
                <span className="block text-[10px] font-semibold leading-tight">{EFFORT[n]}</span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">{changedPoints ? `${names[other(me)]} tendrá que aceptar los puntos (mientras, cuentan igual).` : chore?.agreed ? 'De acuerdo los dos.' : ''}</p>
        </div>
        {chore &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Quitarla del reto? Lo ya apuntado sigue contando.</p>
              <button
                onClick={() => {
                  removeItem('chores', chore.id).catch((e: Error) => onError(e.message))
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Quitar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Quitar del reto
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}

function PrizeSheet({ monthKey, label, value, onClose, onError }: { monthKey: string; label: string; value: string; onClose: () => void; onError: (m: string) => void }) {
  const [text, setText] = useState(value)
  const save = () => {
    setDoc(doc(db, 'config', 'chores'), { prizes: { [monthKey]: text.trim().slice(0, 120) } }, { merge: true }).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Premio de ${label}`}
      footer={
        <button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          maxLength={120}
          placeholder="Quien pierda invita a cenar 🍕"
          aria-label="Premio"
          className="h-12 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
        />
        <div className="flex flex-wrap gap-1.5">
          {['Quien pierda invita a cenar 🍕', 'Quien gane elige la peli 🎬', 'Desayuno en la cama ☕', 'Masaje de 20 minutos 💆', 'Quien pierda friega una semana 🍽️'].map((s) => (
            <button key={s} type="button" onClick={() => setText(s)} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold">
              {s}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

/** La tarjeta pequeña (Hogar y Tareas): cómo va el mes. */
export function ChoresSummary({ onOpen }: { onOpen: () => void }) {
  const { items: chores } = useChores()
  const { items: logs } = useChoreLogs()
  const now = new Date()
  const r = monthRange(now)
  const m = score(chores, logs, r.from, r.to)
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-amber-100 to-rose-100 p-3.5 text-left active:scale-[0.99]">
      <span className="text-2xl" aria-hidden>
        🏆
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">Reto de {monthName(now)}</span>
        <span className="block truncate text-xs text-ink/70">
          {chores.length ? `${names.nita} ${m.nita} · ${names.kitos} ${m.kitos} · ${leaderText(m, names)}` : 'Apuntad lo que hace cada uno y ved quién gana el mes'}
        </span>
      </span>
      <span className="text-xs font-bold text-ink/60">›</span>
    </button>
  )
}
