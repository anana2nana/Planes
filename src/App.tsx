import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAuth } from './hooks/useAuth'
import { usePlans, usePriorities, useTags } from './hooks/useCollections'
import { isFirebaseConfigured } from './lib/firebase'
import { PEOPLE } from './lib/people'
import { refreshPush } from './lib/push'
import { toggleDone } from './services/plans'
import { formatDue } from './lib/time'
import type { Kind, Plan, PersonId, PlaceInfo } from './lib/types'
import { parseShared, type Shared } from './lib/share'
import { ShareSheet } from './components/ShareSheet'
import { MemorySheet } from './components/memories/MemorySheet'
import type { MemoryDraft } from './hooks/useMemories'
import { ymd } from './lib/memories'
import { KINDS } from './lib/kinds'
import type { Idea } from './lib/ideas'
import { setIdeaDone } from './services/ideas'
import { DeniedScreen, LoginScreen, SetupScreen, Splash } from './components/AuthScreens'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Avatar } from './components/Avatar'
import { CalendarIcon, CartIcon, CheckIcon, ChevronIcon, CloudOffIcon, HomeIcon, ListIcon, PlusIcon, SlidersIcon } from './components/Icons'
import { CalendarView } from './components/CalendarView'
import { AT_HOME_TITLES, HomeView } from './components/home/HomeView'
import { FoodView, rememberFoodMode } from './components/food/FoodView'
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

type Tab = 'agenda' | 'plans' | 'tasks' | 'shopping' | 'home' | 'settings'
type Prefill = { title: string; place: PlaceInfo | null; notes: string }
type Sheet = { mode: 'new'; kind?: Kind; date?: string; idea?: Idea; prefill?: Prefill } | { mode: 'edit'; id: string } | null

/** Tipo por defecto al pulsar + en cada pestaña. */
const TAB_KIND: Record<Tab, Kind> = { agenda: 'event', plans: 'plan', tasks: 'task', shopping: 'task', home: 'plan', settings: 'plan' }
const TAB_TITLE: Record<Tab, string> = { agenda: 'Agenda', plans: 'Planes', tasks: 'Tareas', shopping: 'Comida', home: 'Casa', settings: 'Ajustes' }

/** Borrador de recuerdo a partir de un plan, cita o tarea. */
function memoryDraftOf(plan: Plan): MemoryDraft {
  const due = plan.dueAt?.toDate()
  const today = new Date()
  // Si ya pasó, la fecha del plan; si no (se completa antes), hoy.
  const date = due && due < today ? ymd(due) : ymd(today)
  return { title: plan.title, date, kind: plan.kind, planId: plan.id, place: plan.place, text: '' }
}

function greeting() {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}

