import { useEffect, useState } from 'react'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const select = 'h-10 rounded-xl border border-stone-200 bg-surface px-2 text-sm font-semibold outline-none focus:border-both'
const parse = (v: string | null) => (v ? v.split('-').map(Number) : [0, 0])

/** Día y mes (sin año) como "MM-DD". Solo se guarda cuando están elegidos los dos. */
export function BirthdayInput({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const [[m, d], setMD] = useState(() => parse(value))
  useEffect(() => setMD(parse(value)), [value])
  const set = (month: number, day: number) => {
    setMD([month, day])
    if (!month || !day) return
    const max = new Date(2024, month, 0).getDate() // 2024: bisiesto, admite el 29-F
    onChange(`${String(month).padStart(2, '0')}-${String(Math.min(day, max)).padStart(2, '0')}`)
  }
  return (
    <span className="flex shrink-0 gap-1.5" role="group" aria-label={label}>
      <select value={d || ''} onChange={(e) => set(m, Number(e.target.value))} aria-label={`${label}: día`} className={select}>
        <option value="">Día</option>
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <select value={m || ''} onChange={(e) => set(Number(e.target.value), d)} aria-label={`${label}: mes`} className={select}>
        <option value="">Mes</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
    </span>
  )
}

export const formatMonthDay = (v: string) => {
  const [m, d] = v.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]}`
}
