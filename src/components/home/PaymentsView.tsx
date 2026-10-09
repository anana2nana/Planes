import type { ReactNode } from 'react'
import {
  CATEGORIES,
  CATEGORY_ORDER,
  byCategory,
  formatMonth,
  handover,
  installmentDate,
  itemTotals,
  nextPayment,
  paidInstallments,
  totalPrice,
  unitAmount,
  type CategoryId,
  type HomeConfig,
  type HomeItem,
} from '../../lib/home'
import { CheckIcon, ChevronIcon, PlusIcon } from '../Icons'
import { ProgressBar } from './Charts'
import { Card, SectionTitle } from './ui'

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export function PaymentsView({
  config,
  items,
  money,
  onEditItem,
  onEditConfig,
  onOpenMortgage,
  onEditBudgets,
}: {
  config: HomeConfig
  items: HomeItem[]
  /** Formatea un importe (total o por persona, según el selector). */
  money: (v: number) => string
  onEditItem: (item: HomeItem | null, category?: CategoryId) => void
  onEditConfig: () => void
  onOpenMortgage: () => void
  onEditBudgets: () => void
}) {
  const budgets = config.budgets ?? {}
  const now = new Date()
  const cats = byCategory(items, config, now)
  const h = handover(items, config, now)
  const next = nextPayment(items, config, now)
  const spending = items.filter((i) => !i.income)
  const paid = spending.reduce((s, i) => s + itemTotals(i, config, now).paid, 0)
  const total = spending.reduce((s, i) => s + itemTotals(i, config, now).total, 0)

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Pagado hasta hoy</p>
        <p className="tabular mt-1 text-3xl font-extrabold tracking-tight">{money(paid)}</p>
        <p className="mb-3 text-sm text-muted">
          de {money(total)} en pagos y gastos (sin la hipoteca) · quedan <b className="text-ink">{money(total - paid)}</b>
        </p>
        <ProgressBar value={paid} max={total} color="#2a78d6" label="Pagado del total" />
        {next && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-3">
            <span className="text-xl" aria-hidden>
              📆
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-bold">Próximo: {money(next.amount)}</span>
              <span className="block truncate text-xs text-muted">
                {next.item.title} · {dayFmt.format(next.date)}
              </span>
            </p>
          </div>
        )}
      </Card>

      {/* Precio */}
      <button onClick={onEditConfig} className="w-full text-left">
        <Card className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            🏷️
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">Precio del piso</span>
            <span className="tabular block text-xs text-muted">
              {money(config.basePrice)} + IVA {Math.round(config.vatRate * 1000) / 10} % = <b className="text-ink">{money(totalPrice(config))}</b>
            </span>
          </span>
          <span className="text-xs font-bold text-both">Cambiar</span>
        </Card>
      </button>

      {/* Por categoría */}
      <section>
        <SectionTitle
          right={
            <button onClick={onEditBudgets} className="text-xs font-bold text-both">
              Presupuestos
            </button>
          }
        >
          Por categoría
        </SectionTitle>
        <Card className="space-y-4">
          {CATEGORY_ORDER.filter((id) => cats.some((c) => c.id === id) || budgets[id]).map((id) => {
            const c = cats.find((x) => x.id === id) ?? { id, total: 0, paid: 0, pending: 0, count: 0 }
            const meta = CATEGORIES[id]
            const isIncome = id === 'wallapop'
            const budget = budgets[id]
            const over = budget ? c.total - budget : 0
            return (
              <div key={id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    <span aria-hidden>{meta.emoji}</span> {meta.label}
                  </span>
                  <span className="tabular text-xs text-muted">
                    {isIncome ? (
                      <>
                        <b className="text-ink">+{money(c.paid)}</b> cobrado
                      </>
                    ) : budget ? (
                      <>
                        <b className={over > 0 ? 'text-rose-600' : 'text-ink'}>{money(c.total)}</b> de {money(budget)} presupuesto
                      </>
                    ) : (
                      <>
                        <b className="text-ink">{money(c.paid)}</b> de {money(c.total)}
                      </>
                    )}
                  </span>
                </div>
                {budget ? (
                  <ProgressBar value={c.total} max={budget} color={over > 0 ? '#e34948' : meta.color} label={`${meta.label}: gastado del presupuesto`} />
                ) : (
                  <ProgressBar value={c.paid} max={c.total} color={meta.color} label={`${meta.label}: pagado`} />
                )}
                {budget && (
                  <p className={`mt-1 text-[11px] font-semibold ${over > 0 ? 'text-rose-600' : 'text-muted'}`}>
                    {over > 0 ? `⚠️ Os pasáis ${money(over)}` : `Quedan ${money(budget - c.total)} de presupuesto`}
                  </p>
                )}
              </div>
            )
          })}
        </Card>
      </section>

      {/* Entrega */}
      <section>
        <SectionTitle>En la entrega · {formatMonth(config.handover)}</SectionTitle>
        <button onClick={onOpenMortgage} className="w-full text-left">
          <Card>
            <p className="tabular text-2xl font-extrabold">{money(h.remaining)}</p>
            <p className="mb-3 text-xs text-muted">lo que queda del precio con IVA</p>
            <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
              <div className="h-full bg-[#2a78d6]" style={{ width: `${(h.financed / Math.max(1, h.remaining)) * 100}%` }} />
              <div className="h-full w-0.5 bg-surface" />
              <div className="h-full flex-1 bg-[#eb6834]" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#2a78d6]" /> Hipoteca <b className="tabular ml-auto text-ink">{money(h.financed)}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#eb6834]" /> Ahorros <b className="tabular ml-auto text-ink">{money(h.own)}</b>
              </span>
            </div>
            <span className="mt-3 flex items-center justify-end gap-1 text-xs font-bold text-both">
              Simular la hipoteca <ChevronIcon className="size-3.5" />
            </span>
          </Card>
        </button>
      </section>

      {/* Lista de pagos */}
      {cats.map((c) => (
        <section key={c.id}>
          <SectionTitle>
            {CATEGORIES[c.id].emoji} {CATEGORIES[c.id].label}
          </SectionTitle>
          <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {items
              .filter((i) => i.category === c.id)
              .map((i) => (
                <ItemRow key={i.id} item={i} config={config} money={money} onClick={() => onEditItem(i)} />
              ))}
          </div>
        </section>
      ))}

      <button
        onClick={() => onEditItem(null)}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3.5 text-sm font-bold text-muted active:scale-[0.99]"
      >
        <PlusIcon className="size-4" /> Añadir gasto o ingreso
      </button>
    </div>
  )
}

