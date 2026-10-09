import { useSyncExternalStore } from 'react'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId } from '../lib/types'

/** Fotos de perfil (pequeñas, en data URL). Una sola suscripción compartida por todos los avatares. */
type Photos = Record<PersonId, string | null>
let photos: Photos = { nita: null, kitos: null }
const listeners = new Set<() => void>()
let unsubscribe: (() => void) | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!unsubscribe) {
    unsubscribe = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        const next: Photos = { nita: null, kitos: null }
        snap.docs.forEach((d) => {
          if ((d.id === 'nita' || d.id === 'kitos') && typeof d.get('photo') === 'string') next[d.id] = d.get('photo')
        })
        photos = next
        listeners.forEach((l) => l())
      },
      () => {},
    )
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }
}

export const useProfilePhotos = () => useSyncExternalStore(subscribe, () => photos)

export const saveProfilePhoto = (me: PersonId, photo: string | null) => setDoc(doc(db, 'profiles', me), { photo, updatedAt: serverTimestamp() }, { merge: true })
