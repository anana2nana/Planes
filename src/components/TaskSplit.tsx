import { useMemo, useState } from 'react'
import { PEOPLE } from '../lib/people'
import { splitMood, taskSplit, type MonthSplit } from '../lib/split'
import type { Plan } from '../lib/types'

const names = { nita: PEOPLE.nita.name, kitos: PEOPLE.kitos.name }

/** Barra partida en dos: lo de cada uno, con un hueco de 2 px entre medias y etiquetas directas. */
function SplitBar({ m, thin }: { m: MonthSplit; thin?: boolean }) {
  const total = m.nita + m.kitos
  const h = thin ? 'h-2' : 'h-3.5'
  if (total === 0) return <div className={`${h} rounded-full bg-stone-100`} />
  const pct = (n: number) => `${(n / total) * 100}%`
  return (
    <div className={`flex ${h} gap-0.5`} role="img" aria-label={`${names.nita} ${m.nita}, ${names.kitos} ${m.kitos}`}>
      {m.nita > 0 && <div className="rounded-full bg-nita" style={{ width: pct(m.nita) }} title={`${names.nita}: ${m.nita}`} />}
      {m.kitos > 0 && <div className="rounded-full bg-kitos" style={{ width: pct(m.kitos) }} title={`${names.kitos}: ${m.kitos}`} />}
    </div>
  )
}

export function TaskSplit({ plans }: { plans: Plan[] }) {
  const [open, setOpen] = useState(false)
  const months = useMemo(() => taskSplit(plans, new Date(), 4), [plans])
  const [cur, ...prev] = months
  if (months.every((m) => m.nita + m.kitos === 0)) return null
  const total = cur.nita + cur.kitos
  const share = (n: number) => (total ? ` · ${Math.round((n / total) * 100)} %` : '')

  return (
    <section className="rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left" aria-expanded={open}>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">Reparto de {cur.label}</h2>
          <span className="text-xs font-semibold text-muted">{splitMood(cur, names)}</span>
        </div>
        <SplitBar m={cur} />
        <div className="mt-1.5 flex justify-between text-xs font-semibold">
          <span>
            <span className="mr-1 inline-block size-2 rounded-full bg-nita align-middle" />
            {names.nita} <b className="tabular">{cur.nita}</b>
            <span className="text-muted">{share(cur.nita)}</span>
          </span>
          <span>
            {names.kitos} <b className="tabular">{cur.kitos}</b>
            <span className="text-muted">{share(cur.kitos)}</span>
            <span className="ml-1 inline-block size-2 rounded-full bg-kitos align-middle" />
          </span>
        </div>
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
          {prev.map((m) => (
            <div key={m.key} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 text-xs">
              <span className="font-semibold capitalize text-muted">{m.label}</span>
              <SplitBar m={m} thin />
              <span className="tabular text-right font-semibold">
                {m.nita} · {m.kitos}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
