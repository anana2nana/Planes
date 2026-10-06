import { useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { login, logout } from '../hooks/useAuth'

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#ffe4e8,transparent_60%),radial-gradient(ellipse_at_bottom,#e0f2fe,transparent_60%)] px-6 text-center">
      <img src="/icon.svg" alt="" className="mb-6 size-20 rounded-[22px] shadow-xl shadow-rose-300/40" />
      {children}
    </main>
  )
}

export function Splash() {
  return (
    <Shell>
      <div className="size-6 animate-spin rounded-full border-[3px] border-stone-200 border-t-both" />
    </Shell>
  )
}

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await login()
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) {
        setError('No se pudo iniciar sesión. Inténtalo de nuevo.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="text-3xl font-extrabold tracking-tight">Nitakitos</h1>
      <p className="mt-2 max-w-xs text-muted">Nuestros planes, sincronizados al segundo. Solo para nosotros dos 💞</p>
      <button
        onClick={go}
        disabled={busy}
        className="mt-10 flex h-14 w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white font-bold shadow-lg shadow-stone-300/40 transition active:scale-[0.98] disabled:opacity-60"
      >
        <svg viewBox="0 0 48 48" className="size-5">
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

export function DeniedScreen({ user }: { user: User }) {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">Este espacio es privado 🔒</h1>
      <p className="mt-2 max-w-xs text-muted">
        <b className="text-ink">{user.email}</b> no tiene acceso. Entra con la cuenta de Nita o de Kitos.
      </p>
      <button onClick={logout} className="mt-8 h-12 rounded-2xl bg-ink px-6 font-bold text-white active:scale-[0.98]">
        Usar otra cuenta
      </button>
    </Shell>
  )
}

export function SetupScreen() {
  return (
    <Shell>
      <h1 className="text-2xl font-extrabold">Falta conectar Firebase</h1>
      <p className="mt-2 max-w-sm text-muted">
        Copia <code className="rounded bg-white px-1.5 py-0.5 text-ink">.env.example</code> a{' '}
        <code className="rounded bg-white px-1.5 py-0.5 text-ink">.env.local</code>, rellena las claves de tu proyecto de Firebase y reinicia{' '}
        <code className="rounded bg-white px-1.5 py-0.5 text-ink">npm run dev</code>. Tienes los pasos en el README.
      </p>
    </Shell>
  )
}
