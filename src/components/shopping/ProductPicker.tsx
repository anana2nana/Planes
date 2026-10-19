import { useEffect, useRef, useState } from 'react'
import { STORES, eur, searchCatalog, thumb, type Product, type Store } from '../../lib/prices'
import { downloadMercadona, loadMercadona, searchAhorramas, type Catalog } from '../../services/prices'

const KEY = 'nitakitos.shop.store'
const readStore = (): Store => {
  try {
    return localStorage.getItem(KEY) === 'ahorramas' ? 'ahorramas' : 'mercadona'
  } catch {
    return 'mercadona'
  }
}
const dayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

/** Buscar a mano y elegir un producto de Mercadona o Ahorramás (con su precio). Con `only`, solo en ese súper. */
export function ProductPicker({ initial, onPick, only }: { initial: string; onPick: (p: Product) => void; only?: Store }) {
  const [chosen, setStore] = useState<Store>(readStore)
  const store = only ?? chosen
  const [q, setQ] = useState(initial)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'downloading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [remote, setRemote] = useState<{ q: string; items: Product[] } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pickStore = (s: Store) => {
    setStore(s)
    try {
      localStorage.setItem(KEY, s)
    } catch {
      /* da igual */
    }
  }

  useEffect(() => {
    if (store !== 'mercadona' || catalog) return
    setState('loading')
    loadMercadona()
      .then((c) => {
        setCatalog(c)
        setState('idle')
      })
      .catch((e: Error) => {
        setError(e.message)
        setState('error')
      })
  }, [store, catalog])

  // Ahorramás: se busca en su web al dejar de escribir.
  useEffect(() => {
    if (store !== 'ahorramas') return
    const query = q.trim()
    if (query.length < 2 || remote?.q === query) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setState('loading')
      searchAhorramas(query)
        .then((items) => {
          setRemote({ q: query, items })
          setState('idle')
        })
        .catch((e: Error) => {
          setError(e.message)
          setState('error')
        })
    }, 600)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [store, q, remote?.q])

  const download = () => {
    setState('downloading')
    downloadMercadona()
      .then(() => loadMercadona(true))
      .then((c) => {
        setCatalog(c)
        setState('idle')
      })
      .catch((e: Error) => {
        setError(e.message)
        setState('error')
      })
  }

  const results = store === 'mercadona' ? searchCatalog(catalog?.items ?? [], q) : remote?.q === q.trim() ? remote.items : []

  return (
    <div className="space-y-3">
      {!only && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Supermercado">
          {(Object.keys(STORES) as Store[]).map((s) => (
            <button key={s} role="tab" aria-selected={store === s} onClick={() => pickStore(s)} className={`h-9 rounded-xl text-sm font-bold ${store === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {STORES[s].label}
            </button>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar producto…"
        aria-label="Buscar producto"
        autoFocus
        className="h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
      />

      {store === 'mercadona' && catalog && catalog.items.length === 0 && state !== 'downloading' && (
        <div className="space-y-2 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>Aún no está descargado el catálogo de Mercadona. Se actualiza solo cada lunes; la primera vez hay que pedirlo.</p>
          <button onClick={download} className="rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white">
            Descargar ahora
          </button>
        </div>
      )}
      {state === 'downloading' && <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Descargando el catálogo de Mercadona… tarda uno o dos minutos ☕</p>}
      {state === 'loading' && <p className="text-sm text-muted">{store === 'ahorramas' ? 'Buscando en Ahorramás… (tarda unos segundos)' : 'Cargando el catálogo…'}</p>}
      {state === 'error' && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          {STORES[store].label} no responde ahora mismo. Puedes poner el precio a mano.
          <span className="mt-1 block text-xs opacity-70">{error}</span>
        </p>
      )}

      {results.length > 0 ? (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl bg-surface">
          {results.map((p) => (
            <li key={`${p.store}-${p.id}`}>
              <button onClick={() => onPick(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-stone-50">
                {p.image ? (
                  <img src={thumb(p.image)} alt="" loading="lazy" className="size-12 shrink-0 rounded-xl bg-white object-contain" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-stone-100">🛒</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</span>
                  <span className="block text-xs text-muted">{[p.pack, p.ref].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="tabular shrink-0 font-extrabold">{eur(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        q.trim().length >= 2 &&
        state === 'idle' &&
        (store === 'mercadona' ? (catalog?.items.length ?? 0) > 0 : remote?.q === q.trim()) && (
          <p className="p-2 text-center text-sm text-muted">No hay nada con «{q.trim()}». Prueba con otra palabra.</p>
        )
      )}
      {store === 'mercadona' && catalog?.updatedAt && (
        <p className="text-center text-[11px] text-muted">
          Precios de Mercadona{catalog.wh === 'mad1' ? ' Madrid' : ''} del {dayFmt.format(catalog.updatedAt)} · pueden variar en tienda
        </p>
      )}
      {store === 'ahorramas' && <p className="text-center text-[11px] text-muted">Precios de la web de Ahorramás · pueden variar en tienda</p>}
    </div>
  )
}
