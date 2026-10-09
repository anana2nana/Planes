import { useCallback, useEffect } from 'react'
import { useHome } from '../../hooks/useHome'
import { useNotes } from '../../hooks/useNotes'
import { usePet } from '../../hooks/usePet'
import { useSection } from '../../hooks/useSection'
import { useShopping } from '../../hooks/useShopping'
import { eur, nextPayment } from '../../lib/home'
import { daysUntil, nextDue } from '../../lib/pet'
import type { PersonId } from '../../lib/types'
import { HomeView } from '../home/HomeView'
import { NotesView } from '../home/NotesView'
import { PetView } from '../home/PetView'
import { ShoppingView } from '../ShoppingView'
import { PapersView, paperDays, usePapers } from '../papers/PapersView'
import { expiryLevel } from '../../lib/due'
import { AreaTitle, SoonTile, Tile } from '../hub/Tile'
import type { AreaTitleInfo } from './types'

type Section = 'meroe' | 'compra' | 'gata' | 'notas' | 'papeles'
const TITLE: Record<Section, string> = { meroe: 'MEROE', compra: 'Lista de la compra', gata: 'La gata', notas: 'Notas de casa', papeles: 'Papeles' }

/** Hogar: la casa (MEROE), la compra, la gata y las notas. Cada cosa es un espacio. */
export function HogarView({ me, onError, onTitle }: { me: PersonId; onError: (m: string) => void; onTitle: (t: AreaTitleInfo | null) => void }) {
  const [section, open] = useSection<Section>('hogar')
  // Estable entre renders: si no, el efecto de título de MEROE se repetiría sin parar.
  const meroeTitle = useCallback((t: string | null) => onTitle(t ? { title: t, crumb: 'Hogar · MEROE' } : { title: 'MEROE', crumb: 'Hogar' }), [onTitle])

  useEffect(() => {
    if (section !== 'meroe') onTitle(section ? { title: TITLE[section], crumb: 'Hogar' } : null)
  }, [section, onTitle])

  if (section === 'meroe') return <HomeView me={me} onError={onError} onTitle={meroeTitle} />
  if (section === 'compra') return <ShoppingView me={me} onToast={onError} />
  if (section === 'gata') return <PetView onError={onError} />
  if (section === 'notas') return <NotesView me={me} onError={onError} onToast={onError} />
  if (section === 'papeles') return <PapersView me={me} onError={onError} />
  return <HogarHub onOpen={open} />
}

function HogarHub({ onOpen }: { onOpen: (s: Section) => void }) {
  const { config, items } = useHome()
  const { items: shopping } = useShopping()
  const { profile, care } = usePet()
  const { notes } = useNotes()
  const today = new Date()
  const next = config ? nextPayment(items, config, today) : null
  const pending = shopping.filter((i) => !i.done)
  const due = care.filter((c) => c.last).map((c) => ({ c, days: daysUntil(nextDue(c, today), today) })).sort((a, b) => a.days - b.days)
  const late = due.filter((d) => d.days <= 0)
  const { items: papers } = usePapers()
  const expiring = papers.filter((p) => ['soon', 'urgent', 'expired'].includes(expiryLevel(paperDays(p)))).sort((a, b) => (a.expires ?? '').localeCompare(b.expires ?? ''))

  return (
    <div className="space-y-5">
      <section>
        <AreaTitle>La casa</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <Tile emoji="🏗️" title="MEROE" onClick={() => onOpen('meroe')} wide>
            {!config ? (
              'Plan de pagos, hipoteca, ahorro y muebles de la cooperativa'
            ) : next ? (
              <>
                Próximo pago: <b className="tabular text-ink">{eur(next.amount)}</b> el {next.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                <span className="block">Plan de pagos · Hipoteca · ¿Llegamos? · Muebles</span>
              </>
            ) : (
              'Plan de pagos · Hipoteca · ¿Llegamos? · Muebles'
            )}
          </Tile>
          <Tile emoji="🛒" title="Compra" onClick={() => onOpen('compra')} muted={pending.length === 0}>
            {pending.length === 0 ? (
              'Nada apuntado'
            ) : (
              <>
                <b className="text-ink">{pending.length}</b> {pending.length === 1 ? 'cosa' : 'cosas'}
                <span className="block truncate">{pending.slice(0, 3).map((i) => i.name).join(' · ')}</span>
              </>
            )}
          </Tile>
          <Tile emoji="🧾" title="Garantías y documentos" onClick={() => onOpen('papeles')} muted={papers.length === 0}>
            {expiring.length > 0 ? (
              <b className="text-rose-600">{expiring.length === 1 ? `Caduca pronto: ${expiring[0].title}` : `${expiring.length} caducan pronto`}</b>
            ) : papers.length === 0 ? (
              'Tickets, DNI, seguros… y aviso antes de que caduquen'
            ) : (
              `${papers.length} guardados · todo al día`
            )}
          </Tile>
          <Tile emoji="📝" title="Notas" onClick={() => onOpen('notas')} muted={notes.length === 0}>
            {notes.length === 0 ? 'Wifi, tallas, teléfonos…' : <span className="block truncate">{notes.slice(0, 3).map((n) => n.title).join(' · ')}</span>}
          </Tile>
        </div>
      </section>
      <section>
        <AreaTitle>Los de casa</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <Tile emoji="🐱" title={profile?.name || 'La gata'} onClick={() => onOpen('gata')} muted={!profile && care.length === 0}>
            {late.length > 0 ? (
              <b className="text-rose-600">{late.length === 1 ? `Toca: ${late[0].c.title}` : `${late.length} cuidados pendientes`}</b>
            ) : due[0] ? (
              <>
                Próximo: <b className="text-ink">{due[0].c.title}</b>
                <span className="block">{due[0].days === 1 ? 'mañana' : `en ${due[0].days} días`}</span>
              </>
            ) : care.length > 0 ? (
              'Apunta cuándo fue la última vez de cada cuidado'
            ) : (
              'Vacunas, desparasitar, peso, veterinario…'
            )}
          </Tile>
          <SoonTile emoji="🧰" title="Mantenimiento">
            Revisiones, garantías, facturas de la luz… cuando lo necesitéis
          </SoonTile>
        </div>
      </section>
    </div>
  )
}
