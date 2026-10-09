import { CATEGORIES, itemTotals, type CategoryId, type HomeConfig, type HomeItem } from '../../lib/home'
import { PlusIcon } from '../Icons'
import { ProgressBar } from './Charts'
import { ItemRow } from './PaymentsView'
import { Card, SectionTitle } from './ui'

/** Lo de amueblar el piso: muebles, electrodomésticos y reformas (con su presupuesto) y lo que vendéis en Wallapop. */
export const FURNITURE: CategoryId[] = ['muebles', 'electro', 'reforma']

export function FurnitureView({
  config,
  items,
  money,
  onEditItem,
  onEditBudgets,
}: {
  config: HomeConfig
  items: HomeItem[]
  money: (v: number) => string
  onEditItem: (item: HomeItem | null, category?: CategoryId) => void
  onEditBudgets: () => void
}) {
  const now = new Date()
  const budgets = config.budgets ?? {}
  const of = (c: CategoryId) => items.filter((i) => i.category === c)
  const spentIn = (c: CategoryId) => of(c).reduce((s, i) => s + itemTotals(i, config, now).total, 0)
  const spent = FURNITURE.reduce((s, c) => s + spentIn(c), 0)
  const budget = FURNITURE.reduce((s, c) => s + (budgets[c] ?? 0), 0)
  const sold = of('wallapop').reduce((s, i) => s + itemTotals(i, config, now).paid, 0)
  const over = budget ? spent - budget : 0

  return (
    <div className="space-y-5">
      <Card>
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Gastado en amueblar</p>
        <p className="tabular mt-1 text-3xl font-extrabold tracking-tight">{money(spent)}</p>
        {budget > 0 ? (
          <>
            <p className="mb-3 text-sm text-muted">
              de {money(budget)} de presupuesto ·{' '}
              <b className={over > 0 ? 'text-rose-600' : 'text-ink'}>{over > 0 ? `os pasáis ${money(over)}` : `quedan ${money(budget - spent)}`}</b>
            </p>
            <ProgressBar value={spent} max={budget} color={over > 0 ? '#e34948' : '#eda100'} label="Gastado del presupuesto de muebles" />
          </>
        ) : (
          <p className="text-sm text-muted">Ponedle un presupuesto para ver cuánto os queda.</p>
        )}
        {sold > 0 && <p className="mt-3 text-sm text-muted">💸 Recuperado vendiendo en Wallapop: <b className="text-emerald-700">+{money(sold)}</b></p>}
        <button onClick={onEditBudgets} className="mt-3 text-xs font-bold text-both">
          {budget > 0 ? 'Cambiar presupuestos' : 'Poner presupuesto'}
        </button>
      </Card>

      {[...FURNITURE, 'wallapop' as CategoryId].map((c) => {
        const list = of(c)
        const b = budgets[c]
        const s = spentIn(c)
        return (
          <section key={c}>
            <SectionTitle
              right={
                <button onClick={() => onEditItem(null, c)} className="flex items-center gap-1 text-xs font-bold text-both">
                  <PlusIcon className="size-3.5" /> Añadir
                </button>
              }
            >
              {CATEGORIES[c].emoji} {CATEGORIES[c].label}
              {b ? ` · ${money(s)} de ${money(b)}` : ''}
            </SectionTitle>
            {b ? (
              <div className="mb-2 px-1">
                <ProgressBar value={s} max={b} color={s > b ? '#e34948' : CATEGORIES[c].color} label={`${CATEGORIES[c].label}: gastado del presupuesto`} />
              </div>
            ) : null}
            {list.length === 0 ? (
              <button onClick={() => onEditItem(null, c)} className="w-full rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-semibold text-muted">
                {c === 'wallapop' ? 'Apunta lo que vendáis' : c === 'reforma' ? 'Pintura, cocina, armarios…' : c === 'electro' ? 'Nevera, lavadora, horno…' : 'Sofá, cama, mesa…'}
              </button>
            ) : (
              <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
                {list.map((i) => (
                  <ItemRow key={i.id} item={i} config={config} money={money} onClick={() => onEditItem(i)} />
                ))}
              </div>
            )}
          </section>
        )
      })}
      <p className="px-2 text-center text-xs text-muted">🧾 Abre un mueble ya guardado para añadirle la foto del ticket. Para la garantía, apúntalo también en Hogar → Papeles.</p>
    </div>
  )
}
