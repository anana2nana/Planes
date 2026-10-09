import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useHome } from '../../hooks/useHome'
import { useSheetState } from '../../hooks/useSheetState'
import { CATEGORIES, eur, forecast, formatMonth, handover, itemTotals, monthKey, monthsBetween, nextPayment, totalPrice, type CategoryId, type HomeItem } from '../../lib/home'
import { simulate } from '../../lib/mortgage'
import type { PersonId } from '../../lib/types'
import { saveHomeConfig } from '../../services/home'
import { BottomSheet } from '../BottomSheet'
import { ChevronIcon } from '../Icons'
import { ProgressBar } from './Charts'
import { HomeSetup } from './HomeSetup'
import { ItemForm } from './ItemForm'
import { MortgageView } from './MortgageView'
import { PaymentsView } from './PaymentsView'
import { FurnitureView } from './FurnitureView'
import { SavingsView } from './SavingsView'
import { Label, NumberField, Segmented } from './ui'

type Section = 'pagos' | 'hipoteca' | 'llegamos' | 'muebles'

const SECTION_TITLE: Record<Section, string> = { pagos: 'Plan de pagos', hipoteca: 'Hipoteca', llegamos: '¿Llegamos?', muebles: 'Muebles' }

const PER_PERSON_KEY = 'nitakitos.home.perPerson'
const readPerPerson = () => {
  try {
    return localStorage.getItem(PER_PERSON_KEY) === '1'
  } catch {
    return false
  }
}

