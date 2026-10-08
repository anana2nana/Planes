import { useEffect, useState, type ReactNode } from 'react'

/** Convierte "384.000", "384000,50" o "2,5" en número. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(/\s|€|%/g, '')
  if (!t) return null
  // Si hay coma, es el decimal y los puntos son miles; si no, un punto seguido de 3 cifras son miles.
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const numFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' })

/** Campo numérico cómodo en el móvil (teclado decimal), con sufijo (€, %, años…). */
export function NumberField({
  value,
  onChange,
  suffix,
  label,
  placeholder,
  className = '',
}: {
  value: number | null
  onChange: (v: number | null) => void
  suffix?: string
  label: string
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value === null ? '' : numFmt.format(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(value === null ? '' : numFmt.format(value))
  }, [value, focused])
  return (
    <label className={`flex h-12 items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 focus-within:border-both ${className}`}>
      <input
        inputMode="decimal"
        value={text}
        aria-label={label}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseNumber(e.target.value))
        }}
        className="tabular min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-stone-300"
      />
      {suffix && <span className="shrink-0 text-sm font-semibold text-muted">{suffix}</span>}
    </label>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] ${className}`}>{children}</section>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between px-1">
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-muted">{children}</span>
}

/** Interruptor con texto. */
export function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-stone-50 p-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-stone-200 transition peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  )
}

/** Selector segmentado. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-stone-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`truncate rounded-xl px-2 py-2 text-sm font-bold transition ${value === o.value ? 'bg-white shadow-sm' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Paso -/+ para números pequeños (cuotas pagadas…). */
export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Menos" className="grid size-10 place-items-center rounded-full bg-stone-100 text-xl font-bold disabled:opacity-30 active:scale-90">
        −
      </button>
      <span className="tabular w-10 text-center text-xl font-extrabold" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Más" className="grid size-10 place-items-center rounded-full bg-stone-100 text-xl font-bold disabled:opacity-30 active:scale-90">
        +
      </button>
    </div>
  )
}
