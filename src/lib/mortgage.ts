// Simulador de hipoteca (sistema francés: cuota constante mientras no cambie el tipo).

import type { MortgageConfig } from './home'

/** Cuota mensual para un capital, TIN anual (%) y número de meses. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0) return 0
  const r = annualRatePct / 100 / 12
  if (r === 0) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

export interface MortgagePhase {
  label: string
  months: number
  rate: number
  payment: number
}

export interface MortgageResult {
  phases: MortgagePhase[]
  /** Cuota del primer tramo. */
  payment: number
  totalInterest: number
  totalPaid: number
  /** Capital pendiente al final de cada año (para el gráfico). */
  balanceByYear: number[]
}

/** Tipo efectivo (%) para un tramo variable: Euríbor + diferencial (sin tipos negativos). */
export const variableRate = (euribor: number, spread: number) => Math.max(0, euribor + spread)

/**
 * Simula la hipoteca. En la variable (o el tramo variable de la mixta) se supone
 * que el Euríbor se queda como está hoy: es una estimación, no una predicción.
 */
export function simulate(principal: number, cfg: MortgageConfig, euribor: number): MortgageResult {
  const n = Math.round(cfg.years * 12)
  const plan: { label: string; months: number; rate: number }[] =
    cfg.type === 'fixed'
      ? [{ label: 'Fijo', months: n, rate: cfg.fixedRate }]
      : cfg.type === 'variable'
        ? [{ label: 'Variable', months: n, rate: variableRate(euribor, cfg.spread) }]
        : [
            { label: `Fijo ${cfg.mixedYears} años`, months: Math.min(n, Math.round(cfg.mixedYears * 12)), rate: cfg.fixedRate },
            { label: 'Después, variable', months: Math.max(0, n - Math.round(cfg.mixedYears * 12)), rate: variableRate(euribor, cfg.spread) },
          ].filter((p) => p.months > 0)

  let balance = principal
  let remaining = n
  let totalInterest = 0
  const balanceByYear: number[] = []
  const phases: MortgagePhase[] = []
  let month = 0
  for (const p of plan) {
    // Al empezar cada tramo se recalcula la cuota con el capital y los meses que quedan.
    const payment = monthlyPayment(balance, p.rate, remaining)
    phases.push({ ...p, payment })
    const r = p.rate / 100 / 12
    for (let i = 0; i < p.months; i++) {
      const interest = balance * r
      totalInterest += interest
      balance = Math.max(0, balance - (payment - interest))
      month++
      remaining--
      if (month % 12 === 0) balanceByYear.push(balance)
    }
  }
  return { phases, payment: phases[0]?.payment ?? 0, totalInterest, totalPaid: principal + totalInterest, balanceByYear }
}
