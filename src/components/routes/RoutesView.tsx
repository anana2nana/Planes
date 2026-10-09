import { useRef, useState } from 'react'
import { removeItem, saveItem } from '../../hooks/useList'
import { useLayer } from '../../hooks/useLayer'
import { useSheetState } from '../../hooks/useSheetState'
import type { MemoryDraft } from '../../hooks/useMemories'
import { durationText, encodePolyline, kmFmt, paceText, parseGpx, profile, thin, trackStats } from '../../lib/geo'
import { ymd } from '../../lib/memories'
import type { PersonId, PlaceInfo } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { DirectionsLink } from '../DirectionsLink'
import { ChevronIcon, NavigateIcon, PlusIcon, TrashIcon } from '../Icons'
import { MemorySheet } from '../memories/MemorySheet'
import { AssigneePicker } from '../Pickers'
import { PlaceField } from '../PlaceField'
import { LineChart } from '../home/Charts'
import { RouteMap, TrackShape } from './RouteMap'
import { RouteRecorder, readLiveRoute } from './RouteRecorder'
import { DIFFICULTY, ROUTE_KINDS, emptyRoute, routeTotals, startPlace, useRoutes, type Route, type RouteDraft, type RouteKind } from './useRoutes'

const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** De un archivo GPX a una ruta (hecha si trae horas, por hacer si no). */
export async function routeFromGpx(file: File): Promise<RouteDraft | null> {
  const { name, points } = parseGpx(await file.text())
  if (points.length < 2) return null
  const pts = thin(points)
  const st = trackStats(points)
  const timed = points[0].t !== null
  return emptyRoute({
    title: name || file.name.replace(/\.gpx$/i, '').replace(/[-_]+/g, ' ').trim().slice(0, 100),
    status: timed ? 'done' : 'want',
    kind: st.gain > 150 || st.km > 8 ? 'senderismo' : 'paseo',
    date: timed ? ymd(new Date(points[0].t!)) : null,
    polyline: encodePolyline(pts),
    profile: profile(points),
    start: { lat: pts[0].lat, lng: pts[0].lng },
    stats: st,
    source: 'gpx',
  })
}

