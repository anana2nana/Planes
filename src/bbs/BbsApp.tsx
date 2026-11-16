// La app bbs (su propia dirección e icono): entrar con Google, y dentro, el mismo módulo que la baldosa de Nitakitos.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth, isFirebaseConfigured } from '../lib/firebase'
import { login, logout } from '../hooks/useAuth'
import { useSheetState } from '../hooks/useSheetState'
import { findPlace } from '../lib/maps'
import { parseShared } from '../lib/share'
import { BBS_NAMES, cleanLink, guessKind, type BbsPerson } from '../lib/bbs.ts'
import { BottomSheet } from '../components/BottomSheet'
import { BBS_COLORS, bbsPersonFromEmail } from './people'
import { BbsView } from './BbsView'
import type { BbsDraft } from './useBbs'

type State = { status: 'loading' } | { status: 'signed-out' } | { status: 'denied'; user: User } | { status: 'ready'; user: User; me: BbsPerson }

export function BbsApp() {
  const [state, setState] = useState<State>({ status: 'loading' })
  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) return setState({ status: 'signed-out' })
        const me = bbsPersonFromEmail(user.email)
        setState(me ? { status: 'ready', user, me } : { status: 'denied', user })
      }),
    [],
  )
  if (!isFirebaseConfigured) return <Shell><p className="text-muted">Falta la configuración de Firebase.</p></Shell>
  if (state.status === 'loading') return <Shell><span className="size-6 animate-spin rounded-full border-[3px] border-stone-200 border-t-bbs" /></Shell>
  if (state.status === 'signed-out') return <Login />
  if (state.status === 'denied')
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">bbs es solo para tres 🔒</h1>
        <p className="mt-2 max-w-xs text-muted">
          <b className="text-ink">{state.user.email}</b> no tiene acceso. Entra con la cuenta de Nita, de Kitos o de María.
        </p>
        <button onClick={logout} className="mt-8 h-12 rounded-2xl bg-ink px-6 font-bold text-cream active:scale-[0.98]">
          Usar otra cuenta
        </button>
      </Shell>
    )
  return <Main user={state.user} me={state.me} />
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,var(--color-bbs-soft),transparent_60%)] px-6 text-center">
      <img src="/icon-192.png" alt="" className="mb-6 size-20 rounded-[22px] shadow-xl shadow-teal-700/30" />
      {children}
    </main>
  )
}

function Login() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await login()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) setError('No se pudo entrar. Inténtalo otra vez.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <h1 className="text-4xl font-extrabold tracking-tight">bbs</h1>
      <p className="mt-2 max-w-xs text-muted">Los planes y sitios que vamos viendo, para cuando no sepamos qué hacer. De Nita, Kitos y María ✨</p>
      <button
        onClick={go}
        disabled={busy}
        className="mt-10 flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-surface font-bold shadow-lg shadow-stone-300/40 transition active:scale-[0.98] disabled:opacity-60"
      >
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? 'Abriendo…' : 'Entrar con Google'}
      </button>
      {error && <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p>}
    </Shell>
  )
}

/** "Compartir → bbs" desde otra app llega a /share?title&text&url (share_target del manifest). */
async function readShare(): Promise<Partial<BbsDraft> | null> {
  if (location.pathname !== '/share') return null
  const q = new URLSearchParams(location.search)
  history.replaceState(null, '', '/')
  const s = parseShared({ title: q.get('title'), text: q.get('text'), url: q.get('url') })
  const all = [q.get('title'), q.get('text')].filter(Boolean).join(' ')
  const draft: Partial<BbsDraft> = { title: s.name, link: cleanLink(s.link), kind: guessKind(all, s.link) }
  if (s.isMaps && s.name) {
    // Desde Google Maps: buscar el sitio para tener la dirección y el botón Ir (sin esperar más de 3 s).
    const place = await Promise.race([findPlace([s.name, s.detail].filter(Boolean).join(', ')).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 3000))])
    if (place) {
      draft.place = place
      if (draft.kind === 'otro') draft.kind = 'restaurante'
    }
  }
  return draft
}

function Main({ user, me }: { user: User; me: BbsPerson }) {
  const [toast, setToast] = useState<string | null>(null)
  const [share, setShare] = useState<Partial<BbsDraft> | null>(null)
  const [account, openAccount, closeAccount] = useSheetState<true>()
  const onError = useCallback((m: string) => setToast(m), [])

  useEffect(() => {
    readShare().then((d) => d && setShare(d))
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="pt-safe sticky top-0 z-30 bg-cream/85 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3 pt-2">
          <img src="/icon-192.png" alt="" className="size-11 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold leading-none tracking-tight">bbs</h1>
            <p className="mt-0.5 text-xs font-semibold text-muted">Hola, {BBS_NAMES[me]} 👋</p>
          </div>
          <button onClick={() => openAccount(true)} aria-label="Tu cuenta" className={`grid size-11 place-items-center rounded-full text-sm font-extrabold text-white shadow-sm active:scale-95 ${BBS_COLORS[me].solid}`}>
            {user.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="size-11 rounded-full object-cover" /> : BBS_NAMES[me][0]}
          </button>
        </div>
      </header>
      <main className="px-4 pt-1">
        <BbsView me={me} app="bbs" onError={onError} initialShare={share} />
      </main>

      {account && (
        <BottomSheet open onClose={closeAccount} title="Tu cuenta">
          <div className="space-y-4 pb-2">
            <p className="text-sm text-muted">
              Has entrado como <b className="text-ink">{user.email}</b> ({BBS_NAMES[me]}).
            </p>
            <p className="text-sm text-muted">bbs funciona sin conexión: lo que apuntes se sube solo en cuanto vuelva la red.</p>
            <button onClick={() => logout()} className="h-12 w-full rounded-2xl bg-stone-100 font-bold">
              Cerrar sesión
            </button>
          </div>
        </BottomSheet>
      )}

      {toast && (
        <div role="status" className="pb-safe fixed inset-x-0 bottom-4 z-[60] mx-auto w-fit max-w-[90%] animate-fade-in rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-cream shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
