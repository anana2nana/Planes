import { useEffect, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId } from '../lib/types'

export interface Receipt {
  id: string
  dataUrl: string
  createdAt: number
}

const col = collection(db, 'receipts')

/** Fotos de tickets/facturas de un gasto de la casa. */
export function useReceipts(itemId: string | null) {
  const [list, setList] = useState<Receipt[]>([])
  useEffect(() => {
    if (!itemId) return
    return onSnapshot(query(col, where('itemId', '==', itemId)), (snap) =>
      setList(
        snap.docs
          .map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' })
            return { id: d.id, dataUrl: x.data as string, createdAt: x.createdAt?.toMillis?.() ?? 0 }
          })
          .sort((a, b) => a.createdAt - b.createdAt),
      ),
    )
  }, [itemId])
  return list
}

export const addReceipt = (itemId: string, dataUrl: string, me: PersonId) => addDoc(col, { itemId, data: dataUrl, addedBy: me, createdAt: serverTimestamp() })
export const deleteReceipt = (id: string) => deleteDoc(doc(col, id))
