import { useEffect, useMemo, useRef, useState } from 'react'
import { loadRecipeHtml } from '../../hooks/useMenu'
import { useLayer } from '../../hooks/useLayer'
import { useShopping } from '../../hooks/useShopping'
import { isPantry, richOf, sourceOf, type Recipe } from '../../lib/menu'
import { clock, scaleQty, shoppingName, type Step } from '../../lib/recipe'
import type { PersonId } from '../../lib/types'
import { addShoppingItem } from '../../services/shopping'
import { ChevronIcon, CloseIcon } from '../Icons'

/** Colores de las fases (mismo orden siempre). */
const PHASE_COLORS = ['#e6a93a', '#b5402e', '#25282e', '#d9848a', '#3c7a5c', '#6e7f55', '#4a3aa7']

const storeKey = (id: string) => `nitakitos.cook.${id}`
function readMarks(id: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(storeKey(id)) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

/** Mantiene la pantalla encendida mientras se cocina. */
function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    const get = () => {
      if (document.visibilityState === 'visible') nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    }
    get()
    document.addEventListener('visibilitychange', get)
    return () => {
      document.removeEventListener('visibilitychange', get)
      lock?.release().catch(() => {})
    }
  }, [])
}

/** Receta a pantalla completa para cocinar: tachar ingredientes, marcar pasos, temporizadores y raciones. */
export function RecipeCook({ recipe, me, onClose, onEdit, onToast }: { recipe: Recipe; me: PersonId; onClose: () => void; onEdit: () => void; onToast: (m: string) => void }) {
  const close = useLayer('cook', onClose)
  useWakeLock()
  const r = richOf(recipe)
  const [servings, setServings] = useState(r.servings ?? 0)
  const factor = r.servings && servings ? servings / r.servings : 1
  const [marks, setMarks] = useState(() => readMarks(recipe.id))
  const [original, setOriginal] = useState<string | null>(null)
  const { items } = useShopping()
  const toggle = (k: string) =>
    setMarks((m) => {
      const n = { ...m, [k]: !m[k] }
      try {
        localStorage.setItem(storeKey(recipe.id), JSON.stringify(n))
      } catch {
        /* sin almacenamiento */
      }
      return n
    })
  const reset = () => {
    setMarks({})
    try {
      localStorage.removeItem(storeKey(recipe.id))
    } catch {
      /* nada */
    }
  }
  const src = sourceOf(r.url)
  let stepNo = 0

  const toShopping = () => {
    const names = [...new Set(r.groups.flatMap((g) => g.items.map((i) => shoppingName(i.name))).filter((n) => n && !isPantry(n)))]
    const added = names.filter((n) => addShoppingItem(n, 'super', me, items)).length
    onToast(added ? `🛒 ${added} ${added === 1 ? 'ingrediente añadido' : 'ingredientes añadidos'} a la compra (sin los de despensa)` : 'Ya estaba todo en la lista')
  }

  return (
    <div className="fixed inset-0 z-[45] overflow-y-auto bg-cream animate-fade-in" role="dialog" aria-label={r.title}>
      <div className="pt-safe sticky top-0 z-10 flex items-center gap-2 bg-cream/90 px-3 pb-2 backdrop-blur-xl">
        <button onClick={close} aria-label="Volver" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm">
          <ChevronIcon className="size-4 rotate-180" />
        </button>
        <p className="min-w-0 flex-1 truncate font-extrabold">{r.title}</p>
        {recipe.hasHtml && (
          <button
            onClick={() =>
              loadRecipeHtml(recipe.id)
                .then((h) => (h ? setOriginal(h) : onToast('No encuentro el original')))
                .catch((e: Error) => onToast(e.message))
            }
            className="rounded-full bg-surface px-3 py-2 text-xs font-bold shadow-sm"
          >
            Original
          </button>
        )}
        <button onClick={onEdit} className="rounded-full bg-ink px-3.5 py-2 text-xs font-bold text-cream">
          Editar
        </button>
      </div>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pb-24">
        {/* Portada */}
        <header className="pt-2">
          <div className="text-6xl" aria-hidden>
            {recipe.emoji}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">{r.title}</h1>
          {r.description && <p className="mt-2 text-muted">{r.description}</p>}
          {r.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  {t}
                </span>
              ))}
            </div>
          )}
          {r.url && (
            <a href={r.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700">
              {src?.emoji} {src?.label ?? 'Enlace'}
            </a>
          )}
          {r.credit && <p className="mt-3 border-l-2 border-stone-200 pl-3 text-xs text-muted">{r.credit}</p>}
        </header>

        {/* Raciones */}
        {r.servings && (
          <div className="flex items-center justify-between rounded-2xl bg-surface p-3 shadow-sm">
            <span className="text-sm font-semibold">
              Para <b className="tabular text-lg">{servings}</b> {servings === 1 ? 'persona' : 'personas'}
              {factor !== 1 && <span className="ml-1 text-xs text-muted">(original: {r.servings})</span>}
            </span>
            <span className="flex gap-1">
              <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Menos raciones" className="grid size-9 place-items-center rounded-full bg-stone-100 text-lg font-bold">
                −
              </button>
              <button onClick={() => setServings((s) => Math.min(20, s + 1))} aria-label="Más raciones" className="grid size-9 place-items-center rounded-full bg-stone-100 text-lg font-bold">
                +
              </button>
            </span>
          </div>
        )}

        {/* Ingredientes */}
        {r.groups.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-2xl font-extrabold">Ingredientes</h2>
              <button onClick={toShopping} className="text-xs font-bold text-both">
                🛒 A la compra
              </button>
            </div>
            <div className="space-y-3">
              {r.groups.map((g, gi) => (
                <div key={gi} className="rounded-2xl bg-surface p-4 shadow-sm" style={{ borderTop: `4px solid ${PHASE_COLORS[gi % PHASE_COLORS.length]}` }}>
                  {g.name && <h3 className="mb-1 font-extrabold">{g.name}</h3>}
                  <ul className="divide-y divide-stone-100">
                    {g.items.map((it, ii) => {
                      const k = `i${gi}.${ii}`
                      return (
                        <li key={k}>
                          <label className="flex cursor-pointer items-baseline gap-3 py-2">
                            <input type="checkbox" checked={!!marks[k]} onChange={() => toggle(k)} className="size-4.5 shrink-0 translate-y-0.5 accent-emerald-600" />
                            <span className={`flex min-w-0 flex-1 gap-3 ${marks[k] ? 'text-muted line-through' : ''}`}>
                              {it.q && <b className="tabular w-20 shrink-0">{scaleQty(it.q, factor)}</b>}
                              <span className="min-w-0">{it.name}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  {g.note && <p className="mt-2 text-xs text-muted">{g.note}</p>}
                </div>
              ))}
              {factor !== 1 && <p className="text-xs text-muted">Cantidades recalculadas para {servings}: revisa las que no se pueden partir (huevos, latas…).</p>}
              {r.notes && <p className="whitespace-pre-wrap text-sm text-muted">{r.notes}</p>}
            </div>
          </section>
        )}

        {/* Antes de empezar */}
        {r.gear.length > 0 && (
          <section className="rounded-2xl bg-surface p-4 shadow-sm">
            <h3 className="mb-2 font-extrabold">Antes de empezar</h3>
            <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm min-[420px]:grid-cols-2">
              {r.gear.map((x) => (
                <li key={x}>· {x}</li>
              ))}
            </ul>
            {r.gearNote && <p className="mt-2 text-xs text-muted">{r.gearNote}</p>}
          </section>
        )}

        {/* Pasos */}
        {r.phases.length > 0 && (
          <section>
            <h2 className="mb-1 text-2xl font-extrabold">Paso a paso</h2>
            <p className="text-xs text-muted">Toca el número de cada paso para marcarlo. La pantalla no se apaga mientras estás aquí.</p>
            {r.phases.map((ph, pi) => (
              <div key={pi} className="mt-6">
                {ph.title && (
                  <h3 className="flex items-center gap-2 text-xl font-extrabold">
                    <i className="inline-block size-3 shrink-0 rounded-full" style={{ background: PHASE_COLORS[pi % PHASE_COLORS.length] }} />
                    {ph.title}
                  </h3>
                )}
                {ph.why && <p className="mt-1 text-sm text-muted">{ph.why}</p>}
                <ol className="mt-3 space-y-5">
                  {ph.steps.map((st, si) => {
                    stepNo++
                    const k = `s${pi}.${si}`
                    return <StepView key={k} n={stepNo} step={st} done={!!marks[k]} onToggle={() => toggle(k)} />
                  })}
                </ol>
              </div>
            ))}
          </section>
        )}

        {/* Consejos */}
        {r.tips.length > 0 && (
          <section>
            <h2 className="mb-3 text-2xl font-extrabold">Claves y qué hacer si falla</h2>
            <div className="space-y-2.5">
              {r.tips.map((t, i) => (
                <div key={i} className={`rounded-2xl bg-surface p-4 shadow-sm border-l-4 ${t.kind === 'warn' ? 'border-rose-400' : 'border-emerald-500'}`}>
                  {t.title && <h3 className="font-extrabold">{t.title}</h3>}
                  <p className="mt-1 whitespace-pre-wrap text-sm">{t.text}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {Object.values(marks).some(Boolean) && (
          <button onClick={reset} className="mx-auto block rounded-full border border-stone-200 px-4 py-2 text-xs font-bold text-muted">
            Borrar marcas
          </button>
        )}
      </main>

      {original !== null && <OriginalView html={original} onClose={() => setOriginal(null)} />}
    </div>
  )
}

function StepView({ n, step, done, onToggle }: { n: number; step: Step; done: boolean; onToggle: () => void }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-3">
      <button
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`Paso ${n}${done ? ': hecho' : ''}`}
        className={`grid size-10 place-items-center rounded-full border-2 font-extrabold transition ${done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-surface'}`}
      >
        {done ? '✓' : n}
      </button>
      <div className={`min-w-0 pt-1 ${done ? 'opacity-50' : ''}`}>
        {step.title && <h4 className="font-extrabold">{step.title}</h4>}
        {step.text && <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{step.text}</p>}
        {step.chips.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.chips.map((c) => (
              <span key={c} className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs font-semibold">
                {c}
              </span>
            ))}
          </div>
        )}
        {step.timer && step.timer.seconds > 0 && <Timer seconds={step.timer.seconds} label={step.timer.label} />}
        {step.cue && (
          <p className="mt-2 rounded-r-xl border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm">
            <b>Señal de que va bien:</b> {step.cue}
          </p>
        )}
        {step.fix && (
          <p className="mt-2 rounded-r-xl border-l-4 border-rose-400 bg-rose-50 px-3 py-2 text-sm">
            <b className="text-rose-700">Si no está bien:</b> {step.fix}
          </p>
        )}
        {step.tech.length > 0 && (
          <details className="mt-2 rounded-xl border border-stone-200 bg-surface">
            <summary className="cursor-pointer px-3 py-2 text-sm font-bold">Técnica al detalle</summary>
            <ul className="list-disc space-y-1 px-3 pb-3 pl-7 text-sm">
              {step.tech.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  )
}

/** Temporizador con hora de fin (sigue bien aunque la pantalla se bloquee un momento). */
function Timer({ seconds, label }: { seconds: number; label: string }) {
  const [end, setEnd] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)
  useEffect(() => {
    if (end === null) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [end])
  const left = end === null ? seconds : Math.max(0, Math.ceil((end - now) / 1000))
  const finished = end !== null && left === 0
  useEffect(() => {
    if (!finished || fired.current) return
    fired.current = true
    navigator.vibrate?.([300, 150, 300, 150, 300])
    beep()
  }, [finished])
  const click = () => {
    fired.current = false
    if (end === null) {
      setNow(Date.now())
      setEnd(Date.now() + seconds * 1000)
    } else setEnd(null)
  }
  const text = useMemo(() => (finished ? `✓ ${label || 'Tiempo'}: ¡listo!` : end === null ? `⏱️ ${label || clock(seconds)}` : `${clock(left)} · toca para parar`), [finished, end, label, left, seconds])
  return (
    <button
      onClick={click}
      className={`tabular mt-2 min-h-10 rounded-full px-4 py-2 text-sm font-bold ${finished ? 'bg-emerald-600 text-white' : end !== null ? 'bg-amber-400 text-ink' : 'bg-ink text-cream'}`}
    >
      {text}
    </button>
  )
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = 880
      g.gain.setValueAtTime(0.25, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.3)
    })
  } catch {
    /* sin sonido */
  }
}

/** El HTML importado, tal cual, aislado del resto de la app. */
function OriginalView({ html, onClose }: { html: string; onClose: () => void }) {
  const close = useLayer('cookOriginal', onClose)
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cream">
      <div className="pt-safe flex items-center gap-2 px-3 pb-2">
        <button onClick={close} aria-label="Cerrar original" className="grid size-10 place-items-center rounded-full bg-surface shadow-sm">
          <CloseIcon className="size-4" />
        </button>
        <p className="text-sm font-bold text-muted">Tu receta original</p>
      </div>
      <iframe title="Receta original" srcDoc={html} sandbox="allow-scripts allow-popups" className="min-h-0 w-full flex-1 border-0 bg-white" />
    </div>
  )
}
