import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { compressImage } from '../lib/image'
import { monthDay, type Memory } from '../lib/memories'
import type { Kind, PersonId, PlaceInfo } from '../lib/types'

const memories = collection(db, 'memories')
/** Fotos a tamaño completo, aparte: la lista solo carga la miniatura. */
const photos = collection(db, 'memoryPhotos')

export function useMemories() {
  const [list, setList] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(memories, (snap) => {
        setList(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' })
            return {
              id: d.id,
              title: x.title ?? '',
              date: typeof x.date === 'string' ? x.date : '1970-01-01',
              kind: (['plan', 'event', 'task'].includes(x.kind) ? x.kind : 'free') as Kind | 'free',
              planId: typeof x.planId === 'string' ? x.planId : null,
              place: x.place?.name ? (x.place as PlaceInfo) : null,
              text: x.text ?? '',
              thumb: typeof x.thumb === 'string' ? x.thumb : null,
              photoCount: typeof x.photoCount === 'number' ? x.photoCount : 0,
              by: x.by === 'nita' || x.by === 'kitos' ? x.by : null,
              createdAt: x.createdAt?.toMillis?.() ?? 0,
            }
          }),
        )
        setLoading(false)
      }),
    [],
  )
  return { memories: list, loading }
}

export interface MemoryPhoto {
  id: string
  data: string
  order: number
}

export async function loadPhotos(memoryId: string): Promise<MemoryPhoto[]> {
  // Se ordena aquí para no necesitar un índice compuesto en Firestore.
  const snap = await getDocs(query(photos, where('memoryId', '==', memoryId)))
  return snap.docs.map((d) => ({ id: d.id, data: d.get('data') as string, order: Number(d.get('order')) || 0 })).sort((a, b) => a.order - b.order)
}

/** Prepara las fotos elegidas: la grande para guardar y una miniatura para la lista. */
export async function preparePhoto(file: Blob): Promise<{ full: string; thumb: string }> {
  const [full, thumb] = await Promise.all([compressImage(file, 1600), compressImage(file, 360)])
  return { full: full.dataUrl, thumb: thumb.dataUrl }
}

export interface MemoryDraft {
  id?: string
  title: string
  date: string
  kind: Kind | 'free'
  planId: string | null
  place: PlaceInfo | null
  text: string
}

/**
 * Guarda un recuerdo: los datos, las fotos nuevas y las que se quitan.
 * `keepThumb` es la miniatura de la primera foto que queda.
 */
export async function saveMemory(
  d: MemoryDraft,
  me: PersonId,
  opts: { added: { full: string; thumb: string }[]; removed: string[]; firstOrder: number; thumb: string | null; photoCount: number },
): Promise<string> {
  const ref = d.id ? doc(memories, d.id) : doc(memories)
  const { id: _id, ...data } = d
  void _id
  await setDoc(
    ref,
    {
      ...data,
      title: d.title.trim(),
      text: d.text.trim(),
      md: monthDay(d.date),
      thumb: opts.thumb,
      photoCount: opts.photoCount,
      updatedAt: serverTimestamp(),
      ...(d.id ? {} : { by: me, createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
  // Una foto por documento (cada una cerca del límite de 1 MB de Firestore).
  await Promise.all([
    ...opts.added.map((p, i) => setDoc(doc(photos), { memoryId: ref.id, data: p.full, order: opts.firstOrder + i, by: me })),
    ...opts.removed.map((id) => deleteDoc(doc(photos, id))),
  ])
  return ref.id
}

export async function deleteMemory(id: string) {
  const snap = await getDocs(query(photos, where('memoryId', '==', id)))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(memories, id))
  await batch.commit()
}

/** Citas de las que se ha dicho "ahora no" (en este móvil). */
const DISMISS_KEY = 'nitakitos.memories.dismissed'
export function readDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}
export function dismissPrompt(key: string) {
  try {
    const s = readDismissed()
    s.add(key)
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-200)))
  } catch {
    /* sin almacenamiento */
  }
}
