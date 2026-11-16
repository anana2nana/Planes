// "No sabemos qué hacer": filtros rápidos y un sorteo con más papeletas para lo que tiene más ❤️.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BBS_KINDS, BBS_KIND_IDS, NEAR_KM, dateText, heartsText, matches, pickWeighted, urgencyText, type BbsFilters, type BbsItem, type BbsKind, type BbsPerson } from '../lib/bbs.ts'
import { useLayer } from '../hooks/useLayer'
import { DirectionsLink } from '../components/DirectionsLink'
import { CloseIcon, NavigateIcon } from '../components/Icons'
import { Hearts } from './Hearts'

type Here = { lat: number; lng: number }
const PRICE = ['', '€', '€€', '€€€']

export function BbsPicker({ items, me, today, onClose, onOpen }: { items: BbsItem[]; me: BbsPerson; today: string; onClose: () => void; onOpen: (id: string) => void }) {
  const close = useLayer('bbsPick', onClose)
  const [f, setF] = useState<BbsFilters>({})
  const [here, setHere] = useState<Here | null>(null)
  const [geo, setGeo] = useState<'idle' | 'asking' | 'denied'>('idle')
  const [result, setResult] = useState<BbsItem | null>(null)
  const [spinning, setSpinning] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const pool = useMemo(() => items.filter((i) => matches(i, f, today, here)), [items, f, today, here])
  const withPlace = items.filter((i) => i.status === 'pending' && i.place?.lat != null).length

  const toggle = (key: 'today' | 'cheap' | 'rain') => {
    setF((x) => ({ ...x, [key]: !x[key] }))
    setResult(null)
  }
  const toggleKind = (k: BbsKind) => {
    setF((x) => {
      const kinds = x.kinds?.includes(k) ? x.kinds.filter((v) => v !== k) : [...(x.kinds ?? []), k]
      return { ...x, kinds }
    })
    setResult(null)
  }
  const toggleNear = () => {
    setResult(null)
    if (f.near) return setF((x) => ({ ...x, near: false }))
    if (here) return setF((x) => ({ ...x, near: true }))
    setGeo('asking')
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude })
        setGeo('idle')
        setF((x) => ({ ...x, near: true }))
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    )
  }

  /** Unas vueltas de "tragaperras" con los títulos y luego el elegido. */
  const spin = () => {
    if (pool.length === 0 || spinning) return
    const chosen = pickWeighted(pool, today, Math.random(), result?.id)
    if (!chosen) return
    setResult(null)
    if (pool.length === 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) return setResult(chosen)
    // Va frenando poco a poco, como una ruleta.
    const tick = (n: number) => {
      if (n >= 14) {
        timer.current = null
        setSpinning(null)
        setResult(chosen)
        navigator.vibrate?.([20, 40, 60])
        return
      }
      setSpinning(pool[Math.floor(Math.random() * pool.length)].title)
      navigator.vibrate?.(4)
      timer.current = setTimeout(() => tick(n + 1), 50 + n * n * 1.5)
    }
    tick(0)
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-cream" role="dialog" aria-modal="true" aria-label="No sabemos qué hacer">
      <div className="pt-safe mx-auto w-full max-w-lg flex-1 px-4 pb-10">
        <header className="flex items-center justify-between py-2">
          <h2 className="text-xl font-extrabold">¿Qué hacemos? 🎲</h2>
          <button onClick={close} aria-label="Cerrar" className="grid size-11 place-items-center rounded-full bg-surface shadow-sm active:scale-95">
            <CloseIcon className="size-5" />
          </button>
        </header>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Filter on={!!f.today} onClick={() => toggle('today')} emoji="📅" label="Hoy" />
          <Filter on={!!f.near} onClick={toggleNear} emoji="📍" label={geo === 'asking' ? 'Buscándote…' : `Cerca (${NEAR_KM} km)`} />
          <Filter on={!!f.cheap} onClick={() => toggle('cheap')} emoji="💸" label="Barato" />
          <Filter on={!!f.rain} onClick={() => toggle('rain')} emoji="☔" label="Si llueve" />
        </div>
        {geo === 'denied' && <p className="mt-2 text-xs font-semibold text-rose-600">No sabemos dónde estás: da permiso de ubicación a la app para usar «Cerca».</p>}
        {f.near && withPlace === 0 && <p className="mt-2 text-xs text-muted">Para «Cerca», poned el sitio («Dónde») en la ficha de los planes.</p>}

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {BBS_KIND_IDS.map((k) => (
            <button
              key={k}
              onClick={() => toggleKind(k)}
              aria-pressed={!!f.kinds?.includes(k)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition ${f.kinds?.includes(k) ? 'bg-bbs text-white' : 'bg-surface text-ink shadow-sm'}`}
            >
              {BBS_KINDS[k].emoji} {BBS_KINDS[k].label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center">
          <button
            onClick={spin}
            disabled={pool.length === 0 || !!spinning}
            className="grid size-44 place-items-center rounded-full bg-gradient-to-br from-[#0f766e] via-[#0d9488] to-[#2dd4bf] text-white shadow-2xl shadow-teal-700/40 transition active:scale-95 disabled:opacity-40"
          >
            <span className="text-center">
              <span className={`block text-5xl ${spinning ? 'animate-spin' : ''}`} aria-hidden>
                🎲
              </span>
              <span className="mt-1 block text-lg font-extrabold">{result ? 'Otra' : '¡Elige!'}</span>
            </span>
          </button>
          <p className="mt-3 text-sm font-semibold text-muted" aria-live="polite">
            {pool.length === 0 ? 'Nada encaja con esos filtros' : `${pool.length} ${pool.length === 1 ? 'plan encaja' : 'planes encajan'}`}
          </p>
        </div>

        <div className="mt-6 min-h-40" aria-live="polite">
          {spinning && <p className="truncate rounded-3xl bg-surface p-6 text-center text-lg font-extrabold text-muted">{spinning}</p>}
          {result && <Result item={result} me={me} today={today} onOpen={onOpen} />}
        </div>
      </div>
    </div>
  )
}

function Filter({ on, onClick, emoji, label }: { on: boolean; onClick: () => void; emoji: string; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`flex h-14 items-center gap-2 rounded-2xl px-4 text-left font-bold transition active:scale-[0.98] ${on ? 'bg-bbs text-white shadow-md shadow-teal-700/20' : 'bg-surface text-ink shadow-sm'}`}>
      <span className="text-xl" aria-hidden>
        {emoji}
      </span>
      {label}
    </button>
  )
}

function Result({ item, me, today, onOpen }: { item: BbsItem; me: BbsPerson; today: string; onOpen: (id: string) => void }) {
  const k = BBS_KINDS[item.kind]
  const facts: ReactNode[] = [item.place?.name, PRICE[item.price], dateText(item), urgencyText(item, today)].filter(Boolean)
  return (
    <div className="animate-pop rounded-[28px] bg-surface p-5 text-center shadow-xl shadow-teal-900/10">
      <p className="text-5xl" aria-hidden>
        {k.emoji}
      </p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted">{k.label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-tight">{item.title}</p>
      {facts.length > 0 && <p className="mt-1 text-sm text-muted">{facts.join(' · ')}</p>}
      <div className="mt-3 flex flex-col items-center gap-1">
        <Hearts item={item} me={me} />
        {heartsText(item, me) === 'Apetece a los tres' && <p className="text-sm font-bold text-rose-600">¡Os apetece a los tres! 🎉</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => onOpen(item.id)} className="h-12 flex-1 rounded-2xl bg-bbs font-extrabold text-white active:scale-[0.99]">
          ¡Vamos! Ver ficha
        </button>
        {item.place && (
          <DirectionsLink place={item.place} className="flex h-12 items-center gap-1.5 rounded-2xl bg-sky-50 px-4 font-bold text-sky-700">
            <NavigateIcon className="size-4" /> Ir
          </DirectionsLink>
        )}
      </div>
      {item.link && (
        <a href={item.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-bbs-ink">
          Ver el enlace ↗
        </a>
      )}
    </div>
  )
}
