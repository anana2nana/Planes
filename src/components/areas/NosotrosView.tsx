import { useEffect } from 'react'
import { saveCoupleSince, useCouple } from '../../hooks/useCouple'
import { useIdeas } from '../../hooks/useIdeas'
import { useMemories } from '../../hooks/useMemories'
import { useSection } from '../../hooks/useSection'
import { nextAnniversary, togetherBreakdown, togetherText } from '../../lib/couple'
import { OCCASIONS, upcomingOccasions } from '../../lib/gifts'
import type { Idea } from '../../lib/ideas'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { GiftsView } from '../GiftsView'
import { IdeasView } from '../IdeasView'
import { DiaryView } from '../memories/DiaryView'
import { AreaTitle, SoonTile, Tile } from '../hub/Tile'
import type { AreaTitleInfo } from './types'

export type NosotrosSection = 'diario' | 'ideas' | 'regalos'
const TITLE: Record<NosotrosSection, string> = { diario: 'Diario', ideas: 'Algún día', regalos: 'Regalos' }

/** Nosotros: el tiempo juntos, el diario, las ideas de planes y los regalos. */
export function NosotrosView({ me, onError, onTitle, onMakePlan }: { me: PersonId; onError: (m: string) => void; onTitle: (t: AreaTitleInfo | null) => void; onMakePlan: (i: Idea) => void }) {
  const [section, open] = useSection<NosotrosSection>('nosotros')
  useEffect(() => {
    onTitle(section ? { title: TITLE[section], crumb: 'Nosotros' } : null)
  }, [section, onTitle])

  if (section === 'diario') return <DiaryView me={me} onError={onError} />
  if (section === 'ideas') return <IdeasView me={me} onMakePlan={onMakePlan} onError={onError} />
  if (section === 'regalos') return <GiftsView me={me} onError={onError} />
  return <NosotrosHub me={me} onOpen={open} onError={onError} />
}

function NosotrosHub({ me, onOpen, onError }: { me: PersonId; onOpen: (s: NosotrosSection) => void; onError: (m: string) => void }) {
  const { since, birthdays } = useCouple()
  const { memories } = useMemories()
  const ideas = useIdeas()
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const now = new Date()
  const pendingIdeas = ideas.filter((i) => !i.done).length
  const lastMemory = [...memories].sort((a, b) => b.date.localeCompare(a.date))[0]
  const nextOccasion = upcomingOccasions(birthdays[partner], since, now)[0]
  const anniv = since ? nextAnniversary(since, now) : null

  return (
    <div className="space-y-5">
      {/* Tiempo juntos */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-rose-400 via-pink-400 to-violet-400 p-5 text-white shadow-lg shadow-pink-300/40">
        <div className="flex items-center gap-2">
          <Avatar mode="nita" size="md" className="ring-2 ring-white/70" />
          <Avatar mode="kitos" size="md" className="-ml-4 ring-2 ring-white/70" />
          <p className="ml-1 text-sm font-bold opacity-95">
            {PEOPLE.nita.name} y {PEOPLE.kitos.name}
          </p>
        </div>
        {since ? (
          <>
            <p className="mt-3 text-xs font-bold uppercase tracking-wider opacity-90">Juntos desde hace</p>
            <p className="text-2xl font-extrabold leading-tight">{togetherText(togetherBreakdown(since, now))}</p>
            {anniv && <p className="mt-2 text-sm font-semibold opacity-95">{anniv.days === 0 ? `🎉 ¡Hoy hacéis ${anniv.years} ${anniv.years === 1 ? 'año' : 'años'}!` : `💞 Faltan ${anniv.days} días para vuestro ${anniv.years}.º aniversario`}</p>}
          </>
        ) : (
          <label className="mt-3 block">
            <span className="text-sm font-bold">¿Desde cuándo estáis juntos?</span>
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && saveCoupleSince(e.target.value).catch((err: Error) => onError(err.message))}
              aria-label="Juntos desde"
              className="mt-2 h-11 w-full rounded-2xl bg-white/90 px-3 font-semibold text-ink outline-none"
            />
          </label>
        )}
      </div>

      <section>
        <AreaTitle>Lo vuestro</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onOpen('diario')} className="relative col-span-2 overflow-hidden rounded-3xl bg-surface text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] active:scale-[0.99]">
            {lastMemory?.thumb && <img src={lastMemory.thumb} alt="" className="h-32 w-full object-cover" />}
            <div className="p-4">
              <p className="font-extrabold">📸 Diario</p>
              <p className="text-xs text-muted">{memories.length === 0 ? 'Fotos y frases de lo que hacéis juntos' : `${memories.length} ${memories.length === 1 ? 'recuerdo' : 'recuerdos'} · el último: ${lastMemory.title}`}</p>
            </div>
          </button>
          <Tile emoji="💡" title="Algún día" onClick={() => onOpen('ideas')} muted={pendingIdeas === 0}>
            {pendingIdeas === 0 ? 'Ideas de planes sin fecha' : `${pendingIdeas} ${pendingIdeas === 1 ? 'idea' : 'ideas'} · 🎲 ¿qué hacemos hoy?`}
          </Tile>
          <Tile emoji="🎁" title="Regalos" onClick={() => onOpen('regalos')}>
            {nextOccasion ? (
              <>
                {nextOccasion.id === 'cumple' ? `Cumple de ${PEOPLE[partner].name}` : OCCASIONS[nextOccasion.id].label}
                <span className="block">{nextOccasion.days === 0 ? 'hoy' : `en ${nextOccasion.days} días`} · 🔐 solo tú</span>
              </>
            ) : (
              'Ideas secretas para tu pareja'
            )}
          </Tile>
          <SoonTile emoji="✈️" title="Viajes">
            Fechas, reservas, maleta y presupuesto
          </SoonTile>
        </div>
      </section>
    </div>
  )
}
