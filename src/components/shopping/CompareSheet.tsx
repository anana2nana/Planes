import { useEffect, useState } from 'react'
import { STORES, bestMatch, compareQuery, compareTotals, eur, searchCatalog, type CompareRow, type Product, type Store } from '../../lib/prices'
import type { ShoppingItem } from '../../lib/shopping'
import { loadMercadona, searchAhorramas } from '../../services/prices'
import { updateShoppingItem } from '../../services/shopping'
import { BottomSheet } from '../BottomSheet'

/** Buscar con menos palabras si con todas no sale nada ("leche semidesnatada sin lactosa" → "leche semidesnatada"…). */
async function findWith(query: string, search: (q: string) => Promise<Product[]> | Product[]): Promise<Product[]> {
  const words = query.split(' ').filter(Boolean)
  for (let n = words.length; n >= 1; n--) {
    const res = await search(words.slice(0, n).join(' '))
    if (res.length) return res
  }
  return []
}

/** Toda la lista en Mercadona y en Ahorramás: lo equivalente de cada cosa y los totales. */
export function CompareSheet({ items, onClose, onError }: { items: ShoppingItem[]; onClose: () => void; onError: (m: string) => void }) {
  const pending = items.filter((i) => !i.done)
  const [rows, setRows] = useState<Record<string, CompareRow>>({})
  const [done, setDone] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const run = async () => {
      const catalog = await loadMercadona().catch(() => null)
      const queue = [...pending]
      const work = async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
          const own = item.product
          const query = compareQuery(own?.name ?? item.name) || item.name.toLowerCase()
          const pick = async (store: Store) => {
            if (own?.store === store) return own
            const found =
              store === 'mercadona'
                ? await findWith(query, (q) => searchCatalog(catalog?.items ?? [], q, 12))
                : await findWith(query, (q) =>
                    searchAhorramas(q).catch(() => {
                      setFailed(true)
                      return []
                    }),
                  )
            return bestMatch(found, own)
          }
          const [mercadona, ahorramas] = await Promise.all([pick('mercadona'), pick('ahorramas')])
          if (!alive) return
          setRows((r) => ({ ...r, [item!.id]: { key: item!.id, qty: item!.qty, mercadona, ahorramas } }))
          setDone((n) => n + 1)
        }
      }
      // De 4 en 4 (Ahorramás va por su web y tarda un poco).
      await Promise.all([work(), work(), work(), work()])
    }
    run()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = pending.map((i) => ({ item: i, row: rows[i.id] }))
  const totals = compareTotals(list.flatMap((x) => (x.row ? [x.row] : [])))
  const choose = (item: ShoppingItem, p: Product) => updateShoppingItem(item, { product: p, price: p.price }).catch((e: Error) => onError(e.message))
  const cheapest = () => {
    list.forEach(({ item, row }) => {
      if (!row?.mercadona || !row.ahorramas) return
      const best = row.mercadona.price <= row.ahorramas.price ? row.mercadona : row.ahorramas
      if (best.id !== item.product?.id) choose(item, best)
    })
    onError('Listo: cada cosa con su precio más barato')
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="⚖️ Comparar la compra"
      footer={
        totals.compared > 0 && done === pending.length ? (
          <button onClick={cheapest} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
            Quedarme con lo más barato de cada uno
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {done < pending.length && (
          <p className="rounded-2xl bg-stone-100 p-3 text-sm text-muted">
            Buscando {done + 1 > pending.length ? pending.length : done + 1} de {pending.length}… (Ahorramás tarda unos segundos)
          </p>
        )}
        {totals.compared > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['mercadona', 'ahorramas'] as Store[]).map((s) => (
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
        )}
        {totals.compared > 0 && totals.cheaper && (
          <p className="text-center text-sm">
            <b>{STORES[totals.cheaper].label}</b> sale {eur(Math.abs(totals.mercadona - totals.ahorramas))} más barato
            {totals.mixed < Math.min(totals.mercadona, totals.ahorramas) && <> · yendo a los dos, ahorráis {eur(Math.min(totals.mercadona, totals.ahorramas) - totals.mixed)}</>}
          </p>
        )}
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-surface">
          {list.map(({ item, row }) => {
            const m = row?.mercadona
            const a = row?.ahorramas
            const cheaper = m && a ? (m.price < a.price ? 'mercadona' : a.price < m.price ? 'ahorramas' : null) : null
            return (
              <li key={item.id} className="px-3 py-2.5">
                <p className="text-sm font-bold">
                  {item.qty > 1 && <span className="text-muted">{item.qty}× </span>}
                  {item.name}
                </p>
                {!row ? (
                  <p className="text-xs text-muted">Buscando…</p>
                ) : (
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(['mercadona', 'ahorramas'] as Store[]).map((s) => {
                      const p = row[s]
                      return p ? (
                        <button
                          key={s}
                          onClick={() => choose(item, p)}
                          aria-label={`${item.name} en ${STORES[s].label}: ${eur(p.price)}`}
                          className={`rounded-xl p-2 text-left ${cheaper === s ? 'bg-emerald-50 ring-1 ring-emerald-400' : 'bg-stone-50'} ${item.product?.id === p.id ? 'outline outline-2 outline-ink' : ''}`}
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
                      ) : (
                        <span key={s} className="rounded-xl bg-stone-50 p-2 text-[11px] text-muted">
                          No lo encuentro en {STORES[s].label}
                        </span>
                      )
                    })}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {failed && <p className="text-xs text-amber-700">Ahorramás no ha respondido para algunas cosas; inténtalo en un rato.</p>}
        <p className="text-center text-[11px] text-muted">Busca lo equivalente (sin fijarse en la marca blanca) y del mismo tamaño más o menos. Toca un precio para quedarte con ese producto.</p>
      </div>
    </BottomSheet>
  )
}
