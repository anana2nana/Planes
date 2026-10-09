import { useEffect, useRef, useState } from 'react'
import { removeItem, saveItem } from '../../hooks/useList'
import { useLayer } from '../../hooks/useLayer'
import { useWakeLock } from '../../hooks/useWakeLock'
import { encodePolyline, kmFmt, paceText, profile, shouldKeep, thin, trackStats, type TrackPoint } from '../../lib/geo'
import { ymd } from '../../lib/memories'
import { clock } from '../../lib/recipe'
import type { PersonId } from '../../lib/types'
import { AssigneePicker } from '../Pickers'
import { RouteMap } from './RouteMap'
import { ROUTE_KINDS, type Route, type RouteDraft, type RouteKind } from './useRoutes'

// ─── Ruta a medias (en este móvil): si se cierra la app, se sigue donde estaba ───

interface LiveRoute {
  points: TrackPoint[]
  startedAt: number
  /** Milisegundos en pausa (acumulados). */
  pausedMs: number
  /** Desde cuándo está en pausa (o null si está grabando). */
  pausedAt: number | null
  /** La ruta "por hacer" que se está siguiendo. */
  guideId: string | null
}
const KEY = (me: PersonId) => `nitakitos.route.${me}`
export function readLiveRoute(me: PersonId): LiveRoute | null {
  try {
    const x = JSON.parse(localStorage.getItem(KEY(me)) ?? 'null')
    return Array.isArray(x?.points) ? x : null
  } catch {
    return null
  }
}
const writeLive = (me: PersonId, l: LiveRoute | null) => {
  try {
    if (l) localStorage.setItem(KEY(me), JSON.stringify(l))
    else localStorage.removeItem(KEY(me))
  } catch {
    /* sin espacio: se sigue grabando en memoria */
  }
}

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

/**
 * Grabar una ruta con el GPS del móvil, a pantalla completa. La pantalla se queda encendida
 * (con la pantalla apagada Chrome deja de recibir el GPS) y el "modo bolsillo" la pone en negro.
 */
