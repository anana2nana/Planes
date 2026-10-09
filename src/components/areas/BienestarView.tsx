import { useEffect } from 'react'
import { useMeals, useRecipes } from '../../hooks/useMenu'
import { useSection } from '../../hooks/useSection'
import { weekDays, weekStart, ymd } from '../../lib/menu'
import type { PersonId } from '../../lib/types'
import { MenuView } from '../food/MenuView'
import { RecipesView } from '../food/RecipesView'
import { AreaTitle, SoonTile, Tile } from '../hub/Tile'
import type { AreaTitleInfo } from './types'

export type BienestarSection = 'menu' | 'recetas'
const TITLE: Record<BienestarSection, string> = { menu: 'Menú de la semana', recetas: 'Recetas' }

/** Bienestar: lo que coméis (menú y recetas) y, pronto, entrenos, peso y nutrición. */
export function BienestarView({ me, onError, onTitle }: { me: PersonId; onError: (m: string) => void; onTitle: (t: AreaTitleInfo | null) => void }) {
  const [section, open] = useSection<BienestarSection>('bienestar')
  useEffect(() => {
    onTitle(section ? { title: TITLE[section], crumb: 'Bienestar' } : null)
  }, [section, onTitle])

  if (section === 'menu') return <MenuView me={me} onToast={onError} />
  if (section === 'recetas') return <RecipesView me={me} onError={onError} />
  return <BienestarHub me={me} onOpen={open} />
}

function BienestarHub({ me, onOpen }: { me: PersonId; onOpen: (s: BienestarSection) => void }) {
  const days = weekDays(weekStart(new Date()))
  const today = ymd(new Date())
  const { meals } = useMeals(days[0], days[6])
  const recipes = useRecipes()
  const todays = meals.filter((m) => m.date === today && m.eat[me] !== 'fuera').sort((a, b) => Number(a.slot === 'cena') - Number(b.slot === 'cena'))
  const left = days.filter((d) => d >= today && !meals.some((m) => m.date === d && m.slot === 'comida')).length

  return (
    <div className="space-y-5">
      <section>
        <AreaTitle>Alimentación</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <Tile emoji="🍝" title="Menú" onClick={() => onOpen('menu')} wide>
            {todays.length > 0 ? (
              todays.map((m) => (
                <span key={m.id} className="block truncate">
                  {m.slot === 'cena' ? 'Cena' : 'Comida'}: <b className="text-ink">{m.title}</b>
                  {m.eat[me] === 'taper' && ' 🥡'}
                </span>
              ))
            ) : (
              <span className="block">Hoy no hay nada apuntado</span>
            )}
            {left > 0 && <span className="block">Faltan {left} {left === 1 ? 'comida' : 'comidas'} por planear esta semana</span>}
          </Tile>
          <Tile emoji="📖" title="Recetas" onClick={() => onOpen('recetas')} muted={recipes.length === 0}>
            {recipes.length === 0 ? 'Importa las tuyas o guarda vídeos' : `${recipes.length} ${recipes.length === 1 ? 'receta' : 'recetas'}`}
          </Tile>
          <SoonTile emoji="🥗" title="Nutrición">
            Colores por plato y cómo vais en la semana
          </SoonTile>
        </div>
      </section>
      <section>
        <AreaTitle>Salud</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <SoonTile emoji="🏋️" title="Entrenos">
            Rutinas, series y kilos (con tu última marca)
          </SoonTile>
          <SoonTile emoji="⚖️" title="Peso y medidas">
            Cada uno lo suyo, con su gráfica
          </SoonTile>
        </div>
      </section>
    </div>
  )
}
