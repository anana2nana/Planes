import { useState } from 'react'
import type { useGiftKey } from '../hooks/useGifts'
import { MIN_PASSWORD } from '../lib/giftCrypto'

const input = 'h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

/** Crear la contraseña de regalos, o escribirla para desbloquear en este móvil. */
export function GiftLock({ lock, partnerName, onError }: { lock: ReturnType<typeof useGiftKey>; partnerName: string; onError: (m: string) => void }) {
  const { state, setup, unlock, reset } = lock
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [forgot, setForgot] = useState(false)

  if (state.status === 'loading' || state.status === 'ready') return <div className="h-32 animate-pulse rounded-3xl bg-surface/70" />

  const creating = state.status === 'none'
  const valid = creating ? pw.length >= MIN_PASSWORD && pw === pw2 : pw.length > 0

  const go = async () => {
    if (!valid || busy) return
    setBusy(true)
    setWrong(false)
    try {
      if (creating) await setup(pw)
      else if (!(await unlock(pw))) setWrong(true)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 rounded-3xl bg-surface p-5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <div className="text-center">
        <div className="text-4xl">🔐</div>
        <p className="mt-2 text-lg font-extrabold">{creating ? 'Ponle una contraseña a tus regalos' : 'Tus regalos están cifrados'}</p>
        <p className="mt-1 text-sm text-muted">
          {creating
            ? `Así nadie podrá leerlos: ni ${partnerName}, ni nadie que mire la base de datos por dentro. Te la pediremos una sola vez en cada móvil.`
            : 'Escribe tu contraseña de regalos para verlos en este móvil.'}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
        className="space-y-2"
      >
        <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={creating ? 'new-password' : 'current-password'} placeholder={creating ? `Contraseña (mínimo ${MIN_PASSWORD} caracteres)` : 'Contraseña de regalos'} aria-label="Contraseña de regalos" className={input} />
        {creating && <input type={show ? 'text' : 'password'} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Repítela" aria-label="Repite la contraseña" className={input} />}
        <label className="flex items-center gap-2 px-1 text-xs font-semibold text-muted">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-both" /> Mostrar
        </label>
        {creating && pw2 && pw !== pw2 && <p className="px-1 text-xs font-semibold text-rose-600">No coinciden</p>}
        {wrong && <p className="px-1 text-xs font-semibold text-rose-600">Esa no es. Prueba otra vez.</p>}
        <button type="submit" disabled={!valid || busy} className="h-12 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          {busy ? 'Un momento…' : creating ? '🔐 Proteger mis regalos' : 'Desbloquear'}
        </button>
      </form>
      {creating ? (
        <p className="rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
          ⚠️ <b>Apúntala en un sitio seguro</b> (por ejemplo, el gestor de contraseñas de Google). Si la olvidas no hay forma de recuperar las ideas: ni yo podría. Mejor una frase que una palabra («la gata duerme en el sofá»).
        </p>
      ) : forgot ? (
        <div className="space-y-2 rounded-2xl bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-700">Si la has olvidado, se borran tus ideas de regalo (no se pueden leer sin ella) y pones una contraseña nueva.</p>
          <button onClick={() => reset().catch((e: Error) => onError(e.message))} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">
            Borrar mis ideas y empezar de cero
          </button>
        </div>
      ) : (
        <button onClick={() => setForgot(true)} className="mx-auto block text-xs font-semibold text-muted">
          ¿La has olvidado?
        </button>
      )}
    </div>
  )
}