export function ItemRow({ item, config, money, onClick }: { item: HomeItem; config: HomeConfig; money: (v: number) => string; onClick: () => void }) {
  const now = new Date()
  const t = itemTotals(item, config, now)
  const unit = unitAmount(item.amount, config)
  let status: ReactNode
  if (item.monthly) {
    const n = paidInstallments(item.monthly, now)
    const next = n < item.monthly.count ? installmentDate(item.monthly, n) : null
    status = (
      <span className="mt-1.5 block">
        <span className="mb-1 flex justify-between text-[11px] font-semibold text-muted">
          <span>
            {n} de {item.monthly.count} cuotas de {money(unit)}
          </span>
          {next && <span>próxima {dayFmt.format(next).replace(/ de \d{4}$/, '')}</span>}
        </span>
        <ProgressBar value={n} max={item.monthly.count} color={CATEGORIES[item.category].color} label={`${item.title}: cuotas pagadas`} />
      </span>
    )
  } else {
    status = item.paid ? (
      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
        <CheckIcon className="size-3" /> {item.income ? 'Cobrado' : 'Pagado'}
      </span>
    ) : (
      <span className="mt-0.5 block text-[11px] font-semibold text-muted">
        Pendiente{item.date ? ` · ${dayFmt.format(new Date(`${item.date}T00:00:00`))}` : ''}
      </span>
    )
  }
  return (
    <button onClick={onClick} className="block w-full px-4 py-3 text-left active:bg-stone-50">
      <span className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{item.title}</span>
        <span className={`tabular shrink-0 font-bold ${item.income ? 'text-emerald-700' : ''}`}>
          {item.income ? '+' : ''}
          {money(t.total)}
        </span>
      </span>
      {status}
    </button>
  )
}
