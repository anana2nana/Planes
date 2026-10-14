import { useMemo, useState } from 'react'
import { useShopping } from '../hooks/useShopping'
import { SECTIONS, SECTION_ORDER, itemKey, type SectionId, type ShoppingItem } from '../lib/shopping'
import type { PersonId } from '../lib/types'
import { addShoppingItem, clearBought, deleteShoppingItem, toggleShoppingItem } from '../services/shopping'
import { Avatar } from './Avatar'
import { useSheetState } from '../hooks/useSheetState'
import { eur, shoppingTotal, type Product } from '../lib/prices'
import { BottomSheet } from './BottomSheet'
import { ItemSheet } from './shopping/ItemSheet'
import { ProductPicker } from './shopping/ProductPicker'
import { CheckIcon, CloseIcon, PlusIcon } from './Icons'

export function ShoppingView({ me, onToast }: { me: PersonId; onToast: (m: string) => void }) {
  const { items, frequent, loading } = useShopping()
  const [text, setText] = useState('')
  const [section, setSection] = useState<SectionId>('super')
  const [showBought, setShowBought] = useState(false)
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'item'; id: string } | { type: 'search'; q: string }>()

  const pending = items.filter((i) => !i.done)
  const bought = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
  const pendingKeys = useMemo(() => new Set(pending.map((i) => itemKey(i.name))), [pending])

  // Si lo que escribes ya lo habéis comprado antes, se usa su sección de siempre.
  const remembered = frequent.find((f) => f.key === itemKey(text))
  const effectiveSection = remembered?.section ?? section

  const suggestions = frequent.filter((f) => !pendingKeys.has(f.key)).slice(0, 12)
  const typed = itemKey(text)
  const matching = typed ? frequent.filter((f) => f.key.includes(typed) && !pendingKeys.has(f.key) && f.key !== typed).slice(0, 4) : []

  const add = (name: string, sec: SectionId, product?: Product) => {
    if (!name.trim()) return
    // Con producto elegido, su precio; si no, el de la última vez.
    const last = frequent.find((f) => f.key === itemKey(name))
    const extra = product ? { price: product.price, product } : last?.price != null ? { price: last.price, product: last.product } : {}
    const ok = addShoppingItem(name, sec, me, items, extra)
    if (!ok) onToast(`«${name.trim()}» ya está en la lista`)
    else navigator.vibrate?.(8)
    setText('')
  }

  const total = shoppingTotal(items)
  const editing = sheet?.type === 'item' ? items.find((i) => i.id === sheet.id) : undefined

  const grouped = SECTION_ORDER.map((s) => ({ id: s, items: pending.filter((i) => i.section === s).sort((a, b) => a.createdAt - b.createdAt) })).filter(
    (g) => g.items.length > 0,
  )

  return (
    <div className="space-y-5">
      {/* Añadir */}
      <div className="sticky top-[calc(max(env(safe-area-inset-top),0.75rem)+4.5rem)] z-20 -mx-4 space-y-2 bg-cream/90 px-4 pb-2 pt-1 backdrop-blur-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(text, effectiveSection)
          }}
          className="flex items-center gap-2 rounded-2xl bg-surface p-1.5 pl-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.12)] focus-within:ring-2 focus-within:ring-both/40"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Añadir… (leche, pienso, pilas)"
            aria-label="Añadir a la lista"
            enterKeyHint="done"
            autoComplete="off"
            className="h-11 min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-medium placeholder:text-stone-300"
          />
          <button type="submit" disabled={!text.trim()} aria-label="Añadir" className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-cream transition active:scale-90 disabled:opacity-20">
            <PlusIcon className="size-5" strokeWidth={2.5} />
          </button>
        </form>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4" role="radiogroup" aria-label="Sección">
          {SECTION_ORDER.map((s) => {
            const active = effectiveSection === s
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSection(s)}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${active ? 'bg-ink text-cream' : 'bg-surface text-ink shadow-sm'}`}
              >
                <span aria-hidden>{SECTIONS[s].emoji}</span> {SECTIONS[s].label}
              </button>
            )
          })}
        </div>
        {text.trim().length >= 2 && (
          <button type="button" onClick={() => openSheet({ type: 'search', q: text.trim() })} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 active:scale-95">
            🔎 Buscar «{text.trim()}» en Mercadona o Ahorramás
          </button>
        )}
        {matching.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {matching.map((f) => (
              <button key={f.key} type="button" onClick={() => add(f.name, f.section)} className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 active:scale-95">
                + {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-3xl bg-surface/70" />
      ) : pending.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-5xl">🧺</div>
          <p className="mt-3 font-bold">La lista está vacía</p>
          <p className="mt-1 text-sm text-muted">Lo que añada uno le aparece al otro al momento.</p>
        </div>
      ) : (
        <>
          {total.priced > 0 && (
            <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg shadow-emerald-300/30">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold uppercase tracking-wider opacity-90">Total aproximado</span>
                <span className="tabular block text-3xl font-extrabold">{eur(total.total)}</span>
              </span>
              <span className="text-right text-xs opacity-90">
                {total.priced === total.count ? 'Todo con precio' : `${total.priced} de ${total.count} con precio`}
                {total.priced < total.count && <span className="block">Toca una cosa para ponérselo</span>}
              </span>
            </div>
          )}
          {grouped.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
              {SECTIONS[g.id].emoji} {SECTIONS[g.id].label} <span className="opacity-60">· {g.items.length}</span>
            </h2>
            <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
              {g.items.map((i) => (
                <Row key={i.id} item={i} me={me} onOpen={() => openSheet({ type: 'item', id: i.id })} />
              ))}
            </div>
          </section>
          ))}
        </>
      )}

      {/* Lo de siempre */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">Lo de siempre</h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((f) => (
              <button
                key={f.key}
                onClick={() => add(f.name, f.section)}
                className="flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold shadow-sm transition active:scale-95"
              >
                <span aria-hidden className="text-xs">
                  {SECTIONS[f.section].emoji}
                </span>
                {f.name}
                <PlusIcon className="size-3.5 text-muted" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Comprado */}
      {bought.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <button onClick={() => setShowBought((v) => !v)} className="text-xs font-bold uppercase tracking-wider text-muted" aria-expanded={showBought}>
              {showBought ? '▾' : '▸'} Comprado · {bought.length}
            </button>
            <button
              onClick={() => clearBought(items).catch((e: Error) => onToast(e.message))}
              className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-rose-600 shadow-sm active:scale-95"
            >
              Vaciar comprados
            </button>
          </div>
          {showBought && (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface/70">
              {bought.map((i) => (
                <Row key={i.id} item={i} me={me} onOpen={() => openSheet({ type: 'item', id: i.id })} />
              ))}
            </div>
          )}
        </section>
      )}
      {editing && <ItemSheet key={editing.id} item={editing} onClose={closeSheet} onError={onToast} />}
      {sheet?.type === 'search' && (
        <BottomSheet open onClose={closeSheet} title="Añadir del súper">
          <ProductPicker
            initial={sheet.q}
            onPick={(p) => {
              add(sheet.q, effectiveSection, p)
              closeSheet()
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}

function Row({ item, me, onOpen }: { item: ShoppingItem; me: PersonId; onOpen: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button
        onClick={() => {
          navigator.vibrate?.(10)
          toggleShoppingItem(item, me).catch(console.error)
        }}
        aria-label={item.done ? `Volver a poner ${item.name}` : `Marcar ${item.name} como comprado`}
        aria-pressed={item.done}
        className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
          item.done ? 'border-transparent bg-emerald-500 text-white' : 'border-stone-300'
        }`}
      >
        {item.done && <CheckIcon className="size-3.5 animate-pop" />}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`${item.name}: precio y cantidad`}>
        <span className={`block truncate text-[15px] font-semibold ${item.done ? 'text-muted line-through' : ''}`}>
          {item.qty > 1 && <span className="mr-1 text-muted">{item.qty}×</span>}
          {item.name}
        </span>
        {item.product && (
          <span className="block truncate text-[11px] text-muted">
            {item.product.name}
            {item.product.pack ? ` · ${item.product.pack}` : ''}
          </span>
        )}
      </button>
      {item.price !== null ? (
        <span className={`tabular shrink-0 text-sm font-bold ${item.done ? 'text-muted' : ''}`}>{eur(item.price * item.qty)}</span>
      ) : (
        !item.done && (
          <button onClick={onOpen} className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-muted" aria-label={`Poner precio a ${item.name}`}>
            + €
          </button>
        )
      )}
      {item.addedBy && !item.done && <Avatar mode={item.addedBy} size="xs" />}
      <button onClick={() => deleteShoppingItem(item.id).catch(console.error)} aria-label={`Quitar ${item.name}`} className="grid size-8 shrink-0 place-items-center rounded-full text-stone-300 active:bg-stone-100">
        <CloseIcon className="size-4" />
      </button>
    </div>
  )
}
