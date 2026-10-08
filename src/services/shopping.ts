import { collection, deleteDoc, doc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { capitalizeFirst, itemKey, type SectionId, type ShoppingItem } from '../lib/shopping'
import type { PersonId } from '../lib/types'

const col = collection(db, 'shopping')
const freqRef = doc(db, 'config', 'shopping')

/**
 * Añade algo a la lista. Si ya estaba pendiente no lo duplica; si estaba comprado, lo vuelve a poner.
 * Devuelve false si ya estaba en la lista.
 */
export function addShoppingItem(name: string, section: SectionId, me: PersonId, items: ShoppingItem[]): boolean {
  const key = itemKey(name)
  if (!key) return false
  const existing = items.find((i) => itemKey(i.name) === key)
  if (existing && !existing.done) return false
  const pretty = capitalizeFirst(name)
  const batch = writeBatch(db)
  if (existing) batch.update(doc(col, existing.id), { done: false, doneAt: null, doneBy: null, section, addedBy: me, createdAt: serverTimestamp() })
  else batch.set(doc(col), { name: pretty, section, done: false, doneAt: null, doneBy: null, addedBy: me, createdAt: serverTimestamp() })
  // Memoria de lo que soléis comprar (sugerencias + sección por defecto).
  batch.set(freqRef, { items: { [key]: { name: pretty, section, n: increment(1) } } }, { merge: true })
  batch.commit().catch((e) => console.error(e))
  return true
}

export const toggleShoppingItem = (item: ShoppingItem, me: PersonId) =>
  updateDoc(doc(col, item.id), { done: !item.done, doneAt: item.done ? null : serverTimestamp(), doneBy: item.done ? null : me })

export const deleteShoppingItem = (id: string) => deleteDoc(doc(col, id))

/** Quita de la lista todo lo ya comprado. */
export function clearBought(items: ShoppingItem[]) {
  const batch = writeBatch(db)
  items.filter((i) => i.done).forEach((i) => batch.delete(doc(col, i.id)))
  return batch.commit()
}

/** Olvidar una sugerencia. */
export const forgetFrequent = (key: string) => setDoc(freqRef, { items: { [key]: { n: 0 } } }, { merge: true })
