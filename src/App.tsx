import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAuth } from './hooks/useAuth'
import { usePlans, usePriorities, useTags } from './hooks/useCollections'
import { isFirebaseConfigured } from './lib/firebase'
import { PEOPLE } from './lib/people'
import { refreshPush } from './lib/push'
import { toggleDone } from './services/plans'
import { formatDue } from './lib/time'
import type { Plan, PersonId } from './lib/types'
import { DeniedScreen, LoginScreen, SetupScreen, Splash } from './components/AuthScreens'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Avatar } from './components/Avatar'
import { CalendarIcon, CloudOffIcon, ListIcon, PlusIcon, SlidersIcon } from './components/Icons'
import { CalendarView } from './components/CalendarView'
import { PlanForm } from './components/PlanForm'
import { PlansView } from './components/PlansView'
import { SettingsView } from './components/SettingsView'

export default function App() {
  const auth = useAuth()
  if (!isFirebaseConfigured) return <SetupScreen />
  if (auth.status === 'loading') return <Splash />
  if (auth.status === 'signed-out') return <LoginScreen />
  if (auth.status === 'denied') return <DeniedScreen user={auth.user} />
  return <Home user={auth.user} me={auth.me} />
}

type Tab = 'plans' | 'calendar' | 'settings'
type Sheet = { mode: 'new'; date?: string } | { mode: 'edit'; id: string } | null

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

function Home({ user, me }: { user: User; me: PersonId }) {
  const { plans, sync } = usePlans()
  const tags = useTags()
  const priorities = usePriorities()
  const [tab, setTab] = useState<Tab>('plans')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (sync.error) setToast(`Error de sincronización: ${sync.error}`)
  }, [sync.error])

  const editing = sheet?.mode === 'edit' ? plans.find((p) => p.id === sheet.id) ?? null : null
  const siblings = editing?.groupId ? plans.filter((p) => p.groupId === editing.groupId && p.id !== editing.id) : []

  const onToggle = useCallback(
    (plan: Plan) => {
      navigator.vibrate?.(10)
      const { next, committed } = toggleDone(plan, me, plans)
      committed.catch((e: Error) => setToast(e.message))
      if (next) setToast(`¡Hecho! ✓ Se repite: ${formatDue(next, plan.allDay).toLowerCase()}`)
    },
    [me, plans],
  )
  // La hoja de edición ocupa una entrada del historial, así el gesto/botón
  // "atrás" de Android la cierra en vez de salir de la app.
  const openSheet = useCallback((s: Exclude<Sheet, null>) => {
    if (!history.state?.sheet) history.pushState({ sheet: true }, '')
    setSheet(s)
  }, [])
  const closeSheet = useCallback(() => {
    if (history.state?.sheet) history.back() // el popstate de abajo la cierra
    else setSheet(null)
  }, [])

  useEffect(() => {
    const onPop = () => {
      if (!history.state?.sheet) setSheet(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Acceso directo "Nuevo plan" (mantener pulsado el icono de la app en Android).
  useEffect(() => {
    if (!new URLSearchParams(location.search).has('nuevo')) return
    history.replaceState(null, '', '/')
    openSheet({ mode: 'new' })
  }, [openSheet])

  // Con llaves: en Chrome reciente scrollTo devuelve una promesa, y si el efecto
  // la devolviera React la trataría como función de limpieza y fallaría.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [tab])

  useEffect(() => {
    refreshPush(me)
  }, [me])

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="pt-safe sticky top-0 z-30 bg-cream/85 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3 pt-2">
          <Avatar mode={me} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">{tab === 'plans' ? `${greeting()},` : 'Vuestro espacio'}</p>
            <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight">
              {tab === 'plans' ? PEOPLE[me].name : tab === 'calendar' ? 'Calendario' : 'Ajustes'}
            </h1>
          </div>
          <SyncBadge offline={sync.offline && !sync.loading} pending={sync.pending} />
        </div>
      </header>

      <main className="px-4 pb-36 pt-2">
        <ErrorBoundary inline key={tab}>
        {tab === 'plans' ? (
          <PlansView
            plans={plans}
            me={me}
            tags={tags}
            priorities={priorities}
            loading={sync.loading}
            onOpen={(p) => openSheet({ mode: 'edit', id: p.id })}
            onToggle={onToggle}
          />
        ) : tab === 'calendar' ? (
          <CalendarView
            plans={plans}
            me={me}
            tags={tags}
            priorities={priorities}
            onOpen={(p) => openSheet({ mode: 'edit', id: p.id })}
            onToggle={onToggle}
            onCreate={(date) => openSheet({ mode: 'new', date })}
          />
        ) : (
          <SettingsView user={user} me={me} tags={tags} plans={plans} priorities={priorities} onError={setToast} />
        )}
        </ErrorBoundary>
      </main>

      {/* Botón de crear (flotante, abajo a la derecha, como en las apps de Android) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+4.75rem)] z-40 mx-auto flex max-w-lg justify-end px-4">
        <button
          onClick={() => openSheet({ mode: 'new' })}
          aria-label="Nuevo plan"
          className="pointer-events-auto grid size-16 place-items-center rounded-[22px] bg-gradient-to-br from-nita via-both to-kitos text-white shadow-xl shadow-violet-500/30 transition active:scale-90"
        >
          <PlusIcon className="size-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* Barra inferior */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/60 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-3 px-4 pt-2">
          <NavButton active={tab === 'plans'} onClick={() => setTab('plans')} icon={<ListIcon className="size-6" />} label="Planes" />
          <NavButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<CalendarIcon className="size-6" />} label="Calendario" />
          <NavButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<SlidersIcon className="size-6" />} label="Ajustes" />
        </div>
      </nav>

      {sheet && (sheet.mode === 'new' || editing) && (
        <PlanForm
          key={sheet.mode === 'edit' ? sheet.id : `new-${sheet.date ?? ''}`}
          plan={editing}
          defaultDate={sheet.mode === 'new' ? sheet.date : undefined}
          siblings={siblings}
          me={me}
          tags={tags}
          priorities={priorities}
          onClose={closeSheet}
          onError={setToast}
        />
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-44 z-[60] mx-auto max-w-sm animate-fade-in rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl" role="alert">
          {toast}
        </div>
      )}
    </div>
  )
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-1 py-1 text-[11px] font-bold transition ${active ? 'text-ink' : 'text-stone-400'}`}
    >
      <span className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? 'bg-both-soft text-both' : ''}`}>{icon}</span>
      {label}
    </button>
  )
}

function SyncBadge({ offline, pending }: { offline: boolean; pending: boolean }) {
  if (offline) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
        <CloudOffIcon className="size-3.5" /> Sin conexión
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-600 shadow-sm" title="Sincronizado en tiempo real">
      <span className="relative flex size-2">
        <span className={`absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 ${pending ? 'animate-ping' : ''}`} />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      {pending ? 'Guardando' : 'En vivo'}
    </span>
  )
}
