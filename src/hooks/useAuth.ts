import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { personFromEmail } from '../lib/people'
import type { PersonId } from '../lib/types'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'denied'; user: User }
  | { status: 'ready'; user: User; me: PersonId }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) return setState({ status: 'signed-out' })
        const me = personFromEmail(user.email)
        setState(me ? { status: 'ready', user, me } : { status: 'denied', user })
      }),
    [],
  )

  return state
}

export async function login() {
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (e) {
    // Algunos navegadores (p. ej. la app instalada en la pantalla de inicio de iOS)
    // bloquean las ventanas emergentes: en ese caso usamos redirección.
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider)
    } else {
      throw e
    }
  }
}
export const logout = () => signOut(auth)
