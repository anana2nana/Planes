// Avisos de bbs en este móvil: activar, probar y qué avisos quiere cada uno.
import { useEffect, useState } from 'react'
import type { PushStatus } from '../lib/push'
import type { BbsPerson } from '../lib/bbs.ts'
import { bbsPushStatus, disableBbsPush, enableBbsPush, refreshBbsPush, testBbsPush, type BbsApp } from './push'
import { saveBbsPrefs, useBbsPrefs } from './useBbs'

export function BbsNotifications({ me, app, onError }: { me: BbsPerson; app: BbsApp; onError: (m: string) => void }) {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState(false)
  const prefs = useBbsPrefs(me)

  useEffect(() => {
    bbsPushStatus().then(setStatus)
    refreshBbsPush(me, app)
  }, [me, app])

  const run = async (f: () => Promise<PushStatus>) => {
    setBusy(true)
    try {
      setStatus(await f())
    } catch (e) {
      onError(`No se pudieron cambiar los avisos: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(20,35,31,0.10)]">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Avisos de bbs en este móvil</p>
          <p className="text-xs text-muted">
            {status === 'on'
              ? 'Activados'
              : status === 'blocked'
                ? 'Bloqueados: actívalos en los ajustes del navegador (candado ▸ Notificaciones)'
                : status === 'unsupported'
                  ? 'Este navegador no puede recibir avisos (instala la app)'
                  : 'Cuando alguien apunta algo o un plan se va a acabar'}
          </p>
        </div>
        {(status === 'on' || status === 'off') && (
          <button
            role="switch"
            aria-checked={status === 'on'}
            aria-label="Avisos de bbs"
            disabled={busy}
            onClick={() => run(() => (status === 'on' ? disableBbsPush(app) : enableBbsPush(me, app)))}
            className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${status === 'on' ? 'bg-bbs' : 'bg-stone-200'}`}
          >
            <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${status === 'on' ? 'left-7' : 'left-1'}`} />
          </button>
        )}
      </div>
      {status === 'on' && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          {(
            [
              ['added', 'Cuando otro apunta algo nuevo'],
              ['ending', 'Cuando un plan con fecha se va a acabar'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm font-semibold">
              {label}
              <input type="checkbox" checked={prefs[key]} onChange={(e) => saveBbsPrefs(me, { ...prefs, [key]: e.target.checked }, onError)} className="size-5 accent-[var(--color-bbs)]" />
            </label>
          ))}
          <button
            onClick={() =>
              testBbsPush()
                .then(() => setTested(true))
                .catch((e: Error) => onError(`No se pudo mandar la prueba: ${e.message}`))
            }
            className="text-sm font-bold text-bbs-ink"
          >
            {tested ? '✓ Enviado: debería llegarte en unos segundos' : 'Mandarme un aviso de prueba'}
          </button>
          {app === 'nitakitos' && <p className="text-xs text-muted">Si también tienes instalada la app bbs, activa los avisos solo en una de las dos para no recibirlos repetidos.</p>}
        </div>
      )}
    </section>
  )
}
