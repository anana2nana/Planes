import { COLORS, COLOR_ORDER, type DishColor, type Estimate, type NutritionOverride, type WeekBalance } from '../../lib/nutrition'

export const DOT: Record<DishColor, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-rose-500' }
const SOFT: Record<DishColor, string> = { green: 'bg-emerald-50 text-emerald-700', yellow: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700' }

export function ColorDot({ color, className = 'size-3' }: { color: DishColor | null; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${color ? DOT[color] : 'border-2 border-dashed border-stone-300'} ${className}`} aria-label={color ? COLORS[color].label : 'Sin color'} role="img" />
}

export function ColorBadge({ color, kcal }: { color: DishColor | null; kcal?: number | null }) {
  if (!color && !kcal) return null
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${color ? SOFT[color] : 'bg-stone-100'}`}>
      {color && <ColorDot color={color} className="size-2.5" />}
      {color && COLORS[color].label}
      {kcal ? `${color ? ' · ' : ''}~${kcal} kcal` : ''}
    </span>
  )
}

/** Elegir el color a mano. `auto` es el calculado (se marca como «Auto» y se vuelve a él con null). */
export function ColorChoice({ value, auto, onChange, label = 'Cómo es el plato' }: { value: DishColor | null; auto?: DishColor | null; onChange: (c: DishColor | null) => void; label?: string }) {
  const options: (DishColor | null)[] = auto !== undefined ? [null, ...COLOR_ORDER] : COLOR_ORDER
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((c) => {
        const on = value === c
        return (
          <button
            key={c ?? 'auto'}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(auto === undefined && on ? null : c)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${on ? 'bg-ink text-cream' : 'bg-stone-100'}`}
          >
            {c ? (
              <>
                <ColorDot color={c} className="size-2.5" /> {COLORS[c].label}
              </>
            ) : (
              <>
                ✨ Auto{auto ? <ColorDot color={auto} className="size-2.5" /> : ' (sin datos)'}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** En el editor de recetas: lo calculado y las correcciones. */
export function NutritionPanel({ estimate, value, onChange }: { estimate: Estimate; value: NutritionOverride; onChange: (v: NutritionOverride) => void }) {
  const known = estimate.total > 0
  return (
    <div className="space-y-3 rounded-2xl bg-stone-50 p-3">
      {known ? (
        <div>
          <p className="text-sm">
            <b>~{estimate.kcal} kcal</b> por ración <span className="text-muted">· proteína {estimate.protein} g · hidratos {estimate.carbs} g · grasa {estimate.fat} g</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Calculado con {estimate.matched} de {estimate.total} ingredientes{!estimate.confident && ' (poco fiable: faltan cantidades o ingredientes)'}.
            {estimate.unknown.length > 0 && ` No conozco: ${estimate.unknown.slice(0, 4).join(', ')}${estimate.unknown.length > 4 ? '…' : ''}.`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">Apunta los ingredientes con su cantidad y lo calculo solo. Si no, elige el color a mano.</p>
      )}
      <ColorChoice value={value.color} auto={estimate.color} onChange={(color) => onChange({ ...value, color })} />
      <label className="flex items-center gap-2 text-sm font-semibold">
        Calorías por ración
        <input
          value={value.kcal ?? ''}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value))
            onChange({ ...value, kcal: e.target.value && n > 0 ? Math.min(5000, n) : null })
          }}
          inputMode="numeric"
          placeholder={known ? String(estimate.kcal) : '—'}
          aria-label="Calorías por ración"
          className="h-9 w-20 rounded-lg border border-stone-200 bg-surface px-2 text-center outline-none focus:border-both"
        />
        <span className="text-xs font-medium text-muted">(solo si las sabes)</span>
      </label>
    </div>
  )
}

/** Barra de la semana: cuántos platos de cada color. */
export function WeekBar({ balance }: { balance: WeekBalance }) {
  const known = balance.green + balance.yellow + balance.red
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`${balance.green} ligeros, ${balance.yellow} normales, ${balance.red} contundentes`}>
        {known > 0 &&
          COLOR_ORDER.map((c) => {
            const n = balance[c]
            return n ? <span key={c} className={DOT[c]} style={{ width: `${(n / known) * 100}%` }} /> : null
          })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted">
        {COLOR_ORDER.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <ColorDot color={c} className="size-2.5" /> {balance[c]} {COLORS[c].label.toLowerCase()}
            {balance[c] === 1 ? '' : c === 'yellow' ? 'es' : 's'}
          </span>
        ))}
        {balance.unknown > 0 && <span>· {balance.unknown} sin color</span>}
      </div>
    </div>
  )
}
