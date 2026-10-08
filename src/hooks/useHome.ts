import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Amount, CategoryId, Fund, HomeConfig, HomeItem, MonthlySchedule, Owner } from '../lib/home'
import { CATEGORIES } from '../lib/home'

export const DEFAULT_MORTGAGE: HomeConfig['mortgage'] = {
  pct: 0.8,
  years: 30,
  type: 'fixed',
  fixedRate: 2.5,
  spread: 0.7,
  mixedYears: 10,
  manualEuribor: null,
}

function parseConfig(d: Record<string, unknown> | undefined): HomeConfig | null {
  if (!d || typeof d.basePrice !== 'number') return null
  const m = (d.mortgage ?? {}) as Partial<HomeConfig['mortgage']>
  const s = (d.monthlySaving ?? {}) as Partial<HomeConfig['monthlySaving']>
  return {
    name: typeof d.name === 'string' ? d.name : 'MEROE',
    basePrice: d.basePrice,
    vatRate: typeof d.vatRate === 'number' ? d.vatRate : 0.1,
    handover: typeof d.handover === 'string' ? d.handover : '2028-10',
    mortgage: { ...DEFAULT_MORTGAGE, ...m },
    monthlySaving: { nita: s.nita ?? 0, kitos: s.kitos ?? 0 },
    budgets: typeof d.budgets === 'object' && d.budgets ? (d.budgets as HomeConfig['budgets']) : {},
  }
}

function parseAmount(a: unknown): Amount {
  const x = a as Partial<Amount> | undefined
  const value = typeof x?.value === 'number' ? x.value : 0
  return x?.type === 'pctTotal' || x?.type === 'pctBase' ? { type: x.type, value } : { type: 'fixed', value }
}

function parseMonthly(m: unknown): MonthlySchedule | null {
  const x = m as Partial<MonthlySchedule> | null | undefined
  if (!x || typeof x.count !== 'number' || typeof x.start !== 'string') return null
  return { count: x.count, day: x.day ?? 1, start: x.start, paidOverride: typeof x.paidOverride === 'number' ? x.paidOverride : null }
}

export interface HomeData {
  loading: boolean
  config: HomeConfig | null
  items: HomeItem[]
  funds: Fund[]
  euribor: EuriborData | null
}

export interface EuriborData {
  /** Último valor (%) y su mes (yyyy-mm). */
  value: number
  month: string
  history: { month: string; value: number }[]
  updatedAt: number | null
}

/** Todo lo de la casa, en tiempo real. */
export function useHome(): HomeData {
  const [config, setConfig] = useState<HomeConfig | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [items, setItems] = useState<HomeItem[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [euribor, setEuribor] = useState<EuriborData | null>(null)

  useEffect(() => {
    const unsubs = [
      onSnapshot(doc(db, 'home', 'meroe'), (s) => {
        setConfig(parseConfig(s.data()))
        setConfigLoaded(true)
      }),
      onSnapshot(collection(db, 'homeItems'), (snap) =>
        setItems(
          snap.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' })
            return {
              id: d.id,
              title: x.title ?? '',
              category: (x.category in CATEGORIES ? x.category : 'otros') as CategoryId,
              amount: parseAmount(x.amount),
              monthly: parseMonthly(x.monthly),
              date: typeof x.date === 'string' ? x.date : null,
              paid: x.paid === true,
              countsTowardPrice: x.countsTowardPrice === true,
              income: x.income === true,
              notes: x.notes ?? '',
              order: typeof x.order === 'number' ? x.order : 999,
            }
          })
            .sort((a, b) => a.order - b.order),
        ),
      ),
      onSnapshot(collection(db, 'homeFunds'), (snap) =>
        setFunds(
          snap.docs
            .map((d) => {
              const x = d.data({ serverTimestamps: 'estimate' })
              return {
                id: d.id,
                name: x.name ?? '',
                owner: (['nita', 'kitos', 'both'].includes(x.owner) ? x.owner : 'both') as Owner,
                amount: typeof x.amount === 'number' ? x.amount : 0,
                updatedAt: x.updatedAt?.toMillis?.() ?? null,
              }
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        ),
      ),
      onSnapshot(doc(db, 'rates', 'euribor'), (s) => {
        const x = s.data()
        setEuribor(
          x && typeof x.value === 'number'
            ? { value: x.value, month: x.month ?? '', history: Array.isArray(x.history) ? x.history : [], updatedAt: x.updatedAt?.toMillis?.() ?? null }
            : null,
        )
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [])

  return { loading: !configLoaded, config, items, funds, euribor }
}
