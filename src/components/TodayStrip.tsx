import { useNow } from '../hooks/useNow'
import { eventEmoji } from '../lib/kinds'
import type { Plan, PersonId } from '../lib/types'
import { ChevronIcon } from './Icons'
import { useCouple } from '../hooks/useCouple'
import { specialDay } from '../lib/couple'
import { useMeals } from '../hooks/useMenu'
import { dismissPrompt, readDismissed, useMemories, type MemoryDraft } from '../hooks/useMemories'
import { eventPrompts, onThisDay, yearsAgo, type Memory } from '../lib/memories'
import { MemorySheet } from './memories/MemorySheet'
import { MemoryView, toMemoryDraft } from './memories/DiaryView'
import { useState } from 'react'
import { ymd } from '../lib/menu'

const EMOJI = { plan: '💞', task: '🧹' }
const timeFmt = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

/** "Hoy para ti": lo de hoy de la persona (suyo o de los dos) y lo que arrastra atrasado. */
export function TodayStrip({ plans, me, onOpen, onGoTasks, onGoMenu, onToast = console.error }: { plans: Plan[]; me: PersonId; onOpen: (p: Plan) => void; onGoTasks: () => void; onGoMenu?: () => void; onToast?: (m: string) => void }) {
  const now = new Date(useNow(60_000))
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
  const mine = plans.filter((p) => !p.done && p.dueAt && (p.assignee === me || p.assignee === 'both'))
  const today = mine.filter((p) => p.dueAt!.toMillis() >= start && p.dueAt!.toMillis() < end).sort((a, b) => a.dueAt!.toMillis() - b.dueAt!.toMillis())
  const overdue = mine.filter((p) => p.kind !== 'event' && p.dueAt!.toMillis() < start).length
  const MAX = 4
  const { since } = useCouple()
  const special = since ? specialDay(since, now) : null
  const todayKey = ymd(now)
  const { meals } = useMeals(todayKey, todayKey)
  const { memories } = useMemories()
  const [dismissed, setDismissed] = useState(readDismissed)
  const prompts = eventPrompts(
    plans.filter((p) => p.kind === 'event' && (p.assignee === me || p.assignee === 'both')).map((p) => ({ id: p.id, kind: p.kind, title: p.title, dueMs: p.dueAt?.toMillis() ?? null, repeat: p.repeat })),
    memories,
    dismissed,
    now,
  )
  const otd = onThisDay(memories, now)
  const [sheet, setSheet] = useState<{ draft: MemoryDraft; key?: string; thumb?: string | null } | null>(null)
  const [viewing, setViewing] = useState<Memory | null>(null)
  const myMeals = meals.filter((m) => m.eat[me] !== 'fuera').sort((a, b) => Number(a.slot === 'cena') - Number(b.slot === 'cena'))

  return (
    <section className="rounded-3xl bg-gradient-to-br from-amber-50 to-rose-50 p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-700">☀️ Hoy para ti</h2>
      </div>
      {special && <p className="mb-2 rounded-xl bg-surface/80 px-3 py-2 text-sm font-bold text-rose-700">{special}</p>}
      {today.length === 0 ? (
        <p className="text-sm text-muted">Nada apuntado para hoy 🌿</p>
      ) : (
        <ul className="space-y-1">
          {today.slice(0, MAX).map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpen(p)} className="flex w-full items-center gap-2.5 rounded-xl py-1 text-left active:bg-surface/60">
                <span aria-hidden className="w-5 text-center">
                  {p.kind === 'event' ? eventEmoji(!!p.repeat?.yearly) : EMOJI[p.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</span>
                <span className="tabular shrink-0 text-xs font-semibold text-muted">{p.allDay ? 'hoy' : timeFmt.format(p.dueAt!.toDate())}</span>
              </button>
            </li>
          ))}
          {today.length > MAX && <li className="pl-7 text-xs text-muted">y {today.length - MAX} más en el calendario</li>}
        </ul>
      )}
      {myMeals.length > 0 && (
        <button onClick={onGoMenu} className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-surface/70 px-3 py-2 text-left text-sm active:scale-[0.99]">
          <span aria-hidden>🍝</span>
          <span className="min-w-0 flex-1 truncate">
            {myMeals.map((m) => (
              <span key={m.id} className="mr-2">
                <b className="font-semibold">{m.slot === 'cena' ? 'Cena' : 'Comida'}:</b> {m.title}
                {m.eat[me] === 'taper' && ' 🥡'}
              </span>
            ))}
          </span>
          <ChevronIcon className="size-3.5 shrink-0 text-muted" />
        </button>
      )}
      {otd.length > 0 && (
        <button onClick={() => setViewing(otd[0].memory)} className="mt-2 flex w-full items-center gap-3 rounded-xl bg-surface/70 p-2 text-left active:scale-[0.99]">
          {otd[0].memory.thumb ? (
            <img src={otd[0].memory.thumb} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-amber-100 text-xl">✨</span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-amber-700">Tal día como hoy, {yearsAgo(otd[0].years)}</span>
            <span className="block truncate text-sm font-semibold">{otd[0].memory.title}</span>
          </span>
          <ChevronIcon className="size-3.5 shrink-0 text-muted" />
        </button>
      )}
      {prompts.slice(0, 2).map((p) => (
        <button
          key={p.key}
          onClick={() => {
            const ev = plans.find((x) => x.id === p.id)
            setSheet({ key: p.key, draft: { title: p.title, date: p.date, kind: 'event', planId: p.id, place: ev?.place ?? null, text: '' } })
          }}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-surface/70 px-3 py-2 text-left text-sm active:scale-[0.99]"
        >
          <span aria-hidden>📸</span>
          <span className="min-w-0 flex-1 truncate">
            ¿Qué tal fue <b className="font-semibold">{p.title}</b>?
          </span>
          <ChevronIcon className="size-3.5 shrink-0 text-muted" />
        </button>
      ))}
      {sheet && (
        <MemorySheet
          draft={sheet.draft}
          thumb={sheet.thumb}
          me={me}
          prompt={sheet.key ? 'event' : undefined}
          onSkip={() => {
            if (!sheet.key) return
            dismissPrompt(sheet.key)
            setDismissed(readDismissed())
          }}
          onClose={() => setSheet(null)}
          onError={onToast}
        />
      )}
      {viewing && (
        <MemoryView
          memory={memories.find((m) => m.id === viewing.id) ?? viewing}
          onClose={() => setViewing(null)}
          onEdit={() => setSheet({ draft: toMemoryDraft(viewing), thumb: viewing.thumb })}
          onError={onToast}
        />
      )}
      {overdue > 0 && (
        <button onClick={onGoTasks} className="mt-2 flex w-full items-center gap-1.5 rounded-xl bg-surface/70 px-3 py-2 text-left text-xs font-bold text-rose-700 active:scale-[0.99]">
          ⚠️ {overdue} {overdue === 1 ? 'pendiente atrasada' : 'pendientes atrasadas'}
          <ChevronIcon className="ml-auto size-3.5" />
        </button>
      )}
    </section>
  )
}
