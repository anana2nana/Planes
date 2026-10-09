import { useEffect } from 'react'
import { useMeals, useRecipes } from '../../hooks/useMenu'
import { useSection } from '../../hooks/useSection'
import { portions, weekDays, weekStart, ymd } from '../../lib/menu'
import { COLOR_ORDER, dishNutrition, weekBalance } from '../../lib/nutrition'
import type { PersonId } from '../../lib/types'
import { MenuView } from '../food/MenuView'
import { ColorDot } from '../food/Nutrition'
import { NutritionView } from '../food/NutritionView'
import { BodyView } from '../fitness/BodyView'
import { TrainingView } from '../fitness/TrainingView'
import { useBodyLogs, useRoutines, useWorkouts } from '../../hooks/useFitness'
import { routineForToday, streak, weightTrend } from '../../lib/fitness'
import { RecipesView } from '../food/RecipesView'
import { AreaTitle, Tile } from '../hub/Tile'
import type { AreaTitleInfo } from './types'

export type BienestarSection = 'menu' | 'recetas' | 'nutricion' | 'entrenos' | 'peso'
const TITLE: Record<BienestarSection, string> = { menu: 'Menú de la semana', recetas: 'Recetas', nutricion: 'Nutrición', entrenos: 'Entrenos', peso: 'Peso y medidas' }

/** Bienestar: lo que coméis (menú y recetas) y, pronto, entrenos, peso y nutrición. */
export function BienestarView({ me, onError, onTitle }: { me: PersonId; onError: (m: string) => void; onTitle: (t: AreaTitleInfo | null) => void }) {
  const [section, open] = useSection<BienestarSection>('bienestar')
  useEffect(() => {
    onTitle(section ? { title: TITLE[section], crumb: 'Bienestar' } : null)
  }, [section, onTitle])

  if (section === 'menu') return <MenuView me={me} onToast={onError} />
  if (section === 'recetas') return <RecipesView me={me} onError={onError} />
  if (section === 'nutricion') return <NutritionView me={me} onError={onError} />
  if (section === 'entrenos') return <TrainingView me={me} onError={onError} />
  if (section === 'peso') return <BodyView me={me} onError={onError} />
  return <BienestarHub me={me} onOpen={open} />
}

function BienestarHub({ me, onOpen }: { me: PersonId; onOpen: (s: BienestarSection) => void }) {
  const days = weekDays(weekStart(new Date()))
  const today = ymd(new Date())
  const { meals } = useMeals(days[0], days[6])
  const recipes = useRecipes()
  const todays = meals.filter((m) => m.date === today && m.eat[me] !== 'fuera').sort((a, b) => Number(a.slot === 'cena') - Number(b.slot === 'cena'))
  const left = days.filter((d) => d >= today && !meals.some((m) => m.date === d && m.slot === 'comida')).length
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const balance = weekBalance(meals.filter((m) => portions(m.eat) > 0).map((m) => dishNutrition(m, m.recipeId ? recipeById.get(m.recipeId) : null).color))
  const colored = balance.green + balance.yellow + balance.red
  const { routines } = useRoutines()
  const { workouts } = useWorkouts()
  const mine = workouts.filter((w) => w.owner === me)
  const toca = routineForToday(routines, workouts, me, today)
  const st = streak(mine, today)
  const { logs } = useBodyLogs(me)
  const trend = weightTrend(logs, today)

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
          <Tile emoji="🥗" title="Nutrición" onClick={() => onOpen('nutricion')} muted={colored === 0}>
            {colored === 0 ? (
              'Colores por plato y cómo vais en la semana'
            ) : (
              <>
                <span className="flex items-center gap-2">
                  {COLOR_ORDER.map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <ColorDot color={c} className="size-2.5" /> <b className="text-ink">{balance[c]}</b>
                    </span>
                  ))}
                </span>
                {balance.verdict && <span className="mt-0.5 block">{balance.text}</span>}
              </>
            )}
          </Tile>
        </div>
      </section>
      <section>
        <AreaTitle>Salud</AreaTitle>
        <div className="grid grid-cols-2 gap-3">
          <Tile emoji="🏋️" title="Entrenos" onClick={() => onOpen('entrenos')} muted={mine.length === 0 && !routines.some((r) => r.owner === me)}>
            {toca ? (
              <span className="block">
                Hoy toca: <b className="text-ink">{toca.name}</b>
              </span>
            ) : mine.length === 0 ? (
              'Rutinas, series y kilos (con tu última marca)'
            ) : (
              <span className="block">
                {st.thisWeek} {st.thisWeek === 1 ? 'entreno' : 'entrenos'} esta semana
              </span>
            )}
            {st.weeks > 1 && <span className="block">🔥 {st.weeks} semanas seguidas</span>}
          </Tile>
          <Tile emoji="⚖️" title="Peso y medidas" onClick={() => onOpen('peso')} muted={!trend.last}>
            {trend.last ? (
              <>
                <b className="text-ink">{trend.last.kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg</b>
                {trend.change !== null && ` · ${trend.change > 0 ? '+' : trend.change < 0 ? '−' : '±'}${Math.abs(trend.change).toLocaleString('es-ES')} en un mes`}
                <span className="block">🔒 Solo tú</span>
              </>
            ) : (
              'Lo tuyo, con su gráfica (solo lo ves tú)'
            )}
          </Tile>
        </div>
      </section>
    </div>
  )
}
