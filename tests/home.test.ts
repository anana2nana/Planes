// Tests de los cálculos (casa, hipoteca, repeticiones). Ejecutar: npm test
// Números inventados (no son los de la pareja).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { byCategory, forecast, handover, itemTotals, nextPayment, paidInstallments, startForPaidCount, totalPrice, type HomeConfig, type HomeItem } from '../src/lib/home.ts'
import { monthlyPayment, simulate } from '../src/lib/mortgage.ts'
import { nextOccurrence, upcomingOccurrences } from '../src/lib/recurrence.ts'

const cfg: HomeConfig = {
  name: 'Test', basePrice: 300000, vatRate: 0.1, handover: '2028-10',
  mortgage: { pct: 0.8, years: 30, type: 'fixed', fixedRate: 2, spread: 0.6, mixedYears: 10, manualEuribor: null },
  monthlySaving: { nita: 300, kitos: 300 },
}
let n = 0
const item = (o: Partial<HomeItem>): HomeItem => ({ id: String(n++), title: 'x', category: 'cooperativa', amount: { type: 'fixed', value: 0 }, monthly: null, date: null, paid: false, countsTowardPrice: true, income: false, notes: '', ...o })
const NOW = new Date('2026-10-08T12:00:00')
const cuotas = { count: 24, day: 5, start: '2026-07', paidOverride: null }
const items = [
  item({ title: 'Reserva', amount: { type: 'fixed', value: 3000 }, paid: true, countsTowardPrice: false }),
  item({ title: 'Entrada', amount: { type: 'pctTotal', value: 15 }, paid: true }),
  item({ title: 'Cuotas', amount: { type: 'fixed', value: 500 }, monthly: cuotas }),
  item({ title: 'Notaría', category: 'compra', amount: { type: 'fixed', value: 1000 }, countsTowardPrice: false, date: '2028-10-01' }),
]

test('precio con IVA y % del total (sin decimales raros)', () => {
  assert.equal(totalPrice(cfg), 330000)
  assert.equal(itemTotals(items[1], cfg, NOW).total, 49500)
})
test('cuotas automáticas el día 5 y ajuste manual', () => {
  assert.equal(paidInstallments(cuotas, NOW), 4)
  assert.equal(paidInstallments(cuotas, new Date('2026-10-04T23:00:00')), 3)
  assert.equal(paidInstallments({ ...cuotas, paidOverride: 3 }, NOW), 3)
  assert.equal(startForPaidCount(4, 5, NOW), '2026-07')
  assert.equal(startForPaidCount(0, 5, NOW), '2026-11')
})
test('entrega = resto del precio (hipoteca + ahorros)', () => {
  const h = handover(items, cfg, NOW)
  assert.equal(h.remaining, 330000 - 49500 - 12000)
  assert.equal(h.financed, 240000)
  assert.equal(h.own, 330000 - 49500 - 12000 - 240000)
})
test('categorías, próximo pago y previsión', () => {
  assert.equal(byCategory(items, cfg, NOW).find((c) => c.id === 'cooperativa')!.paid, 3000 + 49500 + 2000)
  const next = nextPayment(items, cfg, NOW)!
  assert.equal(next.amount, 500)
  assert.equal(next.date.toDateString(), 'Thu Nov 05 2026')
  const f = forecast(items, [{ id: 'a', name: 'Cuenta', owner: 'both', amount: 30000, updatedAt: null }], cfg, NOW)
  assert.equal(f.months, 24)
  assert.equal(f.balance, 30000 + 24 * 600 - 20 * 500 - 1000 - handover(items, cfg, NOW).own)
})
test('hipoteca francesa (fija, variable, mixta)', () => {
  assert.equal(monthlyPayment(240000, 2, 360).toFixed(2), '887.09')
  assert.ok(simulate(240000, cfg.mortgage, 2).balanceByYear[29] < 1)
  assert.equal(simulate(240000, { ...cfg.mortgage, type: 'variable' }, 2.2).payment.toFixed(2), monthlyPayment(240000, 2.8, 360).toFixed(2))
  assert.equal(simulate(240000, { ...cfg.mortgage, type: 'mixed' }, 2.2).phases.length, 2)
})
test('repeticiones semanales y anuales', () => {
  const tueSat = { days: [2, 6], yearly: false, rotate: false }
  assert.equal(nextOccurrence(new Date('2026-10-06T19:00'), tueSat, new Date('2026-10-06T18:00'))!.toDateString(), 'Sat Oct 10 2026')
  assert.equal(nextOccurrence(new Date('2028-02-29T00:00'), { days: [], yearly: true, rotate: false }, new Date('2028-03-01'))!.toDateString(), 'Wed Feb 28 2029')
  assert.deepEqual(upcomingOccurrences(new Date('2026-10-24T19:00'), { days: [6], yearly: false, rotate: false }, new Date('2026-11-08')).map((d) => d.getHours()), [19, 19])
})
