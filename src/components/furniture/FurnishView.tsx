import { useEffect, useState } from 'react'
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../lib/firebase'
import { arr, num, oneOf, removeItem, saveItem, str, useList } from '../../hooks/useList'
import { useHome } from '../../hooks/useHome'
import { useLayer } from '../../hooks/useLayer'
import { useSheetState } from '../../hooks/useSheetState'
import { warrantyEnd } from '../../lib/due'
import {
  FURN_CATEGORIES,
  ROOMS,
  ROOM_ORDER,
  bothLike,
  chosenOf,
  guessCategory,
  guessRoom,
  plannedByCategory,
  ranked,
  roomSummary,
  stage,
  type FurnCategory,
  type FurnItem,
  type FurnOption,
  type RoomId,
  type Vote,
} from '../../lib/furniture'
import { CATEGORIES, itemTotals } from '../../lib/home'
import type { PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { ChevronIcon, PlusIcon, TrashIcon } from '../Icons'

type Doc = { id?: string } & Record<string, unknown>
const ROOM_IDS = ROOM_ORDER
const vote = (v: unknown): Vote => (v === 1 || v === -1 ? v : 0)
const parseOption = (o: any, i: number): FurnOption => ({
  id: str(o?.id) || String(i),
  title: str(o?.title),
  store: str(o?.store),
  url: str(o?.url),
  image: str(o?.image),
  price: num(o?.price),
  prevPrice: num(o?.prevPrice),
  priceAt: str(o?.priceAt) || null,
  votes: { nita: vote(o?.votes?.nita), kitos: vote(o?.votes?.kitos) },
})
const parse = (id: string, x: Record<string, any>): FurnItem & { createdAt: number } => ({
  id,
  name: str(x.name),
  room: oneOf<RoomId>(x.room, ROOM_IDS, 'otros'),
  category: oneOf<FurnCategory>(x.category, ['muebles', 'electro', 'reforma'], 'muebles'),
  status: x.status === 'bought' ? 'bought' : 'open',
  options: arr(x.options).map(parseOption),
  chosenId: str(x.chosenId) || null,
  boughtPrice: num(x.boughtPrice),
  boughtAt: str(x.boughtAt) || null,
  homeItemId: str(x.homeItemId) || null,
  notes: str(x.notes),
  createdAt: x.createdAt?.toMillis?.() ?? 0,
})
export const useFurniture = () => useList('furniture', parse)

export interface ProductInfo {
  title: string
  image: string
  price: number | null
  store: string
}
/** El servidor lee la página de la tienda (nombre, foto y precio). */
export const fetchProductInfo = async (url: string) => (await httpsCallable<{ url: string }, ProductInfo>(functions, 'productInfo', { timeout: 40_000 })({ url })).data

const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0, useGrouping: 'always' } as Intl.NumberFormatOptions)
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const uid = () => Math.random().toString(36).slice(2, 10)
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const STAGE: Record<ReturnType<typeof stage>, { label: string; tone: string }> = {
  need: { label: 'Buscando', tone: 'bg-stone-100 text-muted' },
  choosing: { label: 'Con opciones', tone: 'bg-sky-50 text-sky-700' },
  chosen: { label: 'Elegido', tone: 'bg-amber-50 text-amber-800' },
  bought: { label: 'Comprado ✓', tone: 'bg-emerald-50 text-emerald-700' },
}
const other = (p: PersonId): PersonId => (p === 'nita' ? 'kitos' : 'nita')