function Home({ user, me }: { user: User; me: PersonId }) {
  const { plans, sync } = usePlans()
  const tags = useTags()
  const priorities = usePriorities()
  const [tab, setTabState] = useState<Tab>('agenda')
  /** Título del espacio abierto dentro de Casa (Plan de pagos, Hipoteca…), o null en la portada. */
  const [homeTitle, setHomeTitle] = useState<string | null>(null)
  const setTab = useCallback((t: Tab) => {
    // Al salir de un espacio de Casa por la barra inferior, no dejarlo "abierto" en el historial.
    if (history.state?.casa) history.replaceState(null, '')
    setTabState(t)
  }, [])
  const [sheet, setSheet] = useState<Sheet>(null)
  const [memory, setMemory] = useState<{ draft: MemoryDraft; prompt?: 'done' } | null>(null)
  const [shared, setShared] = useState<Shared | null>(null)
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
      const { next, nextAssignee, committed } = toggleDone(plan, me, plans)
      committed.catch((e: Error) => setToast(e.message))
      // Al completar un plan, siempre se pregunta por el recuerdo (foto + frase).
      if (!plan.done && plan.kind === 'plan') setMemory({ draft: memoryDraftOf(plan), prompt: 'done' })
      if (next) {
        const when = formatDue(next, plan.allDay).toLowerCase()
        setToast(
          nextAssignee !== plan.assignee
            ? `¡Hecho! ✓ La próxima (${when}) le toca a ${PEOPLE[nextAssignee].name}`
            : `¡Hecho! ✓ Se repite: ${when}`,
        )
      }
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
    else {
      setSheet(null)
      setShared(null)
    }
  }, [])

  // "Compartir → Nitakitos" desde otra app (share_target del manifest): llega a /share?title&text&url.
  useEffect(() => {
    if (location.pathname !== '/share') return
    const q = new URLSearchParams(location.search)
    history.replaceState(null, '', '/')
    history.pushState({ sheet: true }, '')
    setShared(parseShared({ title: q.get('title'), text: q.get('text'), url: q.get('url') }))
  }, [])

  useEffect(() => {
    const onPop = () => {
      if (!history.state?.sheet) {
        setSheet(null)
        setShared(null)
      }
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
          {tab === 'home' && homeTitle ? (
            <button onClick={() => history.back()} aria-label="Volver a Casa" className="grid size-12 shrink-0 place-items-center rounded-full bg-surface shadow-sm active:scale-95">
              <ChevronIcon className="size-5 rotate-180" />
            </button>
          ) : (
            <button
              onClick={() => setTab(tab === 'settings' ? 'agenda' : 'settings')}
              aria-label="Ajustes"
              className="relative shrink-0 rounded-full active:scale-95"
            >
              <Avatar mode={me} size="lg" />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-surface text-ink shadow">
                <SlidersIcon className="size-3" />
              </span>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">
              {tab === 'agenda' ? `${greeting()}, ${PEOPLE[me].name}` : tab === 'home' && homeTitle ? (AT_HOME_TITLES.includes(homeTitle) ? 'Casa' : 'Casa · MEROE') : 'Vuestro espacio'}
            </p>
            <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight">{tab === 'home' && homeTitle ? homeTitle : TAB_TITLE[tab]}</h1>
          </div>
          <SyncBadge offline={sync.offline && !sync.loading} pending={sync.pending} />
        </div>
      </header>

      <main className="px-4 pb-36 pt-2">
        <ErrorBoundary inline key={tab}>
        {tab === 'plans' || tab === 'tasks' ? (
          <PlansView
            kind={tab === 'plans' ? 'plan' : 'task'}
            plans={plans}
            me={me}
            tags={tags}
            priorities={priorities}
            loading={sync.loading}
            onOpen={(p) => openSheet({ mode: 'edit', id: p.id })}
            onToggle={onToggle}
            onMakePlan={(idea) => openSheet({ mode: 'new', kind: 'plan', idea })}
            onError={setToast}
          />
        ) : tab === 'agenda' ? (
          <CalendarView
            plans={plans}
            me={me}
            tags={tags}
            priorities={priorities}
            onOpen={(p) => openSheet({ mode: 'edit', id: p.id })}
            onToggle={onToggle}
            onCreate={(date) => openSheet({ mode: 'new', kind: 'event', date })}
            onGoTasks={() => setTab('tasks')}
            onToast={setToast}
            onGoMenu={() => {
              rememberFoodMode('menu')
              setTab('shopping')
            }}
          />
        ) : tab === 'shopping' ? (
          <FoodView me={me} onToast={setToast} />
        ) : tab === 'home' ? (
          <HomeView me={me} onError={setToast} onTitle={setHomeTitle} />
        ) : (
          <SettingsView user={user} me={me} tags={tags} plans={plans} priorities={priorities} onError={setToast} />
        )}
        </ErrorBoundary>
      </main>

      {/* Botón de crear (flotante, abajo a la derecha, como en las apps de Android) */}
      {tab !== 'home' && tab !== 'settings' && tab !== 'shopping' && <div className="pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+4.75rem)] z-40 mx-auto flex max-w-lg justify-end px-4">
        <button
          onClick={() => openSheet({ mode: 'new', kind: TAB_KIND[tab] })}
          aria-label={KINDS[TAB_KIND[tab]].new}
          className="pointer-events-auto grid size-16 place-items-center rounded-[22px] bg-gradient-to-br from-nita via-both to-kitos text-white shadow-xl shadow-violet-500/30 transition active:scale-90"
        >
          <PlusIcon className="size-7" strokeWidth={2.5} />
        </button>
      </div>}

      {/* Barra inferior */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/60 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-2">
          <NavButton active={tab === 'agenda'} onClick={() => setTab('agenda')} icon={<CalendarIcon className="size-6" />} label="Agenda" />
          <NavButton active={tab === 'plans'} onClick={() => setTab('plans')} icon={<ListIcon className="size-6" />} label="Planes" />
          <NavButton active={tab === 'tasks'} onClick={() => setTab('tasks')} icon={<CheckIcon className="size-6" strokeWidth={2.5} />} label="Tareas" />
          <NavButton active={tab === 'shopping'} onClick={() => setTab('shopping')} icon={<CartIcon className="size-6" />} label="Comida" />
          <NavButton active={tab === 'home'} onClick={() => setTab('home')} icon={<HomeIcon className="size-6" />} label="Casa" />
        </div>
      </nav>

      {memory && <MemorySheet draft={memory.draft} me={me} prompt={memory.prompt} onClose={() => setMemory(null)} onError={setToast} />}

      {shared && (
        <ShareSheet
          shared={shared}
          me={me}
          onClose={closeSheet}
          onToast={setToast}
          onMakePlan={(prefill) => {
            // Reutiliza la misma entrada del historial: el "atrás" cierra el formulario.
            setShared(null)
            setTab('plans')
            openSheet({ mode: 'new', kind: 'plan', prefill })
          }}
        />
      )}

      {sheet && (sheet.mode === 'new' || editing) && (
        <PlanForm
          key={sheet.mode === 'edit' ? sheet.id : `new-${sheet.kind ?? ''}-${sheet.date ?? ''}-${sheet.idea?.id ?? ''}`}
          plan={editing}
          defaultKind={sheet.mode === 'new' ? sheet.kind : undefined}
          defaultDate={sheet.mode === 'new' ? sheet.date : undefined}
          prefill={sheet.mode === 'new' ? (sheet.idea ? { title: sheet.idea.title, place: sheet.idea.place, notes: sheet.idea.notes } : sheet.prefill) : undefined}
          onMemory={(p) => setMemory({ draft: memoryDraftOf(p) })}
          onSaved={() => {
            if (sheet.mode === 'new' && sheet.idea) setIdeaDone(sheet.idea.id, true).catch((e: Error) => setToast(e.message))
          }}
          siblings={siblings}
          me={me}
          tags={tags}
          priorities={priorities}
          onClose={closeSheet}
          onError={setToast}
        />
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-44 z-[60] mx-auto max-w-sm animate-fade-in rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-cream shadow-xl" role="alert">
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
      <span className={`grid h-8 w-12 place-items-center rounded-full transition ${active ? 'bg-both-soft text-both' : ''}`}>{icon}</span>
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
    <span className="flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-bold text-emerald-600 shadow-sm" title="Sincronizado en tiempo real">
      <span className="relative flex size-2">
        <span className={`absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 ${pending ? 'animate-ping' : ''}`} />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      {pending ? 'Guardando' : 'En vivo'}
    </span>
  )
}
