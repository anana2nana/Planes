import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAuth } from './hooks/useAuth'
import { usePlans, usePriorities, useTags } from './hooks/useCollections'
import { isFirebaseConfigured } from './lib/firebase'
import { PEOPLE } from './lib/people'
import { toggleDone } from './services/plans'
import type { Plan, PersonId } from './lib/types'
import { DeniedScreen, LoginScreen, SetupScreen, Splash } from './components/AuthScreens'
import { Avatar } from './components/Avatar'
import { CloudOffIcon, ListIcon, PlusIcon, SlidersIcon } from './components/Icons'
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

type Tab = 'plans' | 'settings'
type Sheet = { mode: 'new' } | { mode: 'edit'; id: string } | null

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
      toggleDone(plan, me).catch((e: Error) => setToast(e.message))
    },
    [me],
  )
  const closeSheet = useCallback(() => setSheet(null), [])

  useEffect(() => window.scrollTo({ top: 0 }), [tab])

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <header className="pt-safe sticky top-0 z-30 bg-cream/85 px-4 pb-3 backdrop-blur-xl">
        <div className="flex items-center gap-3 pt-2">
          <Avatar mode={me} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">{tab === 'plans' ? `${greeting()},` : 'Vuestro espacio'}</p>
            <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight">
              {tab === 'plans' ? PEOPLE[me].name : 'Ajustes'}
            </h1>
          </div>
          <SyncBadge offline={sync.offline && !sync.loading} pending={sync.pending} />
        </div>
      </header>

      <main className="px-4 pb-36 pt-2">
        {tab === 'plans' ? (
          <PlansView
            plans={plans}
            me={me}
            tags={tags}
            priorities={priorities}
            loading={sync.loading}
            onOpen={(p) => setSheet({ mode: 'edit', id: p.id })}
            onToggle={onToggle}
          />
        ) : (
          <SettingsView user={user} me={me} tags={tags} plans={plans} priorities={priorities} onError={setToast} />
        )}
      </main>

      {/* Barra inferior + botón de crear */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/60 bg-white/85 backdrop-blur-xl">
        <div className="relative mx-auto grid max-w-lg grid-cols-2 px-6 pt-2">
          <NavButton active={tab === 'plans'} onClick={() => setTab('plans')} icon={<ListIcon className="size-6" />} label="Planes" />
          <NavButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<SlidersIcon className="size-6" />} label="Ajustes" />
          <button
            onClick={() => setSheet({ mode: 'new' })}
            aria-label="Nuevo plan"
            className="absolute -top-7 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full bg-gradient-to-br from-nita via-both to-kitos text-white shadow-xl shadow-violet-500/30 ring-4 ring-cream transition active:scale-90"
          >
            <PlusIcon className="size-7" strokeWidth={2.5} />
          </button>
        </div>
      </nav>

      {sheet && (sheet.mode === 'new' || editing) && (
        <PlanForm
          key={sheet.mode === 'edit' ? sheet.id : 'new'}
          plan={editing}
          siblings={siblings}
          me={me}
          tags={tags}
          priorities={priorities}
          onClose={closeSheet}
          onError={setToast}
        />
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-28 z-[60] mx-auto max-w-sm animate-fade-in rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl" role="alert">
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
      className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-bold transition ${active ? 'text-ink' : 'text-stone-400'} ${
        label === 'Planes' ? 'justify-self-start' : 'justify-self-end'
      }`}
    >
      {icon}
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
