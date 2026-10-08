// Cálculos de la casa (cooperativa MEROE): plan de pagos, entrega, previsión de ahorro.
// Puro (sin Firebase) para poder probarlo.

export type Owner = 'nita' | 'kitos' | 'both'

/** Importe: fijo en euros o % del precio con IVA (así, si sube el precio, se recalcula). */
export type Amount = { type: 'fixed'; value: number } | { type: 'pctTotal'; value: number } | { type: 'pctBase'; value: number }

export interface HomeConfig {
  name: string
  /** Precio del piso sin IVA. */
  basePrice: number
  /** IVA (0.10 = 10 %). */
  vatRate: number
  /** Mes estimado de la entrega / firma de la hipoteca (yyyy-mm). */
  handover: string
  mortgage: MortgageConfig
  /** Lo que ahorra cada uno al mes para la casa. */
  monthlySaving: { nita: number; kitos: number }
}

export interface MortgageConfig {
  /** % del precio sin IVA que financia el banco (0.8 = 80 %). */
  pct: number
  years: number
  type: 'fixed' | 'variable' | 'mixed'
  /** TIN fijo en % (2 = 2 %). */
  fixedRate: number
  /** Diferencial sobre el Euríbor en % (variable y mixta). */
  spread: number
  /** Años a tipo fijo en la mixta. */
  mixedYears: number
  /** Euríbor que usar si no hay dato automático (%). */
  manualEuribor: number | null
}

export interface MonthlySchedule {
  count: number
  /** Día del mes en que se cobra. */
  day: number
  /** Mes de la primera cuota (yyyy-mm). */
  start: string
  /** Ajuste manual de cuántas van pagadas (null = automático según la fecha). */
  paidOverride: number | null
}

export interface HomeItem {
  id: string
  title: string
  category: CategoryId
  /** Para cuotas mensuales, el importe de cada cuota. */
  amount: Amount
  monthly: MonthlySchedule | null
  /** Pagos sueltos: fecha prevista o de pago (yyyy-mm-dd). Sin fecha = antes de la entrega. */
  date: string | null
  paid: boolean
  /** Forma parte del precio del piso (reduce lo que queda para la entrega). */
  countsTowardPrice: boolean
  /** Ingreso (p. ej. venta en Wallapop): suma en vez de restar. */
  income: boolean
  notes: string
}

export interface Fund {
  id: string
  name: string
  owner: Owner
  amount: number
  updatedAt: number | null
}

export type CategoryId = 'cooperativa' | 'compra' | 'impuestos' | 'muebles' | 'electro' | 'reforma' | 'wallapop' | 'otros'

// Colores: paleta categórica validada (orden fijo de la guía de visualización; cada barra lleva su etiqueta).
export const CATEGORIES: Record<CategoryId, { label: string; emoji: string; color: string }> = {
  cooperativa: { label: 'Cooperativa', emoji: '🏗️', color: '#2a78d6' },
  compra: { label: 'Gastos de compra', emoji: '🖋️', color: '#eb6834' },
  impuestos: { label: 'Impuestos', emoji: '🏛️', color: '#1baf7a' },
  muebles: { label: 'Muebles', emoji: '🛋️', color: '#eda100' },
  electro: { label: 'Electrodomésticos', emoji: '🧺', color: '#e87ba4' },
  reforma: { label: 'Reformas', emoji: '🔨', color: '#008300' },
  wallapop: { label: 'Wallapop (ventas)', emoji: '💸', color: '#4a3aa7' },
  otros: { label: 'Otros', emoji: '📦', color: '#e34948' },
}
export const CATEGORY_ORDER: CategoryId[] = ['cooperativa', 'compra', 'impuestos', 'muebles', 'electro', 'reforma', 'wallapop', 'otros']

// ─── Fechas (meses yyyy-mm, en hora local) ──────────────────────────────────

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export function parseMonth(m: string): { y: number; m: number } {
  const [y, mo] = m.split('-').map(Number)
  return { y, m: mo - 1 }
}
export function addMonths(m: string, n: number): string {
  const { y, m: mo } = parseMonth(m)
  return monthKey(new Date(y, mo + n, 1))
}
/** Meses de diferencia (b − a). */
export function monthsBetween(a: string, b: string): number {
  const A = parseMonth(a)
  const B = parseMonth(b)
  return (B.y - A.y) * 12 + (B.m - A.m)
}
/** Fecha de la cuota i (0 = primera). El día se ajusta si el mes es más corto. */
export function installmentDate(s: MonthlySchedule, i: number): Date {
  const { y, m } = parseMonth(addMonths(s.start, i))
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(s.day, last))
}

