import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { OCCASIONS, STATUS, type Gift, type GiftOccasion, type GiftStatus } from '../lib/gifts'
import type { PersonId } from '../lib/types'

const col = collection(db, 'gifts')

/** Solo las ideas de regalo de quien mira (las reglas impiden leer las del otro). */
export function useGifts(me: PersonId) {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(
        query(col, where('owner', '==', me)),
        (snap) => {
          setGifts(
            snap.docs
              .map((d) => {
                const x = d.data({ serverTimestamps: 'estimate' })
                return {
                  id: d.id,
                  owner: me,
                  title: x.title ?? '',
                  occasion: (x.occasion in OCCASIONS ? x.occasion : 'otra') as GiftOccasion,
                  url: typeof x.url === 'string' ? x.url : '',
                  price: typeof x.price === 'number' ? x.price : null,
                  notes: x.notes ?? '',
                  status: (x.status in STATUS ? x.status : 'idea') as GiftStatus,
                  createdAt: x.createdAt?.toMillis?.() ?? 0,
                }
              })
              .sort((a, b) => b.createdAt - a.createdAt),
          )
          setLoading(false)
        },
        () => setLoading(false),
      ),
    [me],
  )
  return { gifts, loading }
}

export function saveGift(g: Omit<Gift, 'id' | 'owner' | 'createdAt'> & { id?: string }, me: PersonId) {
  const { id, ...data } = g
  return setDoc(id ? doc(col, id) : doc(col), { ...data, owner: me, ...(id ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
}
export const setGiftStatus = (id: string, status: GiftStatus) => updateDoc(doc(col, id), { status })
export const deleteGift = (id: string) => deleteDoc(doc(col, id))
