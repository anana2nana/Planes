// Datos de bbs en vivo (colección `bbsItems`) y las escrituras, sin esperar (funciona sin conexión).
import { useEffect, useState } from 'react'
import { collection, deleteDoc, deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { parseBbsItem, type BbsItem, type BbsPerson, type BbsRating } from '../lib/bbs.ts'

const COL = 'bbsItems'

export function useBbsItems() {
  const [items, setItems] = useState<BbsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(
        collection(db, COL),
        (snap) => {
          setItems(snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' })
            return parseBbsItem(d.id, x, x.createdAt?.toMillis?.() ?? 0)
          }))
          setLoading(false)
          setError(null)
        },
        (e) => {
          setLoading(false)
          setError(e.message)
        },
      ),
    [],
  )
  return { items, loading, error }
}

/** Lo que se edita en la ficha. */
export type BbsDraft = Pick<BbsItem, 'title' | 'link' | 'kind' | 'place' | 'price' | 'setting' | 'booking' | 'note' | 'from' | 'to'>

export const emptyDraft = (): BbsDraft => ({ title: '', link: '', kind: 'otro', place: null, price: 0, setting: null, booking: false, note: '', from: null, to: null })

const fail = (onError: (m: string) => void) => (e: Error) => onError(e.message)

/** Apuntar algo nuevo (con tu ❤️: si lo apuntas, te apetece). Devuelve el id. */
export function addBbsItem(draft: BbsDraft, me: BbsPerson, onError: (m: string) => void): string {
  const ref = doc(collection(db, COL))
  setDoc(ref, {
    ...draft,
    title: draft.title.trim().slice(0, 120),
    addedBy: me,
    status: 'pending',
    hearts: { [me]: true },
    ratings: {},
    doneAt: null,
    endingSent: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: me,
  }).catch(fail(onError))
  return ref.id
}

export function updateBbsItem(id: string, patch: Partial<BbsDraft> & Record<string, unknown>, me: BbsPerson, onError: (m: string) => void) {
  updateDoc(doc(db, COL, id), { ...patch, updatedAt: serverTimestamp(), updatedBy: me }).catch(fail(onError))
}

/** Tu ❤️ (solo el tuyo: las reglas no dejan tocar el de los demás). */
export function setHeart(id: string, me: BbsPerson, on: boolean, onError: (m: string) => void) {
  updateBbsItem(id, { [`hearts.${me}`]: on ? true : deleteField() }, me, onError)
}

export function setRating(id: string, me: BbsPerson, r: BbsRating | null, onError: (m: string) => void) {
  updateBbsItem(id, { [`ratings.${me}`]: r ?? deleteField() }, me, onError)
}

export function markDone(id: string, day: string, me: BbsPerson, onError: (m: string) => void) {
  updateBbsItem(id, { status: 'done', doneAt: day }, me, onError)
}

export function setStatus(id: string, status: 'pending' | 'dropped', me: BbsPerson, onError: (m: string) => void) {
  updateBbsItem(id, { status, doneAt: null }, me, onError)
}

/** Borrar del todo (solo quien lo apuntó). */
export const removeBbsItem = (id: string) => deleteDoc(doc(db, COL, id))

// ─── Avisos: preferencias de cada uno (bbsConfig/notifications) ─────────────

export type BbsPrefs = { added: boolean; ending: boolean }

export function useBbsPrefs(me: BbsPerson): BbsPrefs {
  const [prefs, setPrefs] = useState<BbsPrefs>({ added: true, ending: true })
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'bbsConfig', 'notifications'),
        (snap) => {
          const v = snap.get(me)
          setPrefs({ added: v?.added !== false, ending: v?.ending !== false })
        },
        () => {},
      ),
    [me],
  )
  return prefs
}

export function saveBbsPrefs(me: BbsPerson, prefs: BbsPrefs, onError: (m: string) => void) {
  setDoc(doc(db, 'bbsConfig', 'notifications'), { [me]: prefs }, { merge: true }).catch(fail(onError))
}
