import { useState } from 'react'
import { STORES, eur, parsePrice, thumb, type Product } from '../../lib/prices'
import type { ShoppingItem } from '../../lib/shopping'
import { updateShoppingItem } from '../../services/shopping'
import { BottomSheet } from '../BottomSheet'
import { ProductPicker } from './ProductPicker'

/** Precio, cantidad y producto de algo de la lista. */
export function ItemSheet({ item, onClose, onError }: { item: ShoppingItem; onClose: () => void; onError: (m: string) => void }) {
  const [picking, setPicking] = useState(false)
  const [product, setProduct] = useState<Product | null>(item.product)
  const [price, setPrice] = useState(item.price !== null ? String(item.price).replace('.', ',') : '')
  const [qty, setQty] = useState(item.qty)
  const parsed = parsePrice(price)
  const dirty = product?.id !== item.product?.id || parsed !== item.price || qty !== item.qty

  const save = () => {
    updateShoppingItem(item, { product, price: parsed, qty }).catch((e: Error) => onError(e.message))
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={picking ? `Buscar «${item.name}»` : item.name}
      footer={
        !picking && dirty ? (
          <button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
            Guardar
          </button>
        ) : undefined
      }
    >
      {picking ? (
        <ProductPicker
          initial={item.name}
          onPick={(p) => {
            setProduct(p)
            setPrice(String(p.price).replace('.', ','))
            setPicking(false)
          }}
        />
      ) : (
        <div className="space-y-4">
          {product ? (
            <div className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
              {product.image ? (
                <img src={thumb(product.image)} alt="" className="size-14 shrink-0 rounded-xl bg-white object-contain" />
              ) : (
                <span className="grid size-14 place-items-center rounded-xl bg-stone-100 text-2xl">🛒</span>
              )}
              <span className="min-w-0 flex-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STORES[product.store].color}`}>{STORES[product.store].label}</span>
                <span className="block text-sm font-semibold leading-snug">{product.name}</span>
                <span className="block text-xs text-muted">{[product.pack, product.ref, eur(product.price)].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPicking(true)} className="rounded-2xl bg-emerald-50 py-3 text-sm font-bold text-emerald-700">
              🔎 {product ? 'Cambiar producto' : 'Buscar en el súper'}
            </button>
            {product ? (
              <button onClick={() => setProduct(null)} className="rounded-2xl bg-stone-100 py-3 text-sm font-bold text-muted">
                Quitar producto
              </button>
            ) : (
              <span className="self-center text-xs text-muted">Mercadona o Ahorramás, con su precio</span>
            )}
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
          <p className="text-xs text-muted">El precio se recuerda: la próxima vez que añadáis «{item.name}» saldrá ya puesto.</p>
        </div>
      )}
    </BottomSheet>
  )
}
