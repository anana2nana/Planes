import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

/** Configuración de pareja compartida (config/couple): de momento, desde cuándo estáis juntos. */
export function useCouple() {
  const [since, setSince] = useState<string | null>(null)
  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'couple'), (s) => {
        const v = s.get('since')
        setSince(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
      }),
    [],
  )
  return { since }
}

export const saveCoupleSince = (since: string | null) => setDoc(doc(db, 'config', 'couple'), { since }, { merge: true })