/** Muebles y deco: por habitaciones, opciones de cualquier tienda con vuestros votos, presupuesto y bajadas de precio. */
export function FurnishView({ me, onError, initialUrl }: { me: PersonId; onError: (m: string) => void; initialUrl?: string }) {
  const { items, loading } = useFurniture()
  const { config, items: homeItems } = useHome()
  const [open, setOpen] = useState<string | null>(null)
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'link'; itemId: string | null } | { type: 'need' }>()
  const current = open ? items.find((i) => i.id === open) : undefined
  const planned = plannedByCategory(items)
  const now = new Date()
  const spentIn = (c: FurnCategory) =>
    config ? homeItems.filter((i) => i.category === c).reduce((s, i) => s + itemTotals(i, config, now).total, 0) : items.filter((i) => i.category === c).reduce((s, i) => s + (i.boughtPrice ?? 0), 0)
  const drops = items.flatMap((i) => (i.status === 'bought' ? [] : i.options.filter((o) => o.prevPrice !== null && o.price !== null && o.price < o.prevPrice).map((o) => ({ i, o }))))
  const rooms = roomSummary(items)

  return (
    <div className="space-y-4">
      {/* Presupuesto: lo gastado (MEROE) + lo elegido sin comprar */}
      <div className={card}>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Presupuesto para amueblar</p>
        <div className="mt-2 space-y-3">
          {(Object.keys(FURN_CATEGORIES) as FurnCategory[]).map((c) => {
            const budget = config?.budgets?.[c] ?? 0
            const spent = spentIn(c)
            const plan = planned[c]
            if (!budget && !spent && !plan) return null
            const total = spent + plan
            const max = Math.max(budget, total) || 1
            return (
              <div key={c}>
                <p className="flex justify-between text-sm">
                  <span className="font-semibold">{FURN_CATEGORIES[c]}</span>
                  <span className={`tabular font-bold ${budget && total > budget ? 'text-rose-600' : ''}`}>
                    {eur(total)}
                    {budget ? <span className="font-medium text-muted"> de {eur(budget)}</span> : null}
                  </span>
                </p>
                <div
                  className="mt-1 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-stone-100"
                  role="img"
                  aria-label={`Gastado ${eur(spent)}, elegido ${eur(plan)}${budget ? `, presupuesto ${eur(budget)}` : ''}`}
                >
                  {spent > 0 && <div className="rounded-full" style={{ width: `${(spent / max) * 100}%`, background: CATEGORIES[c].color }} />}
                  {plan > 0 && <div className="rounded-full opacity-40" style={{ width: `${(plan / max) * 100}%`, background: CATEGORIES[c].color }} />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  Gastado {eur(spent)} · elegido sin comprar {eur(plan)}
                  {budget ? (total > budget ? ` · os pasaríais ${eur(total - budget)}` : ` · quedarían ${eur(budget - total)}`) : ''}
                </p>
              </div>
            )
          })}
          {!config?.budgets && <p className="text-xs text-muted">El presupuesto se pone en Hogar → MEROE → Muebles.</p>}
        </div>
      </div>

      {drops.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-emerald-700">📉 Han bajado de precio</h2>
          {drops.map(({ i, o }) => (
            <button key={o.id} onClick={() => setOpen(i.id)} className="flex w-full items-center gap-3 rounded-2xl bg-emerald-50 p-2.5 text-left">
              {o.image ? (
                <img src={o.image} alt="" className="size-11 rounded-xl bg-white object-cover" />
              ) : (
                <span className="grid size-11 place-items-center rounded-xl bg-white text-xl">{ROOMS[i.room].emoji}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{i.name}</span>
                <span className="block truncate text-xs text-emerald-800">
                  {o.store} · <s className="opacity-60">{eur(o.prevPrice!)}</s> → <b>{eur(o.price!)}</b>
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openSheet({ type: 'link', itemId: null })} className="rounded-2xl bg-ink py-3 text-sm font-bold text-cream">
          🔗 Pegar enlace de tienda
        </button>
        <button onClick={() => openSheet({ type: 'need' })} className="flex items-center justify-center gap-1.5 rounded-2xl bg-surface py-3 text-sm font-bold shadow-sm">
          <PlusIcon className="size-4" /> Algo que necesitamos
        </button>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : items.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">
          Apuntad lo que necesitáis para cada habitación (sofá, cama, nevera…) y guardad opciones de cualquier tienda: desde la web o la app de Sklum, Kave Home, IKEA… dadle a{' '}
          <b>Compartir → Nitakitos</b>, o pegad aquí el enlace.
        </p>
      ) : (
        rooms.map((r) => (
          <section key={r.room}>
            <h2 className="mb-2 flex items-baseline justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {ROOMS[r.room].emoji} {ROOMS[r.room].label} · {r.bought}/{r.count}
              </span>
              <span className="tabular text-xs font-semibold text-muted">
                {r.spent > 0 && `${eur(r.spent)} gastado`}
                {r.spent > 0 && r.planned > 0 && ' · '}
                {r.planned > 0 && `${eur(r.planned)} elegido`}
              </span>
            </h2>
            <ul className="space-y-2">
              {items
                .filter((i) => i.room === r.room)
                .sort((a, b) => Number(a.status === 'bought') - Number(b.status === 'bought') || a.name.localeCompare(b.name, 'es'))
                .map((i) => (
                  <li key={i.id}>
                    <ItemCard item={i} onOpen={() => setOpen(i.id)} />
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}

      {sheet?.type === 'link' && (
        <AddLinkSheet
          me={me}
          items={items}
          itemId={sheet.itemId}
          initialUrl={initialUrl}
          onClose={closeSheet}
          onError={onError}
          onSaved={(id) => {
            if (!sheet.itemId) window.addEventListener('popstate', () => setTimeout(() => setOpen(id), 0), { once: true })
          }}
        />
      )}
      {sheet?.type === 'need' && <NeedSheet me={me} item={null} onClose={closeSheet} onError={onError} />}
      {current && <ItemDetail item={current} me={me} onClose={() => setOpen(null)} onError={onError} onAddLink={() => openSheet({ type: 'link', itemId: current.id })} />}
    </div>
  )
}

function ItemCard({ item, onOpen }: { item: FurnItem; onOpen: () => void }) {
  const st = stage(item)
  const top = chosenOf(item) ?? ranked(item.options)[0]
  const liked = item.options.filter(bothLike).length
  return (
    <button onClick={onOpen} className={`${card} flex w-full items-center gap-3 text-left active:scale-[0.99] ${item.status === 'bought' ? 'opacity-70' : ''}`}>
      {top?.image ? (
        <img src={top.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-2xl bg-white object-cover" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-stone-100 text-2xl">{ROOMS[item.room].emoji}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{item.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-bold ${STAGE[st].tone}`}>{STAGE[st].label}</span>
          {item.options.length > 0 && st !== 'bought' && (
            <span className="text-muted">
              {item.options.length} {item.options.length === 1 ? 'opción' : 'opciones'}
              {liked > 0 && ` · ❤️ ${liked}`}
            </span>
          )}
        </span>
      </span>
      <span className="tabular shrink-0 text-right text-sm font-extrabold">
        {item.status === 'bought' ? (item.boughtPrice !== null ? eur(item.boughtPrice) : '') : top?.price != null ? eur(top.price) : ''}
        {top?.prevPrice != null && top.price != null && top.price < top.prevPrice && item.status !== 'bought' && <span className="block text-[10px] font-bold text-emerald-700">📉 bajó</span>}
      </span>
    </button>
  )
}

/** Una necesidad a pantalla completa: sus opciones, los votos, elegir y comprar. */
function ItemDetail({ item, me, onClose, onError, onAddLink }: { item: FurnItem; me: PersonId; onClose: () => void; onError: (m: string) => void; onAddLink: () => void }) {
  const close = useLayer('furniture', onClose)
  const [sheet, openSheet, closeSheet] = useSheetState<'edit' | 'buy'>()
  const update = (patch: Partial<FurnItem>) => saveItem<Doc>('furniture', { id: item.id, ...patch }, me, onError)
  const setOptions = (options: FurnOption[], extra: Partial<FurnItem> = {}) => update({ options, ...extra })
  const setVote = (o: FurnOption, v: Vote) => setOptions(item.options.map((x) => (x.id === o.id ? { ...x, votes: { ...x.votes, [me]: x.votes[me] === v ? 0 : v } } : x)))
  const chosen = chosenOf(item)
  const bought = item.status === 'bought'

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={item.name}>
      <div className="pt-safe bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 px-4 pb-5 text-[#2a2233]">
        <div className="flex items-center justify-between pb-3">
          <button onClick={close} aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-white/40">
            <ChevronIcon className="size-4 rotate-180" />
          </button>
          <button onClick={() => openSheet('edit')} className="rounded-full bg-white/40 px-3.5 py-2 text-xs font-bold">
            Editar
          </button>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">
          {ROOMS[item.room].emoji} {ROOMS[item.room].label} · {FURN_CATEGORIES[item.category]}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{item.name}</h1>
        <p className="text-sm opacity-80">
          {bought
            ? `Comprado${item.boughtPrice !== null ? ` por ${eur(item.boughtPrice)}` : ''}${item.boughtAt ? ` el ${new Date(item.boughtAt + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}`
            : chosen
              ? `Elegido: ${chosen.title}`
              : 'Votad las opciones y elegid una'}
        </p>
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 pb-28 pt-3">
        {item.notes && <p className={`${card} whitespace-pre-line text-sm`}>{item.notes}</p>}
        {ranked(item.options).map((o) => {
          const isChosen = chosen?.id === o.id
          const dropped = o.prevPrice !== null && o.price !== null && o.price < o.prevPrice
          return (
            <div key={o.id} className={`${card} ${isChosen ? 'ring-2 ring-ink' : ''}`}>
              <div className="flex gap-3">
                {o.image ? (
                  <img src={o.image} alt="" loading="lazy" className="size-24 shrink-0 rounded-2xl bg-white object-cover" />
                ) : (
                  <span className="grid size-24 shrink-0 place-items-center rounded-2xl bg-stone-100 text-3xl">{ROOMS[item.room].emoji}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{o.store || 'Tienda'}</p>
                  <p className="line-clamp-3 text-sm font-bold leading-snug">{o.title || 'Sin nombre'}</p>
                  <p className="tabular mt-1 text-lg font-extrabold">
                    {o.price !== null ? eur(o.price) : <span className="text-sm font-semibold text-muted">Sin precio</span>}
                    {dropped && <s className="ml-2 text-sm font-semibold text-muted">{eur(o.prevPrice!)}</s>}
                  </p>
                  {dropped && <p className="text-xs font-bold text-emerald-700">📉 Ha bajado {eur(o.prevPrice! - o.price!)}</p>}
                  {bothLike(o) && <p className="text-xs font-bold text-rose-600">❤️ Os gusta a los dos</p>}
                </div>
              </div>
              {!bought && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 rounded-full bg-stone-50 p-1" role="group" aria-label={`Tu voto a ${o.title}`}>
                    <button
                      onClick={() => setVote(o, 1)}
                      aria-pressed={o.votes[me] === 1}
                      aria-label="Me gusta"
                      className={`grid size-8 place-items-center rounded-full text-base ${o.votes[me] === 1 ? 'bg-emerald-500' : ''}`}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => setVote(o, -1)}
                      aria-pressed={o.votes[me] === -1}
                      aria-label="No me gusta"
                      className={`grid size-8 place-items-center rounded-full text-base ${o.votes[me] === -1 ? 'bg-rose-400' : ''}`}
                    >
                      👎
                    </button>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Avatar mode={other(me)} size="xs" />
                    {o.votes[other(me)] === 1 ? '👍' : o.votes[other(me)] === -1 ? '👎' : 'sin votar'}
                  </span>
                  <span className="flex-1" />
                  <button onClick={() => update({ chosenId: isChosen ? null : o.id })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${isChosen ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
                    {isChosen ? '✓ Elegida' : 'Elegir esta'}
                  </button>
                </div>
              )}
              <div className="mt-2 flex gap-4 text-xs font-semibold">
                {o.url && (
                  <a href={o.url} target="_blank" rel="noreferrer" className="text-sky-700">
                    Ver en la tienda ↗
                  </a>
                )}
                {!bought && (
                  <button
                    onClick={() =>
                      setOptions(
                        item.options.filter((x) => x.id !== o.id),
                        isChosen ? { chosenId: null } : {},
                      )
                    }
                    className="text-muted"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {!bought && (
          <button onClick={onAddLink} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted">
            <PlusIcon className="size-4" /> Añadir otra opción (enlace de tienda)
          </button>
        )}
        {!bought && item.options.length > 0 && <p className="px-2 text-center text-[11px] text-muted">Cada mañana se mira el precio en la tienda y os avisamos si baja.</p>}
      </main>

      {!bought && (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-10 bg-cream/90 px-4 pt-2 backdrop-blur-xl">
          <button onClick={() => openSheet('buy')} className="mb-3 h-13 w-full rounded-2xl bg-ink font-bold text-cream">
            🛒 Ya lo hemos comprado
          </button>
        </div>
      )}
      {sheet === 'edit' && <NeedSheet me={me} item={item} onClose={closeSheet} onError={onError} onDeleted={() => window.addEventListener('popstate', () => setTimeout(close, 0), { once: true })} />}
      {sheet === 'buy' && <BuySheet item={item} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

/** Pegar (o compartir) el enlace de un producto: se lee nombre, foto y precio, y se guarda como opción. */
export function AddLinkSheet({
  me,
  items,
  itemId,
  initialUrl,
  onClose,
  onError,
  onSaved,
}: {
  me: PersonId
  items: FurnItem[]
  itemId: string | null
  initialUrl?: string
  onClose: () => void
  onError: (m: string) => void
  onSaved?: (id: string) => void
}) {
  const [url, setUrl] = useState(initialUrl ?? '')
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<ProductInfo | null>(null)
  const [failed, setFailed] = useState(false)
  const [price, setPrice] = useState('')
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState<string>(itemId ?? 'new')
  const [name, setName] = useState('')
  const [room, setRoom] = useState<RoomId>('salon')
  const [category, setCategory] = useState<FurnCategory>('muebles')
  const openItems = items.filter((i) => i.status !== 'bought')

  const read = async (u = url) => {
    if (!/^https?:\/\//i.test(u.trim())) return
    setLoading(true)
    setFailed(false)
    try {
      const p = await fetchProductInfo(u.trim())
      setInfo(p)
      setTitle(p.title)
      setPrice(p.price !== null ? String(p.price).replace('.', ',') : '')
      // ¿Para qué es? Si ya hay una necesidad parecida, esa; si no, una nueva con la habitación que suene.
      if (!itemId) {
        const r = guessRoom(p.title)
        const match = openItems.find((i) => p.title.toLowerCase().includes(i.name.toLowerCase().split(' ')[0]))
        setTarget(match?.id ?? 'new')
        setName(
          p.title
            .split(/[,|–-]/)[0]
            .split(' ')
            .slice(0, 3)
            .join(' '),
        )
        setRoom(r)
        setCategory(guessCategory(p.title))
      }
    } catch {
      setFailed(true)
      setInfo({ title: '', image: '', price: null, store: '' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (initialUrl) void read(initialUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const priceNum = price.trim() ? Number(price.replace('€', '').replace(/\./g, '').replace(',', '.')) : null
  const canSave = info && (title.trim() || url.trim()) && (target !== 'new' || name.trim())
  const save = () => {
    if (!canSave || !info) return
    let host = ''
    try {
      host = new URL(url.trim()).hostname.replace(/^www\./, '')
    } catch {
      /* sin tienda */
    }
    const option: FurnOption = {
      id: uid(),
      title: title.trim().slice(0, 120),
      store: info.store || host,
      url: url.trim(),
      image: info.image,
      price: priceNum !== null && Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 100) / 100 : null,
      prevPrice: null,
      priceAt: today(),
      votes: { nita: 0, kitos: 0, [me]: 1 } as FurnOption['votes'],
    }
    const existing = items.find((i) => i.id === target)
    const id = existing
      ? saveItem<Doc>('furniture', { id: existing.id, options: [...existing.options, option].slice(-12) }, me, onError)
      : saveItem<Doc>(
          'furniture',
          { name: name.trim().slice(0, 80), room, category, status: 'open', options: [option], chosenId: null, boughtPrice: null, boughtAt: null, homeItemId: null, notes: '' },
          me,
          onError,
        )
    onSaved?.(id)
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Guardar de una tienda"
      footer={
        info ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            Guardar opción
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            placeholder="https://www.sklum.com/…"
            aria-label="Enlace del producto"
            className={input}
            autoFocus={!initialUrl}
          />
          <button onClick={() => read()} disabled={loading || !/^https?:\/\//i.test(url.trim())} className="shrink-0 rounded-xl bg-ink px-4 text-sm font-bold text-cream disabled:opacity-30">
            {loading ? '…' : 'Leer'}
          </button>
        </div>
        {loading && <p className="text-sm text-muted">Mirando la página de la tienda…</p>}
        {failed && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">No he podido leer esa página. Escribe tú el nombre y el precio y se guarda igual con su enlace.</p>}
        {info && (
          <>
            <div className="flex gap-3">
              {info.image ? (
                <img src={info.image} alt="" className="size-20 shrink-0 rounded-2xl bg-white object-cover" />
              ) : (
                <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-stone-100 text-3xl">🛋️</span>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                {info.store && <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{info.store}</p>}
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre del producto"
                  aria-label="Nombre del producto"
                  maxLength={120}
                  className={`${input} h-10 text-sm`}
                />
                <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="Precio (€)" aria-label="Precio" className={`${input} h-10 text-sm`} />
              </div>
            </div>
            {!itemId && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted">¿Para qué es?</p>
                <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Para qué es" className={input}>
                  <option value="new">➕ Algo nuevo…</option>
                  {openItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {ROOMS[i.room].emoji} {i.name} ({i.options.length} {i.options.length === 1 ? 'opción' : 'opciones'})
                    </option>
                  ))}
                </select>
                {target === 'new' && (
                  <div className="mt-2 space-y-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Qué necesitáis: Sofá, Cama, Nevera…" aria-label="Qué necesitáis" maxLength={80} className={input} />
                    <RoomPicker value={room} onChange={setRoom} />
                    <CategoryPicker value={category} onChange={setCategory} />
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-muted">Se guarda con tu 👍 (luego podéis votar los dos).</p>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

function RoomPicker({ value, onChange }: { value: RoomId; onChange: (r: RoomId) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Habitación">
      {ROOM_ORDER.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${value === r ? 'bg-ink text-cream' : 'bg-stone-100'}`}
        >
          {ROOMS[r].emoji} {ROOMS[r].label}
        </button>
      ))}
    </div>
  )
}

function CategoryPicker({ value, onChange }: { value: FurnCategory; onChange: (c: FurnCategory) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Presupuesto">
      {(Object.keys(FURN_CATEGORIES) as FurnCategory[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={`h-9 rounded-xl text-[11px] font-bold ${value === c ? 'bg-surface shadow-sm' : 'text-muted'}`}
        >
          {FURN_CATEGORIES[c]}
        </button>
      ))}
    </div>
  )
}

/** Crear o editar una necesidad ("Sofá" en el salón). */
function NeedSheet({ me, item, onClose, onError, onDeleted }: { me: PersonId; item: FurnItem | null; onClose: () => void; onError: (m: string) => void; onDeleted?: () => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [room, setRoom] = useState<RoomId>(item?.room ?? 'salon')
  const [category, setCategory] = useState<FurnCategory>(item?.category ?? 'muebles')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [confirm, setConfirm] = useState(false)
  const save = () => {
    if (!name.trim()) return
    saveItem<Doc>(
      'furniture',
      item
        ? { id: item.id, name: name.trim().slice(0, 80), room, category, notes: notes.trim() }
        : { name: name.trim().slice(0, 80), room, category, notes: notes.trim(), status: 'open', options: [], chosenId: null, boughtPrice: null, boughtAt: null, homeItemId: null },
      me,
      onError,
    )
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item ? 'Editar' : 'Algo que necesitamos'}
      footer={
        <button onClick={save} disabled={!name.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!item) {
              setRoom(guessRoom(e.target.value))
              setCategory(guessCategory(e.target.value))
            }
          }}
          autoFocus={!item}
          placeholder="Sofá, cama 150, nevera, lámpara de pie…"
          aria-label="Qué necesitáis"
          maxLength={80}
          className={input}
        />
        <RoomPicker value={room} onChange={setRoom} />
        <CategoryPicker value={category} onChange={setCategory} />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notas: medidas del hueco, color, que sea desenfundable…"
          aria-label="Notas"
          className="w-full rounded-xl border border-stone-200 bg-surface p-3 text-sm outline-none focus:border-both"
        />
        {item &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrarlo con sus opciones?{item.homeItemId ? ' El gasto de MEROE se queda.' : ''}</p>
              <button
                onClick={() => {
                  removeItem('furniture', item.id).catch((e: Error) => onError(e.message))
                  onDeleted?.()
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

/** "Ya lo hemos comprado": apunta el gasto en MEROE (con su presupuesto) y la garantía en Papeles. */
function BuySheet({ item, me, onClose, onError }: { item: FurnItem; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const best = chosenOf(item) ?? ranked(item.options)[0] ?? null
  const [optionId, setOptionId] = useState<string | null>(best?.id ?? null)
  const opt = item.options.find((o) => o.id === optionId) ?? null
  const [price, setPrice] = useState(best?.price != null ? String(best.price).replace('.', ',') : '')
  const [date, setDate] = useState(today())
  const [warranty, setWarranty] = useState(true)
  const priceNum = Number(price.replace('€', '').replace(/\./g, '').replace(',', '.'))
  const ok = price.trim() !== '' && Number.isFinite(priceNum) && priceNum >= 0
  const save = () => {
    if (!ok) return
    const store = opt?.store ?? ''
    // El gasto en MEROE (así cuenta en el presupuesto y en "¿Llegamos?").
    const ref = doc(collection(db, 'homeItems'))
    setDoc(ref, {
      title: `${item.name}${store ? ` · ${store}` : ''}`.slice(0, 80),
      category: item.category,
      amount: { type: 'fixed', value: Math.round(priceNum * 100) / 100 },
      monthly: null,
      date,
      paid: true,
      countsTowardPrice: false,
      income: false,
      notes: opt?.url ?? '',
      order: Date.now() / 1e6,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: me,
    }).catch((e: Error) => onError(e.message))
    if (warranty)
      saveItem<Doc>(
        'papers',
        {
          kind: 'garantia',
          title: `${item.name}${opt?.title ? ` (${opt.title})` : ''}`.slice(0, 80),
          owner: 'both',
          bought: date,
          expires: warrantyEnd(date, 3),
          store,
          price: Math.round(priceNum * 100) / 100,
          ref: '',
          notes: opt?.url ?? '',
          hasPhoto: false,
        },
        me,
        onError,
      )
    saveItem<Doc>('furniture', { id: item.id, status: 'bought', chosenId: optionId, boughtPrice: Math.round(priceNum * 100) / 100, boughtAt: date, homeItemId: ref.id }, me, onError)
    onError(`🛒 ${item.name}: apuntado en los gastos de MEROE${warranty ? ' y la garantía en Papeles' : ''}`)
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Comprado: ${item.name}`}
      footer={
        <button onClick={save} disabled={!ok} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Apuntar compra
        </button>
      }
    >
      <div className="space-y-4">
        {item.options.length > 0 && (
          <select
            value={optionId ?? ''}
            onChange={(e) => {
              setOptionId(e.target.value || null)
              const o = item.options.find((x) => x.id === e.target.value)
              if (o?.price != null) setPrice(String(o.price).replace('.', ','))
            }}
            aria-label="Cuál habéis comprado"
            className={input}
          >
            {item.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.store ? `${o.store}: ` : ''}
                {o.title}
              </option>
            ))}
            <option value="">Otro</option>
          </select>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-muted">
            Lo que os costó
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0 €" aria-label="Precio pagado" className={input} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Día
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Día de compra" className={input} />
          </label>
        </div>
        <label className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3 text-sm">
          <input type="checkbox" checked={warranty} onChange={(e) => setWarranty(e.target.checked)} className="size-5" />
          <span>
            <b>Guardar la garantía en Papeles</b>
            <span className="block text-xs text-muted">3 años desde la compra; os avisa antes de que caduque</span>
          </span>
        </label>
        <p className="text-xs text-muted">Se apunta como gasto de {CATEGORIES[item.category].label.toLowerCase()} en MEROE (cuenta en el presupuesto). Allí le podéis añadir la foto del ticket.</p>
      </div>
    </BottomSheet>
  )
}

/** Resumen para la baldosa de Hogar. */
export function useFurnitureSummary() {
  const { items } = useFurniture()
  const open = items.filter((i) => i.status !== 'bought')
  const drops = open.reduce((n, i) => n + i.options.filter((o) => o.prevPrice !== null && o.price !== null && o.price < o.prevPrice).length, 0)
  return { total: items.length, open: open.length, chosen: open.filter((i) => chosenOf(i)).length, drops }
}
