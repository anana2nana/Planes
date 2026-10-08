import { useState } from 'react'
import {
  CATEGORIES,
  CATEGORY_ORDER,
  eur,
  installmentDate,
  monthKey,
  paidInstallments,
  unitAmount,
  type CategoryId,
  type HomeConfig,
  type HomeItem,
} from '../../lib/home'
import type { PersonId } from '../../lib/types'
import { deleteHomeItem, saveHomeItem } from '../../services/home'
import { BottomSheet } from '../BottomSheet'
import { TrashIcon } from '../Icons'
import { Label, NumberField, Segmented, Stepper, Switch } from './ui'
import { Receipts } from './Receipts'

type Draft = Omit<HomeItem, 'id'> & { id?: string }

const empty = (category: CategoryId): Draft => ({
  title: '',
  category,
  amount: { type: 'fixed', value: 0 },
  monthly: null,
  date: null,
  paid: false,
  countsTowardPrice: category === 'cooperativa',
  income: category === 'wallapop',
  notes: '',
})

export function ItemForm({
  item,
  defaultCategory = 'muebles',
  config,
  me,
  onClose,
  onError,
}: {
  item: HomeItem | null
  defaultCategory?: CategoryId
  config: HomeConfig
  me: PersonId
  onClose: () => void
  onError: (m: string) => void
}) {
  const [d, setD] = useState<Draft>(() => item ?? empty(defaultCategory))
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const now = new Date()
  const unit = unitAmount(d.amount, config)
  const isPct = d.amount.type !== 'fixed'
  const canSave = d.title.trim() !== '' && d.amount.value > 0 && (!d.monthly || d.monthly.count > 0)

  const save = () => {
    if (!canSave) return
    saveHomeItem({ ...d, title: d.title.trim() }, me).catch((e: Error) => onError(`No se pudo guardar: ${e.message}`))
    onClose()
  }

  const footer = (
    <div className="flex gap-2">
      {item && (
        <button type="button" onClick={() => setConfirm((v) => !v)} aria-label="Borrar" className="grid size-13 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <TrashIcon className="size-5" />
        </button>
      )}
      <button onClick={save} disabled={!canSave} className="h-13 flex-1 rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
        {item ? 'Guardar' : d.income ? 'Añadir ingreso' : 'Añadir gasto'}
      </button>
    </div>
  )

  return (
    <BottomSheet open onClose={onClose} title={item ? 'Editar' : d.income ? 'Nuevo ingreso' : 'Nuevo gasto'} footer={footer}>
      <div className="space-y-5">
        {confirm && item && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
            <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{item.title}»?</p>
            <button
              onClick={() => {
                deleteHomeItem(item.id).catch((e: Error) => onError(e.message))
                onClose()
              }}
              className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
            >
              Borrar
            </button>
          </div>
        )}

        <input
          autoFocus={!item}
          value={d.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={d.income ? 'Ej. Sofá viejo en Wallapop' : 'Ej. Sofá, nevera, notaría…'}
          aria-label="Concepto"
          maxLength={80}
          className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
          style={{ fontSize: 20 }}
        />

        <div>
          <Label>Categoría</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((c) => {
              const active = d.category === c
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setD((x) => ({
                      ...x,
                      category: c,
                      income: c === 'wallapop' ? true : x.category === 'wallapop' ? false : x.income,
                      countsTowardPrice: c === 'cooperativa' ? x.countsTowardPrice : false,
                    }))
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                    active ? 'bg-ink text-cream' : 'bg-stone-100 text-ink'
                  }`}
                >
                  <span aria-hidden>{CATEGORIES[c].emoji}</span>
                  {CATEGORIES[c].label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Importe{d.monthly ? ' de cada cuota' : ''}</Label>
          <Segmented
            label="Tipo de importe"
            value={d.amount.type === 'fixed' ? 'fixed' : 'pct'}
            options={[
              { value: 'fixed', label: 'En euros' },
              { value: 'pct', label: '% del precio' },
            ]}
            onChange={(v) => set('amount', v === 'fixed' ? { type: 'fixed', value: Math.round(unit) } : { type: 'pctTotal', value: 0 })}
          />
          <NumberField
            value={d.amount.value || null}
            onChange={(v) => set('amount', { ...d.amount, value: v ?? 0 })}
            suffix={isPct ? '%' : '€'}
            label="Importe"
          />
          {isPct && (
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{d.amount.type === 'pctTotal' ? 'del precio con IVA' : 'del precio sin IVA'}</span>
              <span className="tabular font-bold text-ink">= {eur(unit)}</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>¿Cuándo?</Label>
          <Segmented
            label="Pago único o mensual"
            value={d.monthly ? 'monthly' : 'once'}
            options={[
              { value: 'once', label: 'Un pago' },
              { value: 'monthly', label: 'Cuotas mensuales' },
            ]}
            onChange={(v) => set('monthly', v === 'monthly' ? { count: 12, day: 5, start: monthKey(now), paidOverride: null } : null)}
          />

          {d.monthly ? (
            <MonthlyEditor d={d} setMonthly={(m) => set('monthly', m)} unit={unit} />
          ) : (
            <>
              <input
                type="date"
                value={d.date ?? ''}
                onChange={(e) => set('date', e.target.value || null)}
                aria-label="Fecha"
                className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
              />
              <Switch label={d.income ? 'Ya cobrado' : 'Ya pagado'} checked={d.paid} onChange={(v) => set('paid', v)} />
            </>
          )}
        </div>

        {d.category === 'cooperativa' && (
          <Switch
            label="Forma parte del precio del piso"
            hint="Se descuenta de lo que queda para la entrega (hipoteca + ahorros)."
            checked={d.countsTowardPrice}
            onChange={(v) => set('countsTowardPrice', v)}
          />
        )}

        <div>
          <Label>Tickets y facturas</Label>
          {item ? (
            <Receipts itemId={item.id} me={me} onError={onError} />
          ) : (
            <p className="text-xs text-muted">Guarda primero el gasto y luego podrás añadir fotos del ticket.</p>
          )}
        </div>

        <div>
          <Label>Notas</Label>
          <textarea
            value={d.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="w-full resize-none rounded-2xl border border-stone-200 bg-surface px-3 py-2.5 outline-none focus:border-both"
          />
        </div>
      </div>
    </BottomSheet>
  )
}

function MonthlyEditor({ d, setMonthly, unit }: { d: Draft; setMonthly: (m: NonNullable<Draft['monthly']>) => void; unit: number }) {
  const m = d.monthly!
  const now = new Date()
  const auto = paidInstallments({ ...m, paidOverride: null }, now)
  const paid = paidInstallments(m, now)
  const next = paid < m.count ? installmentDate(m, paid) : null
  return (
    <div className="space-y-3 rounded-2xl bg-stone-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Nº cuotas</Label>
          <NumberField value={m.count} onChange={(v) => setMonthly({ ...m, count: Math.max(1, Math.round(v ?? 1)) })} label="Número de cuotas" />
        </div>
        <div>
          <Label>Día</Label>
          <NumberField value={m.day} onChange={(v) => setMonthly({ ...m, day: Math.min(31, Math.max(1, Math.round(v ?? 1))) })} label="Día de cobro" />
        </div>
        <div>
          <Label>Primera</Label>
          <input
            type="month"
            value={m.start}
            onChange={(e) => e.target.value && setMonthly({ ...m, start: e.target.value })}
            aria-label="Mes de la primera cuota"
            className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-2 text-sm font-semibold outline-none focus:border-both"
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">
          Pagadas <span className="text-muted">de {m.count}</span>
        </span>
        <Stepper value={paid} min={0} max={m.count} onChange={(v) => setMonthly({ ...m, paidOverride: v === auto ? null : v })} label="Cuotas pagadas" />
      </div>
      <p className="text-xs text-muted">
        {m.paidOverride === null ? `Automático: cada día ${m.day} se marca la siguiente.` : 'Ajustado a mano (ya no avanza solo). '}
        {m.paidOverride !== null && (
          <button type="button" className="font-bold text-both" onClick={() => setMonthly({ ...m, paidOverride: null })}>
            Volver a automático
          </button>
        )}
        {next && ` Próxima: ${next.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}.`} Total: {eur(unit * m.count)}.
      </p>
    </div>
  )
}
