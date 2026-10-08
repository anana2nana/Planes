import { useEffect, useState } from 'react'
import { forecast, formatMonth, type Fund, type HomeConfig, type HomeItem, type Owner } from '../../lib/home'
import { PEOPLE } from '../../lib/people'
import type { PersonId } from '../../lib/types'
import { deleteFund, saveFund, saveHomeConfig } from '../../services/home'
import { useSheetState } from '../../hooks/useSheetState'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { PlusIcon, TrashIcon } from '../Icons'
import { Card, Label, NumberField, SectionTitle } from './ui'

const STATUS = {
  green: { emoji: '🟢', bg: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-300/40' },
  yellow: { emoji: '🟡', bg: 'from-amber-400 to-orange-400', shadow: 'shadow-amber-300/40' },
  red: { emoji: '🔴', bg: 'from-rose-400 to-red-500', shadow: 'shadow-rose-300/40' },
}

const DAY = 86_400_000

export function SavingsView({
  config,
  items,
  funds,
  me,
  money,
  onError,
}: {
  config: HomeConfig
  items: HomeItem[]
  funds: Fund[]
  me: PersonId
  money: (v: number) => string
  onError: (m: string) => void
}) {
  const now = new Date()
  const f = forecast(items, funds, config, now)
  const s = STATUS[f.status]
  const [editing, setEditing, closeEditing] = useSheetState<Fund | 'new'>()

  // Ahorro mensual de cada uno (se guarda al dejar de escribir).
  const [saving, setSaving] = useState(config.monthlySaving)
  useEffect(() => {
    if (saving.nita === config.monthlySaving.nita && saving.kitos === config.monthlySaving.kitos) return
    const t = setTimeout(() => saveHomeConfig({ monthlySaving: saving }).catch((e: Error) => onError(e.message)), 700)
    return () => clearTimeout(t)
  }, [saving, config.monthlySaving, onError])

  // ¿Cuánto haría falta ahorrar al mes para llegar con margen?
  const needMonthly = f.months > 0 && f.balance < 3000 ? f.monthly + (3000 - f.balance) / f.months : null

  const myStale = funds.filter((x) => (x.owner === me || x.owner === 'both') && (!x.updatedAt || now.getTime() - x.updatedAt > 30 * DAY))

  return (
    <div className="space-y-5">
      {/* Semáforo */}
      <div className={`rounded-[28px] bg-gradient-to-br ${s.bg} p-5 text-white shadow-lg ${s.shadow}`}>
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">En la entrega · {formatMonth(config.handover)}</p>
        <p className="mt-2 text-2xl font-extrabold leading-tight">
          {s.emoji}{' '}
          {f.status === 'red'
            ? f.balance < 0
              ? `Faltarían ${money(-f.balance)}`
              : `Algún mes os quedáis cortos`
            : f.status === 'yellow'
              ? `Llegáis justos: sobran ${money(f.balance)}`
              : `Llegáis: sobrarán ${money(f.balance)}`}
        </p>
        {f.lowest.balance < 0 && f.lowest.month !== config.handover && (
          <p className="mt-2 text-sm font-semibold opacity-95">Ojo: en {formatMonth(f.lowest.month)} os quedaríais en {money(f.lowest.balance)}.</p>
        )}
        {needMonthly !== null && (
          <p className="mt-2 text-sm opacity-95">
            Para llegar con algo de margen, tendríais que ahorrar unos <b>{money(needMonthly)}/mes</b> entre los dos.
          </p>
        )}
      </div>

      {/* Desglose */}
      <Card className="space-y-2 text-sm">
        <Row label="Tenéis ahora" value={money(f.now)} />
        <Row label={`Ahorraréis (${money(f.monthly)}/mes × ${f.months} meses)`} value={`+${money(f.saved)}`} />
        <Row label="Pagos hasta la entrega" value={`−${money(f.dueBefore)}`} />
        <Row label="En la entrega (ahorros + gastos)" value={`−${money(f.dueAtHandover)}`} />
        <div className="border-t border-stone-100 pt-2">
          <Row label="Os quedará" value={money(f.balance)} strong />
        </div>
      </Card>

      {/* Ahorro mensual */}
      <section>
        <SectionTitle>Lo que ahorra cada uno al mes</SectionTitle>
        <Card className="grid grid-cols-2 gap-3">
          {(['nita', 'kitos'] as const).map((p) => (
            <div key={p}>
              <Label>
                <span className="flex items-center gap-1.5">
                  <Avatar mode={p} size="xs" /> {PEOPLE[p].name}
                </span>
              </Label>
              <NumberField value={saving[p] || null} onChange={(v) => setSaving((x) => ({ ...x, [p]: v ?? 0 }))} suffix="€/mes" label={`Ahorro mensual de ${PEOPLE[p].name}`} placeholder="0" />
            </div>
          ))}
        </Card>
      </section>

      {/* Fondos */}
      <section>
        <SectionTitle right={<span className="text-xs text-muted">Actualizadlo de vez en cuando</span>}>Dónde está el dinero</SectionTitle>
        {myStale.length > 0 && (
          <p className="mb-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            {PEOPLE[me].name}, hace más de un mes que no actualizas {myStale.length === 1 ? `«${myStale[0].name}»` : 'tus cuentas'}. Toca para poner lo que hay ahora.
          </p>
        )}
        <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
          {funds.map((x) => (
            <button key={x.id} onClick={() => setEditing(x)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
              <Avatar mode={x.owner} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{x.name}</span>
                <span className="text-[11px] text-muted">{x.updatedAt ? `actualizado ${relative(now.getTime() - x.updatedAt)}` : 'sin fecha'}</span>
              </span>
              <span className="tabular font-bold">{money(x.amount)}</span>
            </button>
          ))}
          {funds.length === 0 && <p className="px-4 py-3 text-sm text-muted">Añade vuestras cuentas o ahorros (p. ej. «Cuenta común», «Openbank»…).</p>}
        </div>
        <button
          onClick={() => setEditing('new')}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-stone-200 py-3 text-sm font-bold text-muted active:scale-[0.99]"
        >
          <PlusIcon className="size-4" /> Añadir dinero
        </button>
      </section>

      {editing && <FundForm fund={editing === 'new' ? null : editing} me={me} onClose={closeEditing} onError={onError} />}
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={`flex items-baseline justify-between gap-3 ${strong ? 'text-base font-extrabold' : ''}`}>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
      <span className="tabular shrink-0 font-bold">{value}</span>
    </p>
  )
}

function relative(ms: number): string {
  const d = Math.floor(ms / DAY)
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? 'hace un mes' : `hace ${m} meses`
}

function FundForm({ fund, me, onClose, onError }: { fund: Fund | null; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [name, setName] = useState(fund?.name ?? '')
  const [owner, setOwner] = useState<Owner>(fund?.owner ?? me)
  const [amount, setAmount] = useState<number | null>(fund?.amount ?? null)
  const canSave = name.trim() !== '' && amount !== null

  const save = () => {
    if (!canSave) return
    saveFund({ id: fund?.id, name: name.trim(), owner, amount: amount! }, me).catch((e: Error) => onError(e.message))
    onClose()
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={fund ? 'Actualizar' : 'Añadir dinero'}
      footer={
        <div className="flex gap-2">
          {fund && (
            <button
              onClick={() => {
                deleteFund(fund.id).catch((e: Error) => onError(e.message))
                onClose()
              }}
              aria-label="Borrar"
              className="grid size-13 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600"
            >
              <TrashIcon className="size-5" />
            </button>
          )}
          <button onClick={save} disabled={!canSave} className="h-13 flex-1 rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            Guardar
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <Label>Nombre</Label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cuenta común, Openbank, ayuda familiar…"
            aria-label="Nombre"
            className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
          />
        </div>
        <div>
          <Label>De quién</Label>
          <div className="grid grid-cols-3 gap-2">
            {(['nita', 'kitos', 'both'] as const).map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={owner === o}
                onClick={() => setOwner(o)}
                className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-2 text-sm font-bold ${owner === o ? 'border-both bg-both-soft text-both' : 'border-stone-100 bg-stone-50'}`}
              >
                <Avatar mode={o} size="xs" /> {PEOPLE[o].name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Cuánto hay ahora</Label>
          <NumberField value={amount} onChange={setAmount} suffix="€" label="Cantidad" />
        </div>
      </div>
    </BottomSheet>
  )
}
