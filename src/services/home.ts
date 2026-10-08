import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import type { Fund, HomeConfig, HomeItem } from '../lib/home'
import type { PersonId } from '../lib/types'

const itemsCol = collection(db, 'homeItems')
const fundsCol = collection(db, 'homeFunds')
const configRef = doc(db, 'home', 'meroe')

/** Guarda (fusionando) parte de la configuración. */
export function saveHomeConfig(patch: Partial<HomeConfig>) {
  // Los presupuestos se sustituyen enteros (con merge, quitar uno no lo borraría).
  if (patch.budgets) return updateDoc(configRef, { ...patch, updatedAt: serverTimestamp() })
  return setDoc(configRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}

type ItemData = Omit<HomeItem, 'id'> & { order?: number }

/** Configuración inicial + plan de pagos de una vez. */
export function setupHome(config: HomeConfig, items: ItemData[]) {
  const batch = writeBatch(db)
  batch.set(configRef, { ...config, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  items.forEach((it, i) => batch.set(doc(itemsCol), { ...it, order: it.order ?? i * 10, createdAt: serverTimestamp() }))
  return batch.commit()
}

export function saveHomeItem(item: Partial<HomeItem> & { id?: string }, me: PersonId) {
  const { id, ...data } = item
  const ref = id ? doc(itemsCol, id) : doc(itemsCol)
  return setDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: me, ...(id ? {} : { createdAt: serverTimestamp(), order: Date.now() / 1e6 }) }, { merge: true })
}

/** Borra un gasto y las fotos de sus tickets. */
export async function deleteHomeItem(id: string) {
  const receipts = await getDocs(query(collection(db, 'receipts'), where('itemId', '==', id)))
  const batch = writeBatch(db)
  receipts.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(itemsCol, id))
  await batch.commit()
}

export function saveFund(fund: Partial<Fund> & { id?: string }, me: PersonId) {
  const { id, updatedAt: _ignored, ...data } = fund
  void _ignored
  const ref = id ? doc(fundsCol, id) : doc(fundsCol)
  return setDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: me }, { merge: true })
}

export const deleteFund = (id: string) => deleteDoc(doc(fundsCol, id))

/** Pide al servidor el último Euríbor del BCE (también se actualiza solo cada día). */
export const refreshEuribor = () => httpsCallable(functions, 'refreshEuribor')()
