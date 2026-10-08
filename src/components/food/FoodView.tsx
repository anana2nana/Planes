import { useState } from 'react'
import type { PersonId } from '../../lib/types'
import { ShoppingView } from '../ShoppingView'
import { MenuView } from './MenuView'
import { RecipesView } from './RecipesView'

type Mode = 'compra' | 'menu' | 'recetas'
const KEY = 'nitakitos.food.mode'
const read = (): Mode => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'menu' || v === 'recetas' ? v : 'compra'
  } catch {
    return 'compra'
  }
}

/** Para abrir la pestaña Comida directamente en un apartado (p. ej. desde "Hoy para ti"). */
export function rememberFoodMode(m: Mode) {
  try {
    localStorage.setItem(KEY, m)
  } catch {
    /* sin almacenamiento */
  }
}

/** Pestaña Comida: lista de la compra, menú de la semana y recetario. */
export function FoodView({ me, onToast }: { me: PersonId; onToast: (m: string) => void }) {
  const [mode, setModeState] = useState<Mode>(read)
  const setMode = (m: Mode) => {
    setModeState(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* sin almacenamiento */
    }
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 rounded-2xl bg-stone-200/60 p-1 text-[13px] font-bold" role="tablist" aria-label="Compra, menú o recetas">
        {(
          [
            { v: 'compra', label: '🛒 Compra' },
            { v: 'menu', label: '🍝 Menú' },
            { v: 'recetas', label: '📖 Recetas' },
          ] as const
        ).map((o) => (
          <button key={o.v} role="tab" aria-selected={mode === o.v} onClick={() => setMode(o.v)} className={`rounded-xl py-2 transition ${mode === o.v ? 'bg-surface shadow-sm' : 'text-muted'}`}>
            {o.label}
          </button>
        ))}
      </div>
      {mode === 'compra' && <ShoppingView me={me} onToast={onToast} />}
      {mode === 'menu' && <MenuView me={me} onToast={onToast} />}
      {mode === 'recetas' && <RecipesView me={me} onError={onToast} />}
    </div>
  )
}