/** Rutas: las que habéis hecho (grabadas con el móvil o importadas) y las que queréis hacer. */
export function RoutesView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { items, loading } = useRoutes()
  const [tab, setTab] = useState<'done' | 'want'>('done')
  const [map, setMap] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [recording, setRecording] = useState<{ guide: Route | null } | null>(null)
  const [sheet, openSheet, closeSheet] = useSheetState<RouteDraft>()
  const file = useRef<HTMLInputElement>(null)
  const today = ymd(new Date())
  const totals = routeTotals(items, today)
  const live = recording ? null : readLiveRoute(me)
  const list = items
    .filter((r) => r.status === tab)
    .sort((a, b) => (tab === 'done' ? (b.date ?? '').localeCompare(a.date ?? '') || b.createdAt - a.createdAt : b.createdAt - a.createdAt))
  const current = open ? items.find((r) => r.id === open) : undefined
  const withTrack = items.filter((r) => r.status === 'done' && r.polyline)

  const importGpx = async (f: File | undefined) => {
    if (!f) return
    try {
      const d = await routeFromGpx(f)
      if (!d) return onError('Ese archivo no tiene ninguna ruta (¿es un GPX?)')
      openSheet(d)
    } catch {
      onError('No se ha podido leer el archivo')
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {live && (
        <button onClick={() => setRecording({ guide: items.find((r) => r.id === live.guideId) ?? null })} className="flex w-full items-center gap-3 rounded-3xl bg-rose-50 p-4 text-left">
          <span className="text-2xl" aria-hidden>
            🔴
          </span>
          <span className="flex-1">
            <span className="block font-bold text-rose-700">Tienes una ruta a medias</span>
            <span className="block text-xs text-rose-700/80">Toca para seguir grabando o terminarla</span>
          </span>
          <ChevronIcon className="size-4 text-rose-700" />
        </button>
      )}

      <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white shadow-lg shadow-emerald-300/40">
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">Este mes</p>
        <p className="tabular text-3xl font-extrabold">{kmFmt(totals.monthKm)}</p>
        <p className="text-sm opacity-90">
          {totals.monthCount} {totals.monthCount === 1 ? 'ruta' : 'rutas'} · {kmFmt(totals.totalKm)} en total
        </p>
        {!live && (
          <button onClick={() => setRecording({ guide: null })} className="mt-3 h-13 w-full rounded-2xl bg-white text-lg font-extrabold text-emerald-700 active:scale-[0.99]">
            ▶ Salir a caminar
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => file.current?.click()} className="rounded-2xl bg-surface py-3 text-sm font-bold shadow-sm">
          📂 Importar GPX
        </button>
        <button onClick={() => openSheet(emptyRoute())} className="flex items-center justify-center gap-1.5 rounded-2xl bg-surface py-3 text-sm font-bold shadow-sm">
          <PlusIcon className="size-4" /> Ruta por hacer
        </button>
        <input ref={file} type="file" className="hidden" aria-label="Archivo GPX" onChange={(e) => importGpx(e.target.files?.[0])} />
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Rutas">
        {(
          [
            ['done', `Hechas${totals.doneCount ? ` ${totals.doneCount}` : ''}`],
            ['want', `Por hacer${totals.wantCount ? ` ${totals.wantCount}` : ''}`],
          ] as const
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 rounded-xl text-sm font-bold ${tab === t ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : list.length === 0 ? (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">
          {tab === 'done' ? 'Dale a “Salir a caminar” al empezar un paseo y la app apunta el camino con el GPS. También podéis importar un GPX de Wikiloc, AllTrails o un reloj.' : 'Guardad aquí las rutas que os apetece hacer: con el enlace de Wikiloc o el GPX para tener el camino en el mapa.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => (
            <li key={r.id}>
              <RouteCard r={r} onOpen={() => setOpen(r.id)} />
            </li>
          ))}
        </ul>
      )}

      {withTrack.length > 0 && (
        <>
          <button onClick={() => setMap((v) => !v)} className={`${card} flex w-full items-center gap-3 text-left`}>
            <span className="text-2xl" aria-hidden>
              🗺️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Todas en el mapa</span>
              <span className="block text-xs text-muted">
                {withTrack.length} {withTrack.length === 1 ? 'ruta hecha' : 'rutas hechas'}
              </span>
            </span>
            <ChevronIcon className={`size-4 text-muted transition ${map ? 'rotate-90' : ''}`} />
          </button>
          {map && <RouteMap tracks={withTrack.map((r) => ({ path: r.polyline, color: ROUTE_KINDS[r.kind].color }))} />}
        </>
      )}

      {sheet && <RouteSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
      {current && (
        <RouteDetail
          route={current}
          me={me}
          onClose={() => setOpen(null)}
          onError={onError}
          onStart={(guide) => {
            // La grabación se abre cuando la ficha ya se ha cerrado (si no, heredaría su entrada del historial).
            window.addEventListener('popstate', () => setTimeout(() => setRecording({ guide }), 0), { once: true })
            history.back()
          }}
        />
      )}
      {recording && <RouteRecorder me={me} guide={recording.guide} onClose={() => setRecording(null)} onSaved={onError} onError={onError} />}
    </div>
  )
}

function RouteCard({ r, onOpen }: { r: Route; onOpen: () => void }) {
  const k = ROUTE_KINDS[r.kind]
  return (
    <button onClick={onOpen} className={`${card} flex w-full items-center gap-3 text-left active:scale-[0.99]`}>
      <TrackShape polyline={r.polyline} color={r.status === 'done' ? k.color : '#a8a29e'} className="size-14 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">
          {k.emoji} {r.title}
        </span>
        <span className="block text-xs text-muted">
          {[r.stats?.km ? kmFmt(r.stats.km) : '', r.stats?.gain ? `↗ ${r.stats.gain} m` : '', r.status === 'done' ? durationText(r.stats?.minutes ?? null) : r.difficulty ? DIFFICULTY[r.difficulty] : '', r.date ? dayFmt.format(parseYmd(r.date)) : '']
            .filter(Boolean)
            .join(' · ') || (r.link ? 'Con enlace' : r.place?.name)}
        </span>
      </span>
      {r.who !== 'both' && <Avatar mode={r.who} size="sm" />}
    </button>
  )
}

/** Una ruta a pantalla completa: mapa, números, perfil y qué hacer con ella. */
function RouteDetail({ route: r, me, onClose, onError, onStart }: { route: Route; me: PersonId; onClose: () => void; onError: (m: string) => void; onStart: (guide: Route) => void }) {
  const close = useLayer('route', onClose)
  const [sheet, openSheet, closeSheet] = useSheetState<RouteDraft>()
  const [memory, setMemory] = useState<MemoryDraft | null>(null)
  const k = ROUTE_KINDS[r.kind]
  const st = r.stats
  const from = startPlace(r)
  const { id, createdAt: _c, ...data } = r
  void _c
  const markDone = () => saveItem('routes', { id, ...data, status: 'done', date: ymd(new Date()) }, me, onError)

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={r.title}>
      <div className="pt-safe bg-gradient-to-br from-emerald-500 to-teal-600 px-4 pb-5 text-white">
        <div className="flex items-center justify-between pb-3">
          <button onClick={close} aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-white/20">
            <ChevronIcon className="size-4 rotate-180" />
          </button>
          <button onClick={() => openSheet({ ...data, id })} className="rounded-full bg-white/20 px-3.5 py-2 text-xs font-bold">
            Editar
          </button>
        </div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">
          {k.emoji} {k.label} · {r.status === 'done' ? (r.date ? dayFmt.format(parseYmd(r.date)) : 'Hecha') : 'Por hacer'}
        </p>
        <h1 className="text-3xl font-extrabold leading-tight">{r.title}</h1>
        {r.difficulty && <p className="text-sm opacity-90">Dificultad: {DIFFICULTY[r.difficulty]}</p>}
      </div>

      <main className="mx-auto max-w-2xl space-y-3 px-4 pb-24 pt-3">
        {r.polyline ? <RouteMap tracks={[{ path: r.polyline, color: k.color, ends: true }]} /> : null}

        {st && (st.km > 0 || st.gain > 0) && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Distancia" value={kmFmt(st.km)} />
            <Stat label="Subida" value={`${st.gain} m`} />
            {r.status === 'done' && st.minutes !== null ? <Stat label="Tiempo" value={durationText(st.minutes)} /> : <Stat label="Bajada" value={`${st.loss} m`} />}
            {r.status === 'done' && st.minutes !== null && <Stat label="Ritmo" value={paceText(st.km, st.moving ?? st.minutes).replace(' min/km', '') || '—'} unit="min/km" />}
            {r.status === 'done' && st.moving !== null && st.minutes !== null && st.minutes - st.moving > 2 && <Stat label="En marcha" value={durationText(st.moving)} />}
            {r.profile.length > 1 && <Stat label="Altura máx." value={`${Math.max(...r.profile.map((p) => p.ele))} m`} />}
          </div>
        )}

        {r.profile.length > 1 && (
          <div className={card}>
            <LineChart
              title="Perfil de altitud"
              points={r.profile.map((p) => ({ x: kmFmt(p.km), y: p.ele }))}
              color={k.color}
              formatY={(v) => `${Math.round(v)} m`}
              zeroBased={false}
            />
          </div>
        )}

        {r.status === 'want' ? (
          <div className="grid gap-2">
            <button onClick={() => onStart(r)} className="h-13 rounded-2xl bg-ink text-lg font-extrabold text-cream">
              ▶ Hacerla ahora
            </button>
            <button onClick={markDone} className="h-12 rounded-2xl bg-surface font-bold shadow-sm">
              ✓ Ya la hemos hecho (sin grabar)
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMemory({ title: r.title, date: r.date ?? ymd(new Date()), kind: 'free', planId: null, place: r.place, text: '' })}
              className="h-12 rounded-2xl bg-surface font-bold shadow-sm"
            >
              📸 Al diario
            </button>
            {r.polyline && (
              <button onClick={() => onStart(r)} className="h-12 rounded-2xl bg-surface font-bold shadow-sm">
                ▶ Repetirla
              </button>
            )}
          </div>
        )}

        {(from || r.link) && (
          <div className="flex flex-wrap gap-2">
            {from && (
              <DirectionsLink place={from} className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-sm font-bold text-sky-700">
                <NavigateIcon className="size-4" /> Cómo llegar al inicio
              </DirectionsLink>
            )}
            {r.link && (
              <a href={r.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-bold text-emerald-700">
                🔗 Ver en la web
              </a>
            )}
          </div>
        )}

        {r.notes && <p className={`${card} whitespace-pre-line text-sm`}>{r.notes}</p>}
        {r.source === 'app' && <p className="text-center text-xs text-muted">Grabada con el móvil</p>}
      </main>

      {sheet && <RouteSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} onDeleted={() => window.addEventListener('popstate', () => setTimeout(close, 0), { once: true })} />}
      {memory && <MemorySheet draft={memory} me={me} onClose={() => setMemory(null)} onError={onError} />}
    </div>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-2.5 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular text-lg font-extrabold leading-tight">{value}</p>
      {unit && <p className="text-[10px] text-muted">{unit}</p>}
    </div>
  )
}

