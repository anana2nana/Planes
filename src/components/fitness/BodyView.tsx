import { useState } from 'react'
import { deleteBodyLog, saveBodyLog, useBodyLogs } from '../../hooks/useFitness'
import { useSheetState } from '../../hooks/useSheetState'
import { MEASURES, weightTrend, ymd, type BodyLog } from '../../lib/fitness'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { TrashIcon } from '../Icons'
import { LineChart } from '../home/Charts'
import { NumberField } from '../home/ui'

const shortFmt = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
})
const longFmt = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const n1 = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${n1(Math.abs(v))}`
const card = 'rounded-3xl bg-surface p-4 shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]'

type Draft = Omit<BodyLog, 'id'> & { id?: string }
const empty = (owner: PersonId): Draft => ({
  owner,
  date: ymd(new Date()),
  kg: null,
  waist: null,
  chest: null,
  hip: null,
  arm: null,
  thigh: null,
})

/** Peso y medidas: solo los tuyos (ni tu pareja los ve). */
export function BodyView({ me, onError }: { me: PersonId; onError: (m: string) => void }) {
  const { logs, loading } = useBodyLogs(me)
  const [sheet, openSheet, closeSheet] = useSheetState<Draft>()
  const today = ymd(new Date())
  const trend = weightTrend(logs, today)
  const weights = logs.filter((l) => l.kg !== null)
  const color = me === 'nita' ? 'var(--color-nita)' : 'var(--color-kitos)'

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs font-semibold text-muted">🔒 Solo lo ves tú: ni {me === 'nita' ? 'Kitos' : 'Nita'} puede verlo.</p>

      <section className={card}>
        {loading ? (
          <div className="h-24 animate-pulse rounded-2xl bg-stone-100" />
        ) : trend.last ? (
          <>
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="tabular text-4xl font-extrabold tracking-tight">
                  {n1(trend.last.kg)} <span className="text-lg font-bold text-muted">kg</span>
                </p>
                <p className="text-xs text-muted">el {longFmt.format(parse(trend.last.date))}</p>
              </div>
              {trend.change !== null && trend.since && (
                <p className="text-right text-sm font-bold">
                  {signed(trend.change)} kg
                  <span className="block text-xs font-medium text-muted">desde el {shortFmt.format(parse(trend.since))}</span>
                </p>
              )}
            </div>
            {weights.length >= 2 && (
              <div className="mt-3">
                <LineChart
                  title="Peso"
                  points={weights.map((w) => ({ x: w.date, y: w.kg! }))}
                  color={color}
                  formatY={(v) => `${n1(v)} kg`}
                  formatX={(x) => shortFmt.format(parse(x))}
                  zeroBased={false}
                  height={140}
                />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Apunta tu peso de vez en cuando (mejor siempre a la misma hora, por ejemplo al levantarte) y verás cómo evoluciona.</p>
        )}
        <button onClick={() => openSheet(empty(me))} className="mt-3 h-12 w-full rounded-2xl bg-ink font-bold text-cream active:scale-[0.99]">
          + Apuntar peso o medidas
        </button>
      </section>

      <Measures logs={logs} />

      {logs.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Registro</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {[...logs]
              .reverse()
              .slice(0, 15)
              .map((l) => (
                <li key={l.id}>
                  <button onClick={() => openSheet(l)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left active:bg-stone-50">
                    <span className="w-16 shrink-0 text-xs font-bold text-muted">{shortFmt.format(parse(l.date))}</span>
                    <span className="tabular flex-1 text-sm font-bold">{l.kg !== null ? `${n1(l.kg)} kg` : '—'}</span>
                    <span className="truncate text-xs text-muted">
                      {MEASURES.filter((m) => l[m.key] !== null)
                        .map((m) => `${m.label.toLowerCase()} ${n1(l[m.key]!)}`)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {sheet && <LogSheet draft={sheet} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

/** Última medida de cada sitio y cuánto ha cambiado desde la primera. */
function Measures({ logs }: { logs: BodyLog[] }) {
  const rows = MEASURES.map((m) => {
    const vals = logs.filter((l) => l[m.key] !== null)
    if (!vals.length) return null
    const first = vals[0][m.key]!
    const last = vals[vals.length - 1][m.key]!
    return {
      ...m,
      last,
      change: vals.length > 1 ? Math.round((last - first) * 10) / 10 : null,
      since: vals[0].date,
    }
  }).filter(Boolean) as {
    key: string
    label: string
    last: number
    change: number | null
    since: string
  }[]
  if (!rows.length) return null
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">Medidas</h2>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map((r) => (
          <div key={r.key} className={`${card} p-3.5`}>
            <p className="text-xs font-semibold text-muted">{r.label}</p>
            <p className="tabular text-xl font-extrabold">
              {n1(r.last)} <span className="text-sm font-bold text-muted">cm</span>
            </p>
            {r.change !== null && (
              <p className="text-[11px] text-muted">
                {signed(r.change)} cm desde el {shortFmt.format(parse(r.since))}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function LogSheet({ draft, onClose, onError }: { draft: Draft; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const [more, setMore] = useState(MEASURES.some((m) => draft[m.key] !== null))
  const valid = d.kg !== null || MEASURES.some((m) => d[m.key] !== null)
  const save = () => {
    if (!valid) return
    saveBodyLog(d, onError)
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={draft.id ? 'Editar registro' : '⚖️ Peso y medidas'}
      footer={
        <button onClick={save} disabled={!valid} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <NumberField value={d.kg} onChange={(kg) => setD({ ...d, kg })} suffix="kg" label="Peso" placeholder="65,0" />
          <input
            type="date"
            value={d.date}
            max={ymd(new Date())}
            onChange={(e) => e.target.value && setD({ ...d, date: e.target.value })}
            aria-label="Fecha"
            className="h-12 rounded-2xl border border-stone-200 bg-surface px-3 font-semibold"
          />
        </div>
        {more ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">Medidas en cm (las que quieras)</p>
            <div className="grid grid-cols-2 gap-2">
              {MEASURES.map((m) => (
                <NumberField key={m.key} value={d[m.key]} onChange={(v) => setD({ ...d, [m.key]: v })} suffix={`cm · ${m.label.toLowerCase()}`} label={m.label} />
              ))}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setMore(true)} className="text-sm font-bold text-both">
            + Medidas (cintura, cadera, brazo…)
          </button>
        )}
        {draft.id && (
          <button
            type="button"
            onClick={() => {
              deleteBodyLog(draft.id!).catch((e: Error) => onError(e.message))
              onClose()
            }}
            className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600"
          >
            <TrashIcon className="size-4" /> Borrar registro
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
