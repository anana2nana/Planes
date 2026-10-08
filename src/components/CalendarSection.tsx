import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { PersonId } from '../lib/types'

const calRef = doc(db, 'config', 'calendar')
const newToken = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')

/** Enlace secreto para ver la agenda en Google Calendar (feed iCal de la función calendarFeed). */
export function CalendarSection({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [onlyMine, setOnlyMine] = useState(true)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(
    () =>
      onSnapshot(
        calRef,
        (s) => setToken(typeof s.get('token') === 'string' ? s.get('token') : null),
        () => setToken(null),
      ),
    [],
  )

  const create = () => {
    setConfirm(false)
    setDoc(calRef, { token: newToken() }, { merge: true }).catch((e: Error) => onError(e.message))
  }

  if (token === undefined) return <div className="h-16 animate-pulse" />
  if (!token)
    return (
      <div className="space-y-3 px-4 py-4">
        <p className="text-sm text-muted">Ved las citas, planes y tareas con fecha dentro de Google Calendar, junto al resto de vuestras cosas. Se actualiza solo.</p>
        <button onClick={create} className="h-11 w-full rounded-2xl bg-ink font-bold text-cream active:scale-[0.99]">
          📆 Crear enlace para Google Calendar
        </button>
      </div>
    )

  const host = `europe-west1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`
  const query = `calendarFeed?t=${token}${onlyMine ? `&who=${me}` : ''}`
  const url = `https://${host}/${query}`
  const addUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${host}/${query}`)}`

  const copy = () => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => onError('No se pudo copiar: mantén pulsado el enlace para copiarlo'))
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Qué incluir">
        {[
          { v: true, label: 'Lo mío' },
          { v: false, label: 'Todo' },
        ].map((o) => (
          <button
            key={o.label}
            role="radio"
            aria-checked={onlyMine === o.v}
            onClick={() => setOnlyMine(o.v)}
            className={`h-9 rounded-xl text-sm font-bold transition ${onlyMine === o.v ? 'bg-surface shadow-sm' : 'text-muted'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{onlyMine ? 'Lo tuyo y lo de los dos.' : 'También lo de tu pareja.'} Las citas que se repiten salen todas; los planes y tareas, mientras estén pendientes.</p>
      <p className="select-all break-all rounded-xl bg-stone-50 px-3 py-2 font-mono text-[11px] text-muted">{url}</p>
      <div className="flex gap-2">
        <a href={addUrl} target="_blank" rel="noreferrer" className="grid h-11 flex-1 place-items-center rounded-2xl bg-ink text-sm font-bold text-cream active:scale-[0.99]">
          Añadir a Google Calendar
        </a>
        <button onClick={copy} className="h-11 rounded-2xl bg-stone-100 px-4 text-sm font-bold active:scale-95">
          {copied ? '✓ Copiado' : 'Copiar'}
        </button>
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer font-semibold text-ink">¿Cómo se añade?</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Toca «Añadir a Google Calendar» y acepta. Si no te deja desde el móvil, copia el enlace y, en el ordenador, ve a calendar.google.com → «Otros calendarios» (+) → «Desde URL» → pégalo.</li>
          <li>En el móvil, abre la app Calendar → menú ☰ → Ajustes → toca «Nitakitos» → activa «Sincronizar».</li>
          <li>Google lo actualiza cada pocas horas (no al instante). Para cambiar algo, hazlo aquí en la app.</li>
        </ol>
      </details>
      {confirm ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
          <p className="flex-1 text-xs font-semibold text-rose-700">El enlace antiguo dejará de funcionar (también para tu pareja). ¿Seguro?</p>
          <button onClick={create} className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">
            Cambiar
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="text-xs font-semibold text-rose-600">
          Cambiar el enlace (si se lo has pasado a alguien por error)
        </button>
      )}
    </div>
  )
}