// ─── Importes ───────────────────────────────────────────────────────────────

/** Redondeo a céntimos (evita 52800.00000000001). */
export const cents = (v: number) => Math.round(v * 100) / 100

export const totalPrice = (c: Pick<HomeConfig, 'basePrice' | 'vatRate'>) => cents(c.basePrice * (1 + c.vatRate))

/** Importe de un pago (de cada cuota, si es mensual). */
export function unitAmount(a: Amount, c: Pick<HomeConfig, 'basePrice' | 'vatRate'>): number {
  if (a.type === 'fixed') return a.value
  if (a.type === 'pctBase') return cents((c.basePrice * a.value) / 100)
  return cents((totalPrice(c) * a.value) / 100)
}

/** Cuotas pagadas: automático (las que ya han llegado a su día) o el ajuste manual. */
export function paidInstallments(s: MonthlySchedule, now: Date): number {
  if (s.paidOverride !== null) return Math.max(0, Math.min(s.count, s.paidOverride))
  let n = 0
  while (n < s.count && installmentDate(s, n).getTime() <= now.getTime()) n++
  return n
}

/** Mes de la primera cuota para que, hoy, vayan `paid` cuotas pagadas (para el asistente inicial). */
export function startForPaidCount(paid: number, day: number, now: Date): string {
  // Mes de la última cuota ya cobrada: este mes si ya ha pasado el día de cobro; si no, el anterior.
  const lastPaid = now.getDate() >= day ? monthKey(now) : addMonths(monthKey(now), -1)
  // Sin cuotas pagadas, la primera es la siguiente que toque.
  if (paid <= 0) return addMonths(lastPaid, 1)
  return addMonths(lastPaid, -(paid - 1))
}

export interface ItemTotals {
  total: number
  paid: number
  pending: number
}

export function itemTotals(item: HomeItem, c: Pick<HomeConfig, 'basePrice' | 'vatRate'>, now: Date): ItemTotals {
  const unit = unitAmount(item.amount, c)
  if (item.monthly) {
    const paidN = paidInstallments(item.monthly, now)
    return { total: cents(unit * item.monthly.count), paid: cents(unit * paidN), pending: cents(unit * (item.monthly.count - paidN)) }
  }
  return { total: unit, paid: item.paid ? unit : 0, pending: item.paid ? 0 : unit }
}

/** Próximo pago pendiente (con fecha). */
export function nextPayment(items: HomeItem[], c: Pick<HomeConfig, 'basePrice' | 'vatRate'>, now: Date): { item: HomeItem; date: Date; amount: number } | null {
  let best: { item: HomeItem; date: Date; amount: number } | null = null
  for (const item of items) {
    if (item.income) continue
    let date: Date | null = null
    if (item.monthly) {
      const n = paidInstallments(item.monthly, now)
      if (n < item.monthly.count) date = installmentDate(item.monthly, n)
    } else if (!item.paid && item.date) {
      date = new Date(`${item.date}T00:00:00`)
    }
    if (date && (!best || date < best.date)) best = { item, date, amount: unitAmount(item.amount, c) }
  }
  return best
}

// ─── Entrega e hipoteca ─────────────────────────────────────────────────────

export interface Handover {
  /** Lo que queda del precio (con IVA) para pagar en la entrega. */
  remaining: number
  /** Lo que financia el banco. */
  financed: number
  /** Lo que hay que poner de ahorros en la entrega (normalmente el IVA de la parte financiada). */
  own: number
}

export function handover(items: HomeItem[], c: HomeConfig, now: Date): Handover {
  const towardPrice = items.filter((i) => i.countsTowardPrice && !i.income).reduce((s, i) => s + itemTotals(i, c, now).total, 0)
  const remaining = cents(Math.max(0, totalPrice(c) - towardPrice))
  const financed = cents(Math.min(remaining, c.basePrice * c.mortgage.pct))
  return { remaining, financed, own: cents(remaining - financed) }
}

export interface CategorySummary {
  id: CategoryId
  total: number
  paid: number
  pending: number
  count: number
}

