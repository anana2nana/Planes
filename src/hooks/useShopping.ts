import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { SECTIONS, type Frequent, type SectionId, type ShoppingItem } from '../lib/shopping'
import type { Options, Product } from '../lib/prices'

const asPrice = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const asProduct = (v: any): Product | null =>
  v && (v.store === 'mercadona' || v.store === 'ahorramas') && typeof v.name === 'string'
    ? { store: v.store, id: String(v.id ?? ''), name: v.name, pack: String(v.pack ?? ''), price: asPrice(v.price) ?? 0, ref: String(v.ref ?? ''), image: String(v.image ?? '') }
    : null
const asOptions = (v: any): Options => {
  const out: Options = {}
  for (const s of ['mercadona', 'ahorramas'] as const) {
    const p = asProduct(v?.[s])
    if (p && p.store === s) out[s] = p
  }
  return out
}

// "Limpieza y casa" ya no existe: lo de limpieza se compra en el súper.
const asSection = (s: unknown): SectionId => (s === 'casa' ? 'super' : typeof s === 'string' && s in SECTIONS ? (s as SectionId) : 'otros')

export function useShopping() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [frequent, setFrequent] = useState<Frequent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'shopping'), (snap) => {
      setItems(
        snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: 'estimate' })
          return {
            id: d.id,
            name: x.name ?? '',
            section: asSection(x.section),
            done: x.done === true,
            addedBy: x.addedBy === 'nita' || x.addedBy === 'kitos' ? x.addedBy : null,
            createdAt: x.createdAt?.toMillis?.() ?? 0,
            doneAt: x.doneAt?.toMillis?.() ?? null,
            price: asPrice(x.price),
            qty: typeof x.qty === 'number' && x.qty >= 1 ? Math.round(x.qty) : 1,
            product: asProduct(x.product),
            options: asOptions(x.options),
          }
        }),
      )
      setLoading(false)
    })
    const u2 = onSnapshot(doc(db, 'config', 'shopping'), (snap) => {
      const map = (snap.data()?.items ?? {}) as Record<string, { name?: string; section?: string; n?: number; price?: unknown; product?: unknown; options?: unknown }>
      setFrequent(
        Object.entries(map)
          .filter(([, v]) => (v.n ?? 0) > 0 && v.name)
          .map(([key, v]) => ({ key, name: v.name!, section: asSection(v.section), n: v.n ?? 0, price: asPrice(v.price), product: asProduct(v.product), options: asOptions(v.options) }))
          .sort((a, b) => b.n - a.n),
      )
    })
    return () => {
      u1()
      u2()
    }
  }, [])

  return { items, frequent, loading }
}
