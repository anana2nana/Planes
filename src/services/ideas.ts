import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Idea } from '../lib/ideas'
import type { PersonId } from '../lib/types'

const col = collection(db, 'ideas')

export function saveIdea(idea: Partial<Idea> & { id?: string }, me: PersonId) {
  const { id, createdAt: _c, doneAt: _d, ...data } = idea
  void _c
  void _d
  const ref = id ? doc(col, id) : doc(col)
  return setDoc(ref, { ...data, ...(id ? {} : { addedBy: me, createdAt: serverTimestamp(), done: false, doneAt: null }) }, { merge: true })
}

export const setIdeaDone = (id: string, done: boolean) => updateDoc(doc(col, id), { done, doneAt: done ? serverTimestamp() : null })
export const deleteIdea = (id: string) => deleteDoc(doc(col, id))
