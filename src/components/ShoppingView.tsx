import { useMemo, useState } from 'react'
import { useShopping } from '../hooks/useShopping'
import { SECTIONS, SECTION_ORDER, itemKey, type SectionId, type ShoppingItem } from '../lib/shopping'
import type { PersonId } from '../lib/types'
import { addShoppingItem, clearBought, deleteShoppingItem, toggleShoppingItem } from '../services/shopping'
import { Avatar } from './Avatar'
import { CheckIcon, CloseIcon, PlusIcon } from './Icons'

export function ShoppingView({ me, onToast }: { me: PersonId; onToast: (m: string) => void }) {
  const { items, frequent, loading } = useShopping()
  const [text, setText] = useState('')
  const [section, setSection] = useState<SectionId>('super')
  const [showBought, setShowBought] = useState(false)

  const pending = items.filter((i) => !i.done)
  const bought = items.filter((i) => i.done).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
  const pendingKeys = useMemo(() => new Set(pending.map((i) => itemKey(i.name))), [pending])

  // Si lo que escribes ya lo habéis comprado antes, se usa su sección de siempre.
  const remembered = frequent.find((f) => f.key === itemKey(text))
  const effectiveSection = remembered?.section ?? section

  const suggestions = frequent.filter((f) => !pendingKeys.has(f.key)).slice(0, 12)
  const typed = itemKey(text)
  const matching = typed ? frequent.filter((f) => f.key.includes(typed) && !pendingKeys.has(f.key) && f.key !== typed).slice(0, 4) : []

  const add = (name: string, sec: SectionId) => {
    if (!name.trim()) return
    const ok = addShoppingItem(name, sec, me, items)
    if (!ok) onToast(`«${name.trim()}» ya está en la lista`)
    else navigator.vibrate?.(8)
    setText('')
  }

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
          className="flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.12)] focus-within:ring-2 focus-within:ring-both/40"
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
          <button type="submit" disabled={!text.trim()} aria-label="Añadir" className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white transition active:scale-90 disabled:opacity-20">
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
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${active ? 'bg-ink text-white' : 'bg-white text-ink shadow-sm'}`}
              >
                <span aria-hidden>{SECTIONS[s].emoji}</span> {SECTIONS[s].label}
              </button>
            )
          })}
        </div>
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
        <div className="h-24 animate-pulse rounded-3xl bg-white/70" />
      ) : pending.length === 0 ? (
        <div className="py-10 text-center">
          <div className="text-5xl">🧺</div>
          <p className="mt-3 font-bold">La lista está vacía</p>
          <p className="mt-1 text-sm text-muted">Lo que añada uno le aparece al otro al momento.</p>
        </div>
      ) : (
        grouped.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">
              {SECTIONS[g.id].emoji} {SECTIONS[g.id].label} <span className="opacity-60">· {g.items.length}</span>
            </h2>
            <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
              {g.items.map((i) => (
                <Row key={i.id} item={i} me={me} />
              ))}
            </div>
          </section>
        ))
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
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-sm transition active:scale-95"
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
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-600 shadow-sm active:scale-95"
            >
              Vaciar comprados
            </button>
          </div>
          {showBought && (
            <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white/70">
              {bought.map((i) => (
                <Row key={i.id} item={i} me={me} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Row({ item, me }: { item: ShoppingItem; me: PersonId }) {
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
      <span className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${item.done ? 'text-muted line-through' : ''}`}>{item.name}</span>
      {item.addedBy && !item.done && <Avatar mode={item.addedBy} size="xs" />}
      <button onClick={() => deleteShoppingItem(item.id).catch(console.error)} aria-label={`Quitar ${item.name}`} className="grid size-8 shrink-0 place-items-center rounded-full text-stone-300 active:bg-stone-100">
        <CloseIcon className="size-4" />
      </button>
    </div>
  )
}
