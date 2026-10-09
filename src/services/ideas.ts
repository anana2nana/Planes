import { collection, deleteDoc, doc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { ideaToModule, type Idea } from '../lib/ideas'
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

/**
 * Las ideas de «comer», «peli» y «escapada» se mudan a Sitios, Hemeroteca y Viajes (una sola vez;
 * el id nuevo sale del antiguo, así que si dos móviles lo hacen a la vez no se duplica).
 */
export async function moveIdeasToModules(ideas: Idea[]): Promise<number> {
  const movable = ideas.filter((i) => !i.done && ideaToModule(i))
  if (!movable.length) return 0
  const batch = writeBatch(db)
  for (const i of movable) {
    const m = ideaToModule(i)!
    batch.set(doc(db, m.collection, m.id), { ...m.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true })
    batch.delete(doc(col, i.id))
  }
  await batch.commit()
  return movable.length
}
