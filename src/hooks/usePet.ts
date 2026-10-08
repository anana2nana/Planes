import { useEffect, useState } from 'react'
import { arrayUnion, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CareItem } from '../lib/pet'

export interface PetProfile {
  name: string
  birth: string | null
  chip: string
  vetName: string
  vetPhone: string
  notes: string
  weights: { date: string; kg: number }[]
}

const EMPTY: PetProfile = { name: '', birth: null, chip: '', vetName: '', vetPhone: '', notes: '', weights: [] }
const profileRef = doc(db, 'pet', 'profile')
const careCol = collection(db, 'petCare')

export function usePet() {
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [care, setCare] = useState<CareItem[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const u1 = onSnapshot(profileRef, (s) => {
      const x = s.data()
      setProfile(x ? { ...EMPTY, ...x, weights: Array.isArray(x.weights) ? [...x.weights].sort((a, b) => a.date.localeCompare(b.date)) : [] } : null)
      setLoading(false)
    })
    const u2 = onSnapshot(careCol, (snap) =>
      setCare(
        snap.docs.map((d) => {
          const x = d.data()
          return {
            id: d.id,
            title: x.title ?? '',
            every: x.every?.n && x.every?.unit ? x.every : { n: 1, unit: 'month' },
            last: typeof x.last === 'string' ? x.last : null,
            history: Array.isArray(x.history) ? x.history : [],
          }
        }),
      ),
    )
    return () => {
      u1()
      u2()
    }
  }, [])
  return { profile, care, loading }
}

export const savePetProfile = (patch: Partial<PetProfile>) => setDoc(profileRef, patch, { merge: true })
export const addWeight = (date: string, kg: number) => setDoc(profileRef, { weights: arrayUnion({ date, kg }) }, { merge: true })
export const removeWeight = (w: { date: string; kg: number }, all: { date: string; kg: number }[]) =>
  updateDoc(profileRef, { weights: all.filter((x) => !(x.date === w.date && x.kg === w.kg)) })

export function saveCare(item: Partial<CareItem> & { id?: string }) {
  const { id, ...data } = item
  return setDoc(id ? doc(careCol, id) : doc(careCol), data, { merge: true })
}
/** "Hecho hoy" (o en otra fecha). */
export const markCareDone = (item: CareItem, date: string) => updateDoc(doc(careCol, item.id), { last: date, history: arrayUnion(date) })
export const deleteCare = (id: string) => deleteDoc(doc(careCol, id))
