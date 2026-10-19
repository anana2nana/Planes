import { STORES, compareChosen, eur, similarSize, type Store } from '../../lib/prices'
import type { ShoppingItem } from '../../lib/shopping'
import { updateShoppingItem } from '../../services/shopping'
import { BottomSheet } from '../BottomSheet'

const ORDER: Store[] = ['mercadona', 'ahorramas']

/** La compra en Mercadona y en Ahorramás, solo con lo que habéis elegido a mano en cada uno. */
export function CompareSheet({
  items,
  onClose,
  onError,
  onChoose,
}: {
  items: ShoppingItem[]
  onClose: () => void
  onError: (m: string) => void
  onChoose: (item: ShoppingItem, store: Store) => void
}) {
  const pending = items.filter((i) => !i.done)
  const totals = compareChosen(pending)
  const buyAt = (item: ShoppingItem, s: Store) => {
    const p = item.options[s]
    if (p) updateShoppingItem(item, { product: p, price: p.price }).catch((e: Error) => onError(e.message))
  }
  const cheapest = () => {
    pending.forEach((i) => {
      const m = i.options.mercadona
      const a = i.options.ahorramas
      if (!m || !a) return
      const best = m.price <= a.price ? m : a
      if (best.id !== i.product?.id) buyAt(i, best.store)
    })
    onError('Listo: cada cosa en el súper donde os sale más barata')
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="⚖️ Comparar la compra"
      footer={
        totals.compared > 0 ? (
          <button onClick={cheapest} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
            Comprar cada cosa donde sale más barata
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {totals.compared > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {ORDER.map((s) => (
                <div key={s} className={`rounded-2xl p-2.5 ${totals.cheaper === s ? 'bg-emerald-50 ring-2 ring-emerald-400' : 'bg-surface shadow-sm'}`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Todo en {STORES[s].label}</p>
                  <p className="tabular text-lg font-extrabold">{eur(totals[s])}</p>
                </div>
              ))}
              <div className="rounded-2xl bg-amber-50 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">En los dos</p>
                <p className="tabular text-lg font-extrabold text-amber-900">{eur(totals.mixed)}</p>
              </div>
            </div>
            <p className="text-center text-sm">
              {totals.cheaper ? (
                <>
                  <b>{STORES[totals.cheaper].label}</b> sale {eur(Math.abs(totals.mercadona - totals.ahorramas))} más barato
                </>
              ) : (
                'Os sale igual en los dos'
              )}
              {totals.mixed < Math.min(totals.mercadona, totals.ahorramas) && <> · yendo a los dos, ahorráis {eur(Math.min(totals.mercadona, totals.ahorramas) - totals.mixed)}</>}
            </p>
            <p className="text-center text-xs text-muted">
              {totals.compared === 1 ? 'Con la única cosa que tiene opción en los dos súper.' : `Con las ${totals.compared} cosas que tienen opción en los dos súper.`}
            </p>
          </>
        ) : (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Elegid vuestra opción en Mercadona y en Ahorramás para cada cosa (abajo, «🔎 Elegir»). La app solo compara lo que hayáis elegido vosotros.
          </p>
        )}

        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-surface">
          {pending.map((item) => {
            const m = item.options.mercadona
            const a = item.options.ahorramas
            const cheaper = m && a ? (m.price < a.price ? 'mercadona' : a.price < m.price ? 'ahorramas' : null) : null
            return (
              <li key={item.id} className="px-3 py-2.5">
                <p className="text-sm font-bold">
                  {item.qty > 1 && <span className="text-muted">{item.qty}× </span>}
                  {item.name}
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {ORDER.map((s) => {
                    const p = item.options[s]
                    if (!p)
                      return (
                        <button key={s} onClick={() => onChoose(item, s)} className="rounded-xl border-2 border-dashed border-stone-200 p-2 text-left text-[11px] font-bold text-muted">
                          🔎 Elegir en {STORES[s].label}
                        </button>
                      )
                    const selected = item.product?.store === s && item.product.id === p.id
                    return (
                      <button
                        key={s}
                        onClick={() => buyAt(item, s)}
                        aria-label={`${item.name}: comprar en ${STORES[s].label} (${eur(p.price)})`}
                        aria-pressed={selected}
                        className={`rounded-xl p-2 text-left ${cheaper === s ? 'bg-emerald-50 ring-1 ring-emerald-400' : 'bg-stone-50'} ${selected ? 'outline outline-2 outline-ink' : ''}`}
                      >
                        <span className="flex items-baseline justify-between gap-1">
                          <span className="text-[10px] font-bold text-muted">{STORES[s].label}</span>
                          <span className="tabular text-sm font-extrabold">{eur(p.price * item.qty)}</span>
                        </span>
                        <span className="line-clamp-2 text-[11px] leading-snug text-muted">
                          {p.name}
                          {p.ref ? ` · ${p.ref}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {m && a && !similarSize(m, a) && <p className="mt-1 text-[11px] font-semibold text-amber-700">Ojo: tamaños distintos, mira el precio por kilo o litro</p>}
              </li>
            )
          })}
        </ul>
        <p className="text-center text-[11px] text-muted">Toca un precio para comprar esa cosa en ese súper (el marco negro es la que vais a comprar).</p>
      </div>
    </BottomSheet>
  )
}