/** Crear o editar una ruta (las importadas traen el camino; las demás, lo que sepáis). */
export function RouteSheet({ draft, me, onClose, onError, onDeleted, onSaved }: { draft: RouteDraft; me: PersonId; onClose: () => void; onError: (m: string) => void; onDeleted?: () => void; onSaved?: () => void }) {
  const [d, setD] = useState(draft)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const set = (o: Partial<RouteDraft>) => setD((x) => ({ ...x, ...o }))
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const hasTrack = Boolean(d.polyline)
  const save = () => {
    if (!d.title.trim()) return
    saveItem('routes', { ...d, title: d.title.trim(), link: d.link.trim(), notes: d.notes.trim(), date: d.status === 'done' ? (d.date ?? ymd(new Date())) : d.date }, me, onError)
    onSaved?.()
    onClose()
  }
  const setStat = (o: { km?: number; gain?: number }) => set({ stats: { km: 0, gain: 0, loss: 0, minutes: null, moving: null, ...d.stats, ...o } })
  const numIn = (v: string) => (v ? Number(v.replace(',', '.')) || 0 : 0)
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? 'Editar ruta' : hasTrack ? 'Ruta importada' : 'Nueva ruta'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!d.title.trim()} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar ruta'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <input autoFocus={!isEdit && !hasTrack} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="La Pedriza, Cuerda Larga…" aria-label="Nombre de la ruta" maxLength={100} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />
        {hasTrack && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <TrackShape polyline={d.polyline} color="#16a34a" className="size-12 shrink-0 bg-white/60" />
            <span>
              <b>{kmFmt(d.stats?.km ?? 0)}</b>
              {d.stats?.gain ? ` · ↗ ${d.stats.gain} m` : ''}
              {d.stats?.minutes ? ` · ${durationText(d.stats.minutes)}` : ''}
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="Estado">
          {(
            [
              ['want', 'Por hacer'],
              ['done', 'Hecha'],
            ] as const
          ).map(([s, label]) => (
            <button key={s} type="button" role="radio" aria-checked={d.status === s} onClick={() => set({ status: s })} className={`h-9 rounded-xl text-sm font-bold ${d.status === s ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ROUTE_KINDS) as RouteKind[]).map((k) => (
            <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={d.kind === k} className={`h-11 rounded-xl text-sm font-bold ${d.kind === k ? 'bg-ink text-cream' : 'bg-stone-100 text-muted'}`}>
              {ROUTE_KINDS[k].emoji} {ROUTE_KINDS[k].label}
            </button>
          ))}
        </div>
        {d.status === 'done' && (
          <label className="block text-xs font-semibold text-muted">
            Día
            <input type="date" value={d.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} aria-label="Día" className={input} />
          </label>
        )}
        {!hasTrack && (
          <>
            <PlaceField value={d.place} onChange={(p: PlaceInfo | null) => set({ place: p, ...(p && !d.title.trim() ? { title: p.name } : {}) })} />
            <div className="grid grid-cols-2 gap-2">
              <input value={d.stats?.km || ''} onChange={(e) => setStat({ km: numIn(e.target.value) })} inputMode="decimal" placeholder="Km (aprox.)" aria-label="Kilómetros" className={input} />
              <input value={d.stats?.gain || ''} onChange={(e) => setStat({ gain: Math.round(numIn(e.target.value)) })} inputMode="numeric" placeholder="Subida (m)" aria-label="Desnivel de subida" className={input} />
            </div>
          </>
        )}
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Dificultad</p>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} type="button" onClick={() => set({ difficulty: d.difficulty === n ? null : n })} aria-pressed={d.difficulty === n} className={`h-10 rounded-xl text-sm font-bold ${d.difficulty === n ? 'bg-ink text-cream' : 'bg-stone-100 text-muted'}`}>
                {DIFFICULTY[n]}
              </button>
            ))}
          </div>
        </div>
        <AssigneePicker value={d.who} onChange={(m) => m !== 'duplicate' && set({ who: m })} me={me} allowDuplicate={false} />
        <input value={d.link} onChange={(e) => set({ link: e.target.value })} inputMode="url" placeholder="Enlace (Wikiloc, AllTrails…)" aria-label="Enlace" className={input} />
        <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Notas: dónde aparcar, fuentes, mejor época…" aria-label="Notas" rows={3} className="w-full rounded-xl border border-stone-200 bg-surface p-3 text-sm outline-none focus:border-both" />
        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar esta ruta?</p>
              <button
                onClick={() => {
                  removeItem('routes', draft.id!).catch((e: Error) => onError(e.message))
                  onDeleted?.()
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar ruta
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}
