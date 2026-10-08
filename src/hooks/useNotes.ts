import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId } from '../lib/types'

/** Notas de casa: datos que siempre se buscan (wifi, tallas, teléfonos…). */
export interface Note {
  id: string
  emoji: string
  title: string
  body: string
  pinned: boolean
  updatedAt: number
  updatedBy: PersonId | null
}

const col = collection(db, 'notes')

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(
    () =>
      onSnapshot(col, (snap) => {
        setNotes(
          snap.docs
            .map((d) => {
              const x = d.data({ serverTimestamps: 'estimate' })
              return {
                id: d.id,
                emoji: typeof x.emoji === 'string' && x.emoji ? x.emoji : '📝',
                title: x.title ?? '',
                body: x.body ?? '',
                pinned: x.pinned === true,
                updatedAt: x.updatedAt?.toMillis?.() ?? 0,
                updatedBy: x.updatedBy === 'nita' || x.updatedBy === 'kitos' ? x.updatedBy : null,
              }
            })
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.title.localeCompare(b.title, 'es')),
        )
        setLoading(false)
      }),
    [],
  )
  return { notes, loading }
}

export function saveNote(note: Pick<Note, 'emoji' | 'title' | 'body' | 'pinned'> & { id?: string }, me: PersonId) {
  const { id, ...data } = note
  return setDoc(id ? doc(col, id) : doc(col), { ...data, updatedAt: serverTimestamp(), updatedBy: me }, { merge: true })
}
export const deleteNote = (id: string) => deleteDoc(doc(col, id))

/** Para empezar: las notas que casi todo el mundo acaba buscando. */
export const NOTE_TEMPLATES: Pick<Note, 'emoji' | 'title' | 'body'>[] = [
  { emoji: '📶', title: 'Wifi', body: 'Red: \nContraseña: ' },
  { emoji: '👕', title: 'Tallas', body: 'Nita: \nKitos: ' },
  { emoji: '📞', title: 'Teléfonos útiles', body: 'Fontanero: \nAdministrador: \nSeguro del hogar: ' },
  { emoji: '🐱', title: 'Cosas de la gata', body: 'Pienso: \nArena: ' },
]
