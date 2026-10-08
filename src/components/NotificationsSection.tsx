import { useEffect, useState } from 'react'
import { useNotifPrefs } from '../hooks/useCollections'
import { currentPushStatus, disablePush, enablePush, sendTestPush, type PushStatus } from '../lib/push'
import { PEOPLE, partnerOf } from '../lib/people'
import { saveNotifPrefs } from '../services/plans'
import type { NotifPrefs, PersonId } from '../lib/types'
import { BellIcon } from './Icons'

const LEADS = [
  { min: 0, label: 'A la hora' },
  { min: 15, label: '15 min' },
  { min: 60, label: '1 hora' },
  { min: 180, label: '3 horas' },
  { min: 1440, label: '1 día' },
]

const STATUS_TEXT: Record<PushStatus, string> = {
  checking: 'Comprobando…',
  unsupported: 'Este navegador no admite notificaciones. En Android usa Chrome.',
  blocked: 'Bloqueadas. Actívalas en Ajustes de Android → Apps → Nitakitos (o Chrome) → Notificaciones.',
  off: 'Desactivadas en este móvil',
  on: 'Activadas en este móvil',
}

export function NotificationsSection({ me, onError }: { me: PersonId; onError: (msg: string) => void }) {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [busy, setBusy] = useState(false)
  const [testSent, setTestSent] = useState(false)
  const allPrefs = useNotifPrefs()
  const prefs = allPrefs[me]
  const partner = PEOPLE[partnerOf(me)].name

  useEffect(() => {
    currentPushStatus().then(setStatus)
  }, [])

  const run = async (fn: () => Promise<PushStatus>) => {
    setBusy(true)
    try {
      setStatus(await fn())
    } catch (e) {
      onError(`Notificaciones: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      await sendTestPush()
      setTestSent(true)
      setTimeout(() => setTestSent(false), 4000)
    } catch (e) {
      onError(`No se pudo enviar la prueba: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const update = (patch: Partial<NotifPrefs>) => saveNotifPrefs(me, { ...prefs, ...patch }).catch((e: Error) => onError(e.message))
  const toggleLead = (min: number) =>
    update({ leads: prefs.leads.includes(min) ? prefs.leads.filter((l) => l !== min) : [...prefs.leads, min].sort((a, b) => a - b) })

  const on = status === 'on'

  return (
    <div className="divide-y divide-stone-100">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${on ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
          <BellIcon className="size-4.5" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{STATUS_TEXT[status]}</p>
        {(status === 'off' || status === 'on') && (
          <button
            onClick={() => run(on ? disablePush : () => enablePush(me))}
            disabled={busy}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${
              on ? 'bg-stone-100 text-ink' : 'bg-ink text-cream'
            }`}
          >
            {on ? 'Desactivar' : 'Activar'}
          </button>
        )}
      </div>

      {on && (
        <>
          <Toggle label={`Cuando ${partner} añade o completa planes`} checked={prefs.activity} onChange={(v) => update({ activity: v })} />
          <Toggle label="Recordatorios antes de la fecha tope" checked={prefs.reminders} onChange={(v) => update({ reminders: v })} />
          {prefs.reminders && (
            <div className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-muted">Avisarme con antelación de…</p>
              <div className="flex flex-wrap gap-2">
                {LEADS.map((l) => {
                  const active = prefs.leads.includes(l.min)
                  return (
                    <button
                      key={l.min}
                      onClick={() => toggleLead(l.min)}
                      aria-pressed={active}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                        active ? 'bg-both text-white' : 'bg-stone-100 text-ink'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <Toggle label="☀️ Resumen de cada mañana con lo de hoy" checked={prefs.digest} onChange={(v) => update({ digest: v })} />
          {prefs.digest && (
            <div className="px-4 py-3">
              <p className="mb-2 text-xs font-semibold text-muted">¿A qué hora?</p>
              <div className="flex flex-wrap gap-2">
                {[6, 7, 8, 9, 10].map((h) => (
                  <button
                    key={h}
                    onClick={() => update({ digestHour: h })}
                    aria-pressed={prefs.digestHour === h}
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                      prefs.digestHour === h ? 'bg-both text-white' : 'bg-stone-100 text-ink'
                    }`}
                  >
                    {h}:00
                  </button>
                ))}
              </div>
            </div>
          )}
          <Toggle label="🏗️ Avisos de la casa (pago de mañana, ahorro)" checked={prefs.home} onChange={(v) => update({ home: v })} />
          <div className="px-4 py-3">
            <button onClick={test} disabled={busy} className="text-sm font-bold text-both disabled:opacity-50">
              {testSent ? '¡Enviada! Debería llegarte en unos segundos' : 'Enviarme una notificación de prueba'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 text-sm font-semibold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-stone-200 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-surface after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  )
}