export function HomeView({ me, onError, onTitle }: { me: PersonId; onError: (m: string) => void; onTitle: (t: string | null) => void }) {
  const { loading, config, items, funds, euribor } = useHome()
  const [section, setSection] = useState<Section | null>(() => (history.state?.casa as Section) ?? null)
  const [perPerson, setPerPerson] = useState(readPerPerson)
  const [sheet, openSheet, closeSheet] = useSheetState<{ type: 'item'; item: HomeItem | null; category?: CategoryId } | { type: 'config' } | { type: 'budgets' }>()

  // Cada espacio ocupa una entrada del historial: el "atrás" de Android vuelve a la portada.
  const open = useCallback((s: Section) => {
    history.pushState({ ...(history.state ?? {}), casa: s }, '')
    setSection(s)
    window.scrollTo({ top: 0 })
  }, [])
  useEffect(() => {
    const onPop = () => setSection((history.state?.casa as Section) ?? null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    onTitle(section ? SECTION_TITLE[section] : null)
  }, [section, onTitle])

  const togglePerPerson = (v: boolean) => {
    setPerPerson(v)
    try {
      localStorage.setItem(PER_PERSON_KEY, v ? '1' : '0')
    } catch {
      /* sin almacenamiento: solo dura esta sesión */
    }
  }
  const money = useCallback((v: number) => eur(perPerson ? v / 2 : v), [perPerson])

  if (loading) return <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
  if (!config) return <HomeSetup onError={onError} />

  const now = new Date()
  const spending = items.filter((i) => !i.income)
  const paid = spending.reduce((s, i) => s + itemTotals(i, config, now).paid, 0)
  const total = spending.reduce((s, i) => s + itemTotals(i, config, now).total, 0)
  const next = nextPayment(items, config, now)
  const h = handover(items, config, now)
  const months = monthsBetween(monthKey(now), config.handover)
  const euriborValue = config.mortgage.manualEuribor ?? euribor?.value ?? 0
  const mortgage = simulate(Math.min(h.remaining, config.basePrice * config.mortgage.pct), config.mortgage, euriborValue)
  const f = forecast(items, funds, config, now)
  // Muebles, electrodomésticos y reformas: gastado frente a presupuesto.
  const FURNITURE: CategoryId[] = ['muebles', 'electro', 'reforma']
  const furnitureSpent = items.filter((i) => FURNITURE.includes(i.category) && !i.income).reduce((s, i) => s + itemTotals(i, config, now).total, 0)
  const furnitureBudget = FURNITURE.reduce((s, c) => s + (config.budgets?.[c] ?? 0), 0)

  const toggle = (
    <Segmented
      label="Ver importes"
      value={perPerson ? 'one' : 'both'}
      onChange={(v) => togglePerPerson(v === 'one')}
      options={[
        { value: 'both', label: 'Total' },
        { value: 'one', label: 'Cada uno' },
      ]}
    />
  )

  const sheets = (
    <>
      {sheet?.type === 'item' && (
        <ItemForm item={sheet.item} defaultCategory={sheet.category} config={config} me={me} onClose={closeSheet} onError={onError} />
      )}
      {sheet?.type === 'config' && <ConfigSheet config={config} onClose={closeSheet} onError={onError} />}
      {sheet?.type === 'budgets' && <BudgetsSheet config={config} onClose={closeSheet} onError={onError} />}
    </>
  )

  if (section) {
    return (
      <div className="space-y-4">
        {section !== 'hipoteca' && toggle}
        {section === 'pagos' && (
          <PaymentsView
            config={config}
            items={items}
            money={money}
            onEditItem={(item, category) => openSheet({ type: 'item', item, category })}
            onEditConfig={() => openSheet({ type: 'config' })}
            onEditBudgets={() => openSheet({ type: 'budgets' })}
            onOpenMortgage={() => open('hipoteca')}
          />
        )}
        {section === 'muebles' && (
          <FurnitureView config={config} items={items} money={money} onEditItem={(item, category) => openSheet({ type: 'item', item, category })} onEditBudgets={() => openSheet({ type: 'budgets' })} />
        )}
        {section === 'hipoteca' && <MortgageView config={config} items={items} euribor={euribor} money={eur} onError={onError} />}
        {section === 'llegamos' && <SavingsView config={config} items={items} funds={funds} me={me} money={money} onError={onError} />}
        {sheets}
      </div>
    )
  }

  // ─── Portada ───
  return (
    <div className="space-y-4">
      <button onClick={() => open('pagos')} className="block w-full text-left">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-5 text-white shadow-lg shadow-orange-300/40">
          <div className="pointer-events-none absolute -right-6 -top-6 text-[110px] leading-none opacity-20" aria-hidden>
            🏡
          </div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-90">{config.name}</p>
          <p className="mt-1 text-sm font-semibold opacity-95">
            Entrega en {formatMonth(config.handover)}
            {months > 0 && ` · faltan ${months} meses`}
          </p>
          <p className="tabular mt-3 text-3xl font-extrabold tracking-tight">{money(paid)}</p>
          <p className="text-sm opacity-90">pagado de {money(total)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/30">
            <div className="h-full rounded-full bg-surface" style={{ width: `${total ? Math.min(100, (paid / total) * 100) : 0}%` }} />
          </div>
          {next && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
              📆 Próximo: {money(next.amount)} el {next.date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </button>

      {toggle}

      <div className="grid grid-cols-2 gap-3">
        <Tile emoji="📋" title="Plan de pagos" onClick={() => open('pagos')}>
          <b className="tabular text-ink">{money(total - paid)}</b> por pagar
          <span className="mt-2 block">
            <ProgressBar value={paid} max={total} color="#2a78d6" label="Pagado" />
          </span>
        </Tile>
        <Tile emoji="🏦" title="Hipoteca" onClick={() => open('hipoteca')}>
          <b className="tabular text-ink">{money(mortgage.payment)}</b>/mes
          <span className="block">{config.mortgage.type === 'fixed' ? `fija al ${config.mortgage.fixedRate.toLocaleString('es-ES')} %` : euribor ? `Euríbor ${euribor.value.toLocaleString('es-ES')} %` : 'estimada'}</span>
        </Tile>
        <Tile emoji="🐷" title="¿Llegamos?" onClick={() => open('llegamos')}>
          {funds.length === 0 ? (
            'Pon vuestros ahorros para saberlo'
          ) : (
            <>
              {f.status === 'green' ? '🟢 Sí' : f.status === 'yellow' ? '🟡 Justos' : '🔴 Faltaría'}{' '}
              <b className="tabular text-ink">{money(Math.abs(f.balance))}</b>
              <span className="block">{f.balance >= 0 ? 'de margen en la entrega' : 'en la entrega'}</span>
            </>
          )}
        </Tile>
        <Tile emoji="🛋️" title="Muebles" muted={furnitureBudget === 0 && furnitureSpent === 0} onClick={() => open('muebles')}>
          {furnitureBudget > 0 ? (
            <>
              <b className="tabular text-ink">{money(furnitureSpent)}</b> de {money(furnitureBudget)}
              <span className="mt-2 block">
                <ProgressBar value={furnitureSpent} max={furnitureBudget} color={furnitureSpent > furnitureBudget ? '#e34948' : '#eda100'} label="Muebles: gastado del presupuesto" />
              </span>
            </>
          ) : furnitureSpent > 0 ? (
            <>
              <b className="tabular text-ink">{money(furnitureSpent)}</b> gastado. Ponedle presupuesto en el plan de pagos.
            </>
          ) : (
            'Cuando acabe la obra. Ya podéis apuntar gastos, ventas de Wallapop y presupuestos.'
          )}
        </Tile>
      </div>

      <p className="px-2 text-center text-[11px] text-muted">
        Precio con IVA {money(totalPrice(config))} · todo se comparte en tiempo real entre los dos
      </p>
      {sheets}
    </div>
  )
}

function Tile({ emoji, title, children, onClick, muted }: { emoji: string; title: string; children: ReactNode; onClick: () => void; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-36 flex-col rounded-3xl p-4 text-left shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)] transition active:scale-[0.98] ${muted ? 'bg-surface/60' : 'bg-surface'}`}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="mt-2 flex items-center gap-1 font-extrabold">
        {title} <ChevronIcon className="size-3.5 text-stone-400" />
      </span>
      <span className="mt-1 text-xs text-muted">{children}</span>
    </button>
  )
}

/** Cambiar precio, IVA o fecha de entrega (si sube el precio, todo se recalcula). */
function ConfigSheet({ config, onClose, onError }: { config: NonNullable<ReturnType<typeof useHome>['config']>; onClose: () => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState<number | null>(config.basePrice)
  const [vat, setVat] = useState<number | null>(Math.round(config.vatRate * 1000) / 10)
  const [handoverMonth, setHandoverMonth] = useState(config.handover)
  const canSave = !!price && price > 0 && vat !== null
  const save = () => {
    if (!canSave) return
    saveHomeConfig({ basePrice: price!, vatRate: vat! / 100, handover: handoverMonth }).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="El piso"
      footer={
        <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          Guardar
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Precio sin IVA</Label>
          <NumberField value={price} onChange={setPrice} suffix="€" label="Precio sin IVA" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>IVA</Label>
            <NumberField value={vat} onChange={setVat} suffix="%" label="IVA" />
          </div>
          <div>
            <Label>Entrega aprox.</Label>
            <input
              type="month"
              value={handoverMonth}
              onChange={(e) => e.target.value && setHandoverMonth(e.target.value)}
              aria-label="Mes de entrega"
              className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
            />
          </div>
        </div>
        <p className="text-xs text-muted">Si sube el precio, los pagos en % y lo que queda para la entrega se recalculan solos.</p>
      </div>
    </BottomSheet>
  )
}

/** Presupuesto por categoría (lo que pensáis gastar en muebles, electrodomésticos…). */
function BudgetsSheet({ config, onClose, onError }: { config: NonNullable<ReturnType<typeof useHome>['config']>; onClose: () => void; onError: (m: string) => void }) {
  const EDITABLE: CategoryId[] = ['muebles', 'electro', 'reforma', 'compra', 'impuestos', 'otros']
  const [values, setValues] = useState<Partial<Record<CategoryId, number | null>>>(() => ({ ...config.budgets }))
  const save = () => {
    const budgets: Partial<Record<CategoryId, number>> = {}
    EDITABLE.forEach((c) => {
      const v = values[c]
      if (v && v > 0) budgets[c] = v
    })
    // Se guarda entero (sin fusionar) para que borrar un presupuesto lo quite de verdad.
    saveHomeConfig({ budgets }).catch((e: Error) => onError(e.message))
    onClose()
  }
  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Presupuestos"
      footer={
        <button onClick={save} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream">
          Guardar
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">Lo que pensáis gastar en cada cosa. Deja vacío lo que no quieras controlar.</p>
        {EDITABLE.map((c) => (
          <div key={c} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm font-semibold">
              {CATEGORIES[c].emoji} {CATEGORIES[c].label}
            </span>
            <NumberField value={values[c] ?? null} onChange={(v) => setValues((x) => ({ ...x, [c]: v }))} suffix="€" label={`Presupuesto de ${CATEGORIES[c].label}`} className="flex-1" />
          </div>
        ))}
      </div>
    </BottomSheet>
  )
}
