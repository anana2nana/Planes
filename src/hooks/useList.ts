import { useEffect, useMemo, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId, PlaceInfo } from '../lib/types'

// Listas sencillas (hemeroteca, sitios, documentos, viajes…): leer en vivo, guardar sin esperar y borrar.

/** Ayudas para leer documentos de Firestore con valores por defecto. */
export const str = (v: unknown) => (typeof v === 'string' ? v : '')
export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
export const person = (v: unknown): PersonId | null => (v === 'nita' || v === 'kitos' ? v : null)
export const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback)
export const place = (v: any): PlaceInfo | null =>
  v?.name ? { name: str(v.name), address: str(v.address), placeId: typeof v.placeId === 'string' ? v.placeId : null, lat: num(v.lat), lng: num(v.lng) } : null
export const millis = (v: any) => v?.toMillis?.() ?? 0

/**
 * Una colección en vivo. Con `owner`, solo los documentos de esa persona
 * (para las colecciones privadas, cuyas reglas no dejan leer las de la pareja).
 */
export function useList<T>(name: string, parse: (id: string, x: Record<string, any>) => T, owner?: PersonId) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const q = useMemo(() => (owner ? query(collection(db, name), where('owner', '==', owner)) : collection(db, name)), [name, owner])
  useEffect(
    () =>
      onSnapshot(
        q,
        (snap) => {
          setItems(snap.docs.map((d) => parse(d.id, d.data({ serverTimestamps: 'estimate' }))))
          setLoading(false)
        },
        () => setLoading(false),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q],
  )
  return { items, loading }
}

/** Guarda sin esperar (funciona sin conexión). Devuelve el id. */
export function saveItem<T extends { id?: string }>(name: string, item: T, me: PersonId, onError: (m: string) => void): string {
  const { id, ...data } = item
  const ref = id ? doc(db, name, id) : doc(collection(db, name))
  setDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: me, ...(id ? {} : { createdAt: serverTimestamp(), createdBy: me }) }, { merge: true }).catch((e: Error) => onError(e.message))
  return ref.id
}

export const removeItem = (name: string, id: string) => deleteDoc(doc(db, name, id))

/** Un documento suelto (p. ej. la foto grande de algo, guardada aparte para que la lista pese poco). */
export async function loadBlob(name: string, id: string): Promise<string | null> {
  const snap = await getDoc(doc(db, name, id))
  return snap.exists() ? str(snap.get('data')) || null : null
}
export function saveBlob(name: string, id: string, data: string | null, onError: (m: string) => void) {
  ;(data ? setDoc(doc(db, name, id), { data }) : deleteDoc(doc(db, name, id))).catch((e: Error) => onError(e.message))
}