export function RouteRecorder({ me, guide, onClose, onSaved, onError }: { me: PersonId; guide?: Route | null; onClose: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const close = useLayer('routeRec', onClose)
  useWakeLock()
  const [live, setLive] = useState<LiveRoute>(() => readLiveRoute(me) ?? { points: [], startedAt: Date.now(), pausedMs: 0, pausedAt: null, guideId: guide?.id ?? null })
  const liveRef = useRef(live)
  liveRef.current = live
  const [here, setHere] = useState<{ lat: number; lng: number; acc: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [pocket, setPocket] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const paused = live.pausedAt !== null

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => writeLive(me, live), [me, live])

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Este móvil no deja usar la ubicación.')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        const { latitude: lat, longitude: lng, accuracy, altitude } = pos.coords
        setHere({ lat, lng, acc: accuracy })
        const l = liveRef.current
        if (l.pausedAt !== null) return
        const p: TrackPoint = { lat, lng, ele: altitude ?? null, t: pos.timestamp || Date.now() }
        if (shouldKeep(l.points[l.points.length - 1] ?? null, p, accuracy)) setLive((x) => ({ ...x, points: [...x.points, p] }))
      },
      (e) => setGpsError(e.code === 1 ? 'Nitakitos no tiene permiso para usar la ubicación. En Chrome: candado de la barra de direcciones → Permisos → Ubicación → Permitir.' : 'Buscando señal GPS… (mejor al aire libre)'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  const elapsed = Math.max(0, (live.pausedAt ?? now) - live.startedAt - live.pausedMs)
  const stats = trackStats(live.points)
  const minutes = Math.floor(elapsed / 60_000)
  const togglePause = () =>
    setLive((x) => (x.pausedAt === null ? { ...x, pausedAt: Date.now() } : { ...x, pausedMs: x.pausedMs + (Date.now() - x.pausedAt), pausedAt: null }))

  const discard = () => {
    writeLive(me, null)
    close()
  }

  const tracks = [
    ...(guide?.polyline ? [{ path: guide.polyline, color: '#78716c', dashed: true }] : []),
    { path: live.points.map((p) => ({ lat: p.lat, lng: p.lng })), color: ROUTE_KINDS[guide?.kind ?? 'paseo'].color, ends: false },
  ]

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-cream animate-fade-in" role="dialog" aria-label="Grabando ruta">
      <div className="pt-safe flex items-center justify-between px-4 pb-2">
        <button onClick={close} className="rounded-full bg-stone-100 px-3.5 py-2 text-xs font-bold text-muted">
          ← Volver
        </button>
        <p className="text-sm font-bold">{paused ? '⏸ En pausa' : live.points.length ? '🔴 Grabando' : '📡 Buscando GPS…'}</p>
        <button onClick={() => setPocket(true)} className="rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-cream">
          🔒 Bolsillo
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-4">
        <RouteMap tracks={tracks} height="h-full" follow here={here} />
        {here && <p className="absolute bottom-2 left-6 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-semibold text-muted">GPS ±{Math.round(here.acc)} m</p>}
      </div>

      {finishing ? (
        <FinishForm
          me={me}
          guide={guide ?? null}
          points={live.points}
          minutes={minutes}
          onBack={() => setFinishing(false)}
          onSave={(d) => {
            const pts = thin(live.points)
            const st = trackStats(live.points)
            const fromGuide = guide?.status === 'want' ? guide : null
            saveItem<RouteDraft>(
              'routes',
              {
                title: d.title,
                status: 'done',
                kind: d.kind,
                who: d.who,
                date: ymd(new Date(live.startedAt)),
                polyline: encodePolyline(pts),
                profile: profile(live.points),
                start: pts[0] ? { lat: pts[0].lat, lng: pts[0].lng } : null,
                stats: { ...st, minutes, moving: Math.min(st.moving ?? minutes, minutes) },
                difficulty: fromGuide?.difficulty ?? null,
                link: fromGuide?.link ?? '',
                notes: [d.notes, fromGuide?.notes].filter(Boolean).join('\n'),
                place: fromGuide?.place ?? null,
                source: 'app',
              },
              me,
              onError,
            )
            // La que estaba "por hacer" pasa a ser esta (con sus notas y enlace).
            if (fromGuide) removeItem('routes', fromGuide.id).catch((e: Error) => onError(e.message))
            writeLive(me, null)
            onSaved(`Ruta guardada: ${kmFmt(st.km)} 🥾`)
            close()
          }}
          onDiscard={discard}
        />
      ) : (
        <div className="space-y-3 px-4 pb-6 pt-3">
          {gpsError && <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{gpsError}</p>}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Big label="Distancia" value={kmFmt(stats.km)} />
            <Big label="Tiempo" value={clock(Math.floor(elapsed / 1000))} />
            <Big label="Ritmo" value={paceText(stats.km, minutes || null).replace(' min/km', '') || '—'} unit="min/km" />
          </div>
          {stats.gain > 0 && <p className="text-center text-xs font-semibold text-muted">↗ {stats.gain} m de subida</p>}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={togglePause} className={`h-14 rounded-2xl text-lg font-extrabold ${paused ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-ink'}`}>
              {paused ? '▶ Seguir' : '⏸ Pausa'}
            </button>
            <button onClick={() => setFinishing(true)} className="h-14 rounded-2xl bg-ink text-lg font-extrabold text-cream">
              ■ Terminar
            </button>
          </div>
          <p className="text-center text-[11px] leading-snug text-muted">Deja Nitakitos abierta mientras andas: con la pantalla apagada el móvil deja de apuntar el camino. Usa 🔒 Bolsillo para que no se toque nada.</p>
        </div>
      )}

      {pocket && <Pocket km={kmFmt(stats.km)} time={clock(Math.floor(elapsed / 1000))} paused={paused} onUnlock={() => setPocket(false)} />}
    </div>
  )
}

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-2.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular text-2xl font-extrabold leading-tight">{value}</p>
      {unit && <p className="text-[10px] text-muted">{unit}</p>}
    </div>
  )
}

