import { collection, deleteDoc, deleteField, doc, increment, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { capitalizeFirst, itemKey, type SectionId, type ShoppingItem } from '../lib/shopping'
import type { PersonId } from '../lib/types'
import type { Options, Product } from '../lib/prices'

const col = collection(db, 'shopping')
const freqRef = doc(db, 'config', 'shopping')

/**
 * Añade algo a la lista. Si ya estaba pendiente no lo duplica; si estaba comprado, lo vuelve a poner.
 * Devuelve false si ya estaba en la lista.
 */
export function addShoppingItem(name: string, section: SectionId, me: PersonId, items: ShoppingItem[], extra: { price?: number | null; product?: Product | null; options?: Options } = {}): boolean {
  const key = itemKey(name)
  if (!key) return false
  const existing = items.find((i) => itemKey(i.name) === key)
  if (existing && !existing.done) return false
  const pretty = capitalizeFirst(name)
  const batch = writeBatch(db)
  // Precio y producto: los que se eligen ahora o, si no, los de la última vez.
  const priced = {
    ...('price' in extra ? { price: extra.price ?? null } : {}),
    ...('product' in extra ? { product: extra.product ?? null } : {}),
    ...(extra.options ? { options: extra.options } : {}),
  }
  if (existing) batch.update(doc(col, existing.id), { done: false, doneAt: null, doneBy: null, section, addedBy: me, createdAt: serverTimestamp(), qty: 1, ...priced })
  else batch.set(doc(col), { name: pretty, section, done: false, doneAt: null, doneBy: null, addedBy: me, createdAt: serverTimestamp(), qty: 1, price: null, product: null, options: {}, ...priced })
  // Memoria de lo que soléis comprar (sugerencias + sección por defecto + último precio).
  batch.set(freqRef, { items: { [key]: { name: pretty, section, n: increment(1), ...(extra.price != null ? priced : {}) } } }, { merge: true })
  batch.commit().catch((e) => console.error(e))
  return true
}

/** Cambiar precio, cantidad o producto (y recordarlo para la próxima vez). */
export function updateShoppingItem(item: ShoppingItem, patch: { price?: number | null; qty?: number; product?: Product | null; options?: Options }) {
  const batch = writeBatch(db)
  batch.update(doc(col, item.id), patch)
  const remember = {
    ...('price' in patch ? { price: patch.price ?? null } : {}),
    ...('product' in patch ? { product: patch.product ?? null } : {}),
    // Con merge los mapas se mezclan: lo que se quita hay que borrarlo a propósito.
    ...('options' in patch ? { options: { mercadona: patch.options?.mercadona ?? deleteField(), ahorramas: patch.options?.ahorramas ?? deleteField() } } : {}),
  }
  if (Object.keys(remember).length) batch.set(freqRef, { items: { [itemKey(item.name)]: remember } }, { merge: true })
  return batch.commit()
}

export const toggleShoppingItem = (item: ShoppingItem, me: PersonId) => updateDoc(doc(col, item.id), { done: !item.done, doneAt: item.done ? null : serverTimestamp(), doneBy: item.done ? null : me })

export const deleteShoppingItem = (id: string) => deleteDoc(doc(col, id))

/** Quita de la lista todo lo ya comprado. */
export function clearBought(items: ShoppingItem[]) {
  const batch = writeBatch(db)
  items.filter((i) => i.done).forEach((i) => batch.delete(doc(col, i.id)))
  return batch.commit()
}

/** Olvidar una sugerencia. */
export const forgetFrequent = (key: string) => setDoc(freqRef, { items: { [key]: { n: 0 } } }, { merge: true })
