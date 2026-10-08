import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { SECTIONS, type Frequent, type SectionId, type ShoppingItem } from '../lib/shopping'

const asSection = (s: unknown): SectionId => (typeof s === 'string' && s in SECTIONS ? (s as SectionId) : 'otros')

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
          }
        }),
      )
      setLoading(false)
    })
    const u2 = onSnapshot(doc(db, 'config', 'shopping'), (snap) => {
      const map = (snap.data()?.items ?? {}) as Record<string, { name?: string; section?: string; n?: number }>
      setFrequent(
        Object.entries(map)
          .filter(([, v]) => (v.n ?? 0) > 0 && v.name)
          .map(([key, v]) => ({ key, name: v.name!, section: asSection(v.section), n: v.n ?? 0 }))
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
