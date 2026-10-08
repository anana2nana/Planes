import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId } from '../lib/types'

const ref = doc(db, 'config', 'couple')
const isMonthDay = (v: unknown): v is string => typeof v === 'string' && /^\d{2}-\d{2}$/.test(v)

/** Configuración de pareja compartida (config/couple): desde cuándo estáis juntos y vuestros cumpleaños ("MM-DD"). */
export function useCouple() {
  const [state, setState] = useState<{ since: string | null; birthdays: Record<PersonId, string | null> }>({
    since: null,
    birthdays: { nita: null, kitos: null },
  })
  useEffect(
    () =>
      onSnapshot(ref, (s) => {
        const v = s.get('since')
        const b = s.get('birthdays') ?? {}
        setState({
          since: typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null,
          birthdays: { nita: isMonthDay(b.nita) ? b.nita : null, kitos: isMonthDay(b.kitos) ? b.kitos : null },
        })
      }),
    [],
  )
  return state
}

export const saveCoupleSince = (since: string | null) => setDoc(ref, { since }, { merge: true })
export const saveBirthday = (person: PersonId, monthDay: string | null) => setDoc(ref, { birthdays: { [person]: monthDay } }, { merge: true })
