// bbs: el repositorio de planes y sitios de Nita, Kitos y María.
// Un solo componente para las dos entradas: la app bbs (su propia URL) y la baldosa de Nosotros en Nitakitos.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BBS_KINDS, BBS_RATINGS, dateState, heartCount, history, linkLabel, sortPending, urgencyText, verdict, ymdOf, type BbsItem, type BbsKind, type BbsPerson } from '../lib/bbs.ts'
import { useSheetState } from '../hooks/useSheetState'
import { DirectionsLink } from '../components/DirectionsLink'
import { NavigateIcon, PlusIcon } from '../components/Icons'
import { setHeart, useBbsItems } from './useBbs'
import { BbsForm } from './BbsForm'
import { BbsPicker } from './BbsPicker'
import { Hearts } from './Hearts'
import { BbsNotifications } from './BbsNotifications'
import type { BbsApp } from './push'
import type { BbsDraft } from './useBbs'

type Tab = 'pending' | 'done' | 'dropped'
type Sheet = { id: string } | { draft: Partial<BbsDraft> }

export function BbsView({ me, app, onError, initialShare }: { me: BbsPerson; app: BbsApp; onError: (m: string) => void; initialShare?: Partial<BbsDraft> | null }) {
  const { items, loading, error } = useBbsItems()
  const [tab, setTab] = useState<Tab>('pending')
  const [kind, setKind] = useState<BbsKind | null>(null)
  const [search, setSearch] = useState('')
  const [sheet, openSheet, closeSheet] = useSheetState<Sheet>()
  const [picking, setPicking] = useState(false)
  const today = ymdOf(new Date())

  // Lo que llega con "Compartir → bbs" abre directamente la hoja de apuntar.
  useEffect(() => {
    if (initialShare) openSheet({ draft: initialShare })
  }, [initialShare, openSheet])

  const pending = useMemo(() => sortPending(items, today).filter((i) => dateState(i, today) !== 'over'), [items, today])
  const over = useMemo(() => items.filter((i) => i.status === 'pending' && dateState(i, today) === 'over'), [items, today])
  const done = useMemo(() => history(items), [items])
  const dropped = useMemo(() => items.filter((i) => i.status === 'dropped'), [items])
  const base = tab === 'pending' ? pending : tab === 'done' ? done : [...over, ...dropped]
  const q = search.trim().toLowerCase()
  const list = base.filter((i) => (!kind || i.kind === kind) && (!q || `${i.title} ${i.place?.name ?? ''} ${i.place?.address ?? ''} ${i.note}`.toLowerCase().includes(q)))
  const kindsHere = BBS_KIND_ORDER.filter((k) => base.some((i) => i.kind === k))
  const allThree = pending.filter((i) => heartCount(i) === 3).length

  const open = useCallback((id: string) => openSheet({ id }), [openSheet])
  const editing = sheet && 'id' in sheet ? items.find((i) => i.id === sheet.id) ?? null : null

  return (
    <div className="space-y-4 pb-24">
      {/* La función estrella */}
      <button
        onClick={() => setPicking(true)}
        className="relative w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#2dd4bf] p-5 text-left text-white shadow-lg shadow-teal-700/25 active:scale-[0.99]"
      >
        <span aria-hidden className="absolute -right-3 -top-4 rotate-12 text-[88px] leading-none opacity-90">
          🎲
        </span>
        <span className="block text-xs font-bold uppercase tracking-wider opacity-90">¿Sin ideas?</span>
        <span className="mt-1 block max-w-[75%] text-2xl font-extrabold leading-tight">No sabemos qué hacer</span>
        <span className="mt-2 block text-sm font-semibold opacity-95">
          {pending.length === 0 ? 'Apuntad algún plan y aquí os elegimos uno' : `Elegimos entre ${pending.length} ${pending.length === 1 ? 'plan' : 'planes'}${allThree ? ` · ${allThree} os apetecen a los tres` : ''}`}
        </span>
      </button>

      <button
        onClick={() => openSheet({ draft: {} })}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-base font-extrabold text-bbs-ink shadow-[0_4px_16px_-6px_rgba(20,35,31,0.12)] ring-2 ring-bbs/30 active:scale-[0.99]"
      >
        <PlusIcon className="size-5" /> Apuntar un plan o un sitio
      </button>

      <div className="flex gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Estado">
        {(
          [
            ['pending', 'Pendientes', pending.length],
            ['done', 'Hechos', done.length],
            ['dropped', 'Descartados', over.length + dropped.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id)
              setKind(null)
            }}
            className={`h-10 flex-1 rounded-xl text-sm font-bold transition ${tab === id ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
          >
            {label} <span className="tabular text-xs opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {base.length > 4 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar"
          className="h-11 w-full rounded-2xl border border-stone-200 bg-surface px-4 outline-none focus:border-bbs"
        />
      )}

      {kindsHere.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip on={!kind} onClick={() => setKind(null)}>
            Todo
          </Chip>
          {kindsHere.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>
              {BBS_KINDS[k].emoji} {BBS_KINDS[k].label}
            </Chip>
          ))}
        </div>
      )}

      {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">No se pudo leer bbs: {error}</p>}
      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-24 animate-pulse rounded-3xl bg-surface" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty tab={tab} filtered={!!kind || !!q} />
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <li key={i.id}>
              <BbsCard item={i} me={me} today={today} onOpen={open} onError={onError} />
            </li>
          ))}
        </ul>
      )}

      <BbsNotifications me={me} app={app} onError={onError} />

      {sheet && ('draft' in sheet || editing) && (
        <BbsForm key={'id' in sheet ? sheet.id : 'new'} item={editing} draft={'draft' in sheet ? sheet.draft : undefined} me={me} onClose={closeSheet} onError={onError} />
      )}
      {picking && <BbsPicker items={items} me={me} today={today} onClose={() => setPicking(false)} onOpen={open} />}
    </div>
  )
}

const BBS_KIND_ORDER: BbsKind[] = ['restaurante', 'bar', 'ruta', 'expo', 'escapada', 'casa', 'otro']

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition ${on ? 'bg-bbs text-white' : 'bg-surface text-ink shadow-sm'}`}>
      {children}
    </button>
  )
}

function Empty({ tab, filtered }: { tab: Tab; filtered: boolean }) {
  const [emoji, text] = filtered
    ? ['🔎', 'Nada con ese filtro.']
    : tab === 'pending'
      ? ['🌱', 'Aún no hay nada. Apuntad el próximo sitio que veáis en Instagram o TikTok (o compartidlo directamente con bbs).']
      : tab === 'done'
        ? ['📖', 'Aquí quedará todo lo que hagáis juntos, con lo que os pareció.']
        : ['🗑️', 'Lo que descartéis o se pase de fecha acaba aquí.']
  return (
    <div className="rounded-3xl border-2 border-dashed border-stone-200 p-6 text-center">
      <p className="text-3xl">{emoji}</p>
      <p className="mt-2 text-sm text-muted">{text}</p>
    </div>
  )
}

const PRICE = ['', '€', '€€', '€€€']
const SETTING = { in: '🏠 Interior', out: '🌳 Exterior', both: '🏠🌳 Las dos' }

export function BbsCard({ item, me, today, onOpen, onError }: { item: BbsItem; me: BbsPerson; today: string; onOpen: (id: string) => void; onError: (m: string) => void }) {
  const k = BBS_KINDS[item.kind]
  const urgent = item.status === 'pending' ? urgencyText(item, today) : null
  const mine = !!item.hearts[me]
  const v = item.status === 'done' ? verdict(item.ratings) : null
  const facts = [item.place?.name !== item.title ? item.place?.name : item.place?.address.split(',').slice(-2, -1)[0]?.trim(), PRICE[item.price], item.setting ? SETTING[item.setting] : '', item.booking ? '📞 Reservar' : '', !item.place && item.link ? linkLabel(item.link) : '']
    .filter(Boolean)
    .join(' · ')
  return (
    <div className={`flex items-stretch gap-3 rounded-3xl bg-surface p-3 shadow-[0_4px_16px_-6px_rgba(20,35,31,0.10)] ${item.status === 'dropped' ? 'opacity-60' : ''}`}>
      <button onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-label={`Abrir ${item.title}`}>
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-bbs-soft text-2xl" aria-hidden>
          {k.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 font-extrabold leading-snug">{item.title}</span>
          {facts && <span className="mt-0.5 block truncate text-xs text-muted">{facts}</span>}
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {urgent && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${/hoy|mañana|pasó/.test(urgent) ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>📅 {urgent}</span>}
            {item.status === 'done' ? (
              <>
                {v && <span className="rounded-full bg-bbs-soft px-2 py-0.5 text-[11px] font-bold text-bbs-ink">{BBS_RATINGS[v].emoji} {BBS_RATINGS[v].label}</span>}
                {item.doneAt && <span className="text-[11px] text-muted">{new Date(`${item.doneAt}T12:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: item.doneAt.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' })}</span>}
              </>
            ) : (
              <Hearts item={item} me={me} />
            )}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-center justify-between gap-1">
        {item.status === 'pending' && (
          <button
            onClick={() => {
              navigator.vibrate?.(10)
              setHeart(item.id, me, !mine, onError)
            }}
            aria-pressed={mine}
            aria-label={mine ? 'Quitar mi ❤️' : 'Me apetece'}
            className={`grid size-11 place-items-center rounded-full text-xl transition active:scale-90 ${mine ? 'bg-rose-100' : 'bg-stone-100 grayscale'}`}
          >
            {mine ? '❤️' : '🤍'}
          </button>
        )}
        {item.place && item.status === 'pending' && (
          <DirectionsLink place={item.place} className="grid size-11 place-items-center rounded-full bg-sky-50 text-sky-700 active:scale-90">
            <NavigateIcon className="size-5" />
          </DirectionsLink>
        )}
      </div>
    </div>
  )
}