export function byCategory(items: HomeItem[], c: Pick<HomeConfig, 'basePrice' | 'vatRate'>, now: Date): CategorySummary[] {
  const map = new Map<CategoryId, CategorySummary>()
  for (const item of items) {
    const t = itemTotals(item, c, now)
    const cur = map.get(item.category) ?? { id: item.category, total: 0, paid: 0, pending: 0, count: 0 }
    map.set(item.category, {
      ...cur,
      total: cents(cur.total + t.total),
      paid: cents(cur.paid + t.paid),
      pending: cents(cur.pending + t.pending),
      count: cur.count + 1,
    })
  }
  return CATEGORY_ORDER.filter((id) => map.has(id)).map((id) => map.get(id)!)
}

// ─── ¿Llegamos? ─────────────────────────────────────────────────────────────

export interface Forecast {
  /** Dinero que tenéis ahora (suma de los fondos). */
  now: number
  /** Ahorro de los dos al mes. */
  monthly: number
  months: number
  /** Lo que habréis ahorrado de aquí a la entrega. */
  saved: number
  /** Pagos pendientes antes de la entrega (cuotas, hitos, gastos sin fecha…). */
  dueBefore: number
  /** Lo que hay que poner en la entrega (parte propia + gastos con fecha de entrega). */
  dueAtHandover: number
  /** Lo que os quedará después de la entrega (negativo = falta). */
  balance: number
  /** Mes más justo antes de la entrega y su saldo (por si algún mes os quedáis cortos). */
  lowest: { month: string; balance: number }
  status: 'green' | 'yellow' | 'red'
}

/** Margen por debajo del cual la previsión sale en amarillo. */
export const SAFETY_MARGIN = 3000

export function forecast(items: HomeItem[], funds: Fund[], c: HomeConfig, now: Date): Forecast {
  const start = monthKey(now)
  const months = Math.max(0, monthsBetween(start, c.handover))
  const monthly = (c.monthlySaving.nita || 0) + (c.monthlySaving.kitos || 0)
  const cash = funds.reduce((s, f) => s + (f.amount || 0), 0)

  // Pagos por mes (desde el mes que viene hasta la entrega).
  const byMonth = new Map<string, number>()
  const add = (m: string, v: number) => byMonth.set(m, (byMonth.get(m) ?? 0) + v)
  let dueBefore = 0
  let dueAtHandover = 0
  for (const item of items) {
    const unit = unitAmount(item.amount, c)
    const sign = item.income ? -1 : 1
    if (item.monthly) {
      for (let i = paidInstallments(item.monthly, now); i < item.monthly.count; i++) {
        const m = monthKey(installmentDate(item.monthly, i))
        if (monthsBetween(m, c.handover) > 0) {
          add(m < start ? start : m, sign * unit)
          dueBefore += sign * unit
        } else {
          add(c.handover, sign * unit)
          dueAtHandover += sign * unit
        }
      }
    } else if (!item.paid) {
      // Sin fecha: por prudencia, se cuenta como pendiente ya (antes de la entrega).
      const m = item.date ? item.date.slice(0, 7) : start
      if (monthsBetween(m, c.handover) > 0) {
        add(m < start ? start : m, sign * unit)
        dueBefore += sign * unit
      } else {
        add(c.handover, sign * unit)
        dueAtHandover += sign * unit
      }
    }
  }
  const h = handover(items, c, now)
  add(c.handover, h.own)
  dueAtHandover += h.own

  // Recorrido mes a mes para encontrar el momento más justo.
  let balance = cash
  let lowest = { month: start, balance: cash - (byMonth.get(start) ?? 0) }
  for (let i = 0; i <= months; i++) {
    const m = addMonths(start, i)
    if (i > 0) balance += monthly
    balance -= byMonth.get(m) ?? 0
    if (balance < lowest.balance) lowest = { month: m, balance }
  }
  const status = balance < 0 || lowest.balance < 0 ? 'red' : balance < SAFETY_MARGIN ? 'yellow' : 'green'
  return { now: cash, monthly, months, saved: monthly * months, dueBefore, dueAtHandover, balance, lowest, status }
}

// ─── Formato ────────────────────────────────────────────────────────────────

// useGrouping 'always': en español Intl no separa los miles en números de 4 cifras ("1214 €"); en España se escribe "1.214 €".
const eur0 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' })
const eur2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
/** "68.360 €" (sin decimales salvo importes pequeños con céntimos). */
export function eur(v: number, decimals = false): string {
  return (decimals || (Math.abs(v) < 1000 && !Number.isInteger(Math.round(v * 100) / 100)) ? eur2 : eur0).format(v)
}
const monthFmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
export const formatMonth = (m: string) => {
  const { y, m: mo } = parseMonth(m)
  return monthFmt.format(new Date(y, mo, 1))
}