/** Pantalla negra (gasta menos en las pantallas OLED de los Pixel); se desbloquea manteniendo pulsado. */
function Pocket({ km, time, paused, onUnlock }: { km: string; time: string; paused: boolean; onUnlock: () => void }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = () => {
    setHolding(true)
    timer.current = setTimeout(onUnlock, 1200)
  }
  const stop = () => {
    setHolding(false)
    if (timer.current) clearTimeout(timer.current)
  }
  return (
    <div className="fixed inset-0 z-[60] flex touch-none select-none flex-col items-center justify-center bg-black text-stone-500" role="dialog" aria-label="Modo bolsillo" onContextMenu={(e) => e.preventDefault()}>
      <p className="tabular text-6xl font-extrabold">{km}</p>
      <p className="tabular mt-2 text-3xl font-bold">{time}</p>
      {paused && <p className="mt-2 text-sm font-bold">⏸ En pausa</p>}
      <button
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        className="absolute bottom-16 grid size-24 place-items-center rounded-full border-2 border-stone-700 text-xs font-bold"
        aria-label="Mantén pulsado para desbloquear"
      >
        <span className={`absolute inset-0 rounded-full bg-stone-800 transition-transform ease-linear ${holding ? 'scale-100 duration-[1200ms]' : 'scale-0 duration-150'}`} />
        <span className="relative">
          🔓
          <br />
          Mantén
        </span>
      </button>
    </div>
  )
}

function FinishForm({
  me,
  guide,
  points,
  minutes,
  onBack,
  onSave,
  onDiscard,
}: {
  me: PersonId
  guide: Route | null
  points: TrackPoint[]
  minutes: number
  onBack: () => void
  onSave: (d: { title: string; kind: RouteKind; who: 'nita' | 'kitos' | 'both'; notes: string }) => void
  onDiscard: () => void
}) {
  const st = trackStats(points)
  const [title, setTitle] = useState(guide?.title ?? `${st.gain > 150 || st.km > 8 ? 'Ruta' : 'Paseo'} del ${dayFmt.format(new Date())}`)
  const [kind, setKind] = useState<RouteKind>(guide?.kind ?? (st.gain > 150 || st.km > 8 ? 'senderismo' : 'paseo'))
  const [who, setWho] = useState<'nita' | 'kitos' | 'both'>(guide?.who ?? 'both')
  const [notes, setNotes] = useState('')
  const [confirm, setConfirm] = useState(false)
  const ok = points.length >= 2
  return (
    <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-t-3xl bg-surface px-4 pb-8 pt-4 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.2)]">
      <p className="text-sm font-semibold text-muted">
        {kmFmt(st.km)} · {minutes} min{st.gain ? ` · ↗ ${st.gain} m` : ''}
      </p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nombre de la ruta" maxLength={100} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none focus:border-both" style={{ fontSize: 20 }} />
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ROUTE_KINDS) as RouteKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`h-11 rounded-xl text-sm font-bold ${kind === k ? 'bg-ink text-cream' : 'bg-stone-100 text-muted'}`}>
            {ROUTE_KINDS[k].emoji} {ROUTE_KINDS[k].label}
          </button>
        ))}
      </div>
      <AssigneePicker value={who} onChange={(m) => m !== 'duplicate' && setWho(m)} me={me} allowDuplicate={false} />
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional): cómo fue, dónde aparcar…" aria-label="Notas" rows={2} className="w-full rounded-xl border border-stone-200 bg-surface p-3 text-sm outline-none focus:border-both" />
      {!ok && <p className="text-sm font-semibold text-amber-700">Aún no hay camino apuntado: espera a que el GPS encuentre señal y anda un poco.</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onBack} className="h-12 rounded-2xl bg-stone-100 font-bold">
          Seguir andando
        </button>
        <button onClick={() => onSave({ title: title.trim() || 'Ruta', kind, who, notes: notes.trim() })} disabled={!ok} className="h-12 rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar ruta
        </button>
      </div>
      {confirm ? (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
          <p className="flex-1 text-sm font-semibold text-rose-700">¿Tirar esta ruta sin guardarla?</p>
          <button onClick={onDiscard} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">
            Tirar
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="mx-auto block text-sm font-semibold text-rose-600">
          Descartar
        </button>
      )}
    </div>
  )
}
