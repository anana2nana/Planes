import { useState } from 'react'
import { STORES, eur, parsePrice, similarSize, thumb, type Options, type Product, type Store } from '../../lib/prices'
import type { ShoppingItem } from '../../lib/shopping'
import { updateShoppingItem } from '../../services/shopping'
import { BottomSheet } from '../BottomSheet'
import { ProductPicker } from './ProductPicker'

const ORDER: Store[] = ['mercadona', 'ahorramas']

/** Precio, cantidad y, para comparar, la opción que elijáis a mano en cada súper. */
export function ItemSheet({ item, onClose, onError, startPicking }: { item: ShoppingItem; onClose: () => void; onError: (m: string) => void; startPicking?: Store }) {
  const [picking, setPicking] = useState<Store | null>(startPicking ?? null)
  const [options, setOptions] = useState<Options>(item.options)
  const [product, setProduct] = useState<Product | null>(item.product)
  const [price, setPrice] = useState(item.price !== null ? String(item.price).replace('.', ',') : '')
  const [qty, setQty] = useState(item.qty)
  const parsed = parsePrice(price)
  const dirty = JSON.stringify(options) !== JSON.stringify(item.options) || product?.id !== item.product?.id || parsed !== item.price || qty !== item.qty

  const use = (p: Product | null) => {
    setProduct(p)
    if (p) setPrice(String(p.price).replace('.', ','))
  }
  const pick = (s: Store, p: Product) => {
    setOptions((o) => ({ ...o, [s]: p }))
    // La primera opción (o la del mismo súper que la que ibais a comprar) pasa a ser la que se compra.
    if (!product || product.store === s) use(p)
    setPicking(null)
  }
  const remove = (s: Store) => {
    const rest = { ...options }
    delete rest[s]
    setOptions(rest)
    if (product?.store === s) use(rest[s === 'mercadona' ? 'ahorramas' : 'mercadona'] ?? null)
  }
  const save = () => {
    updateShoppingItem(item, { options, product, price: parsed, qty }).catch((e: Error) => onError(e.message))
    onClose()
  }

  const m = options.mercadona
  const a = options.ahorramas
  const cheaper: Store | null = m && a ? (m.price < a.price ? 'mercadona' : a.price < m.price ? 'ahorramas' : null) : null

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={picking ? `«${item.name}» en ${STORES[picking].label}` : item.name}
      footer={
        !picking && dirty ? (
          <button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
            Guardar
          </button>
        ) : undefined
      }
    >
      {picking ? (
        <div className="space-y-3">
          <ProductPicker only={picking} initial={options[picking] ? '' : item.name} onPick={(p) => pick(picking, p)} />
          <button onClick={() => setPicking(null)} className="mx-auto block text-sm font-semibold text-muted">
            Volver
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Elige tu opción en cada súper y toca la que vais a comprar</p>
            <div className="grid grid-cols-2 gap-2">
              {ORDER.map((s) => {
                const p = options[s]
                if (!p)
                  return (
                    <button
                      key={s}
                      onClick={() => setPicking(s)}
                      className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-stone-200 p-3 text-center"
                    >
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STORES[s].color}`}>{STORES[s].label}</span>
                      <span className="text-sm font-bold text-muted">🔎 Elegir</span>
                    </button>
                  )
                const selected = product?.store === s && product.id === p.id
                return (
                  <div key={s} className={`flex flex-col rounded-2xl p-2.5 ${selected ? 'bg-surface ring-2 ring-ink' : 'bg-stone-50'}`}>
                    <button onClick={() => use(p)} className="flex flex-1 flex-col text-left" aria-label={`Comprar en ${STORES[s].label}: ${p.name}`} aria-pressed={selected}>
                      <span className="flex items-center justify-between gap-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STORES[s].color}`}>{STORES[s].label}</span>
                        {cheaper === s && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">Más barato</span>}
                      </span>
                      {p.image && <img src={thumb(p.image)} alt="" className="mx-auto mt-1.5 size-12 rounded-lg bg-white object-contain" />}
                      <span className="mt-1 line-clamp-3 text-xs font-semibold leading-snug">{p.name}</span>
                      <span className="text-[11px] text-muted">{[p.pack, p.ref].filter(Boolean).join(' · ')}</span>
                      <span className="tabular mt-auto pt-1 text-lg font-extrabold">{eur(p.price)}</span>
                      {selected && <span className="text-[11px] font-bold">✓ La que compráis</span>}
                    </button>
                    <span className="mt-1 flex gap-3 text-[11px] font-semibold text-muted">
                      <button onClick={() => setPicking(s)}>Cambiar</button>
                      <button onClick={() => remove(s)}>Quitar</button>
                    </span>
                  </div>
                )
              })}
            </div>
            {m && a && !similarSize(m, a) && <p className="mt-2 text-xs font-semibold text-amber-700">Ojo: no son del mismo tamaño. Mira el precio por kilo o litro.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted">
              Precio (cada uno)
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0,00 €"
                aria-label="Precio"
                className="mt-1 h-12 w-full rounded-xl border border-stone-200 bg-surface px-3 text-lg font-bold text-ink outline-none focus:border-both"
              />
            </label>
            <div className="text-xs font-semibold text-muted">
              Cantidad
              <div className="mt-1 flex h-12 items-center justify-between rounded-xl border border-stone-200 bg-surface px-1">
                <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Una menos" className="grid size-10 place-items-center rounded-lg text-xl font-bold text-ink active:bg-stone-100">
                  −
                </button>
                <span className="tabular text-lg font-bold text-ink" aria-label="Cantidad">
                  {qty}
                </span>
                <button onClick={() => setQty((n) => Math.min(99, n + 1))} aria-label="Una más" className="grid size-10 place-items-center rounded-lg text-xl font-bold text-ink active:bg-stone-100">
                  +
                </button>
              </div>
            </div>
          </div>
          {parsed !== null && qty > 1 && (
            <p className="text-sm text-muted">
              Total: <b className="text-ink">{eur(parsed * qty)}</b>
            </p>
          )}
          {price.trim() !== '' && parsed === null && <p className="text-sm text-rose-600">Ese precio no se entiende (p. ej. 1,25)</p>}
          <p className="text-xs text-muted">Se recuerda todo: la próxima vez que añadáis «{item.name}» saldrán ya vuestras opciones y su precio.</p>
        </div>
      )}
    </BottomSheet>
  )
}
