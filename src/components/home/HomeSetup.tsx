import { useState } from 'react'
import { DEFAULT_MORTGAGE } from '../../hooks/useHome'
import { addMonths, eur, monthKey, startForPaidCount, totalPrice, unitAmount, type HomeConfig, type HomeItem } from '../../lib/home'
import { setupHome } from '../../services/home'
import { Card, Label, NumberField, Stepper } from './ui'

type Draft = Omit<HomeItem, 'id'>

interface TemplateRow {
  key: string
  title: string
  enabled: boolean
  /** Explicación corta debajo. */
  hint: string
  build: (c: HomeConfig, handoverDate: string) => Draft
}

const base = (o: Partial<Draft>): Draft => ({
  title: '',
  category: 'cooperativa',
  amount: { type: 'fixed', value: 0 },
  monthly: null,
  date: null,
  paid: false,
  countsTowardPrice: true,
  income: false,
  notes: '',
  ...o,
})

/** Estructura de pagos de la cooperativa (la del Excel), sin importes personales: el precio lo pone ella. */
const TEMPLATE: TemplateRow[] = [
  { key: 'reserva', title: 'Reserva', enabled: true, hint: '5.000 € · pagado (fondo: no se descuenta del precio)', build: () => base({ title: 'Reserva', amount: { type: 'fixed', value: 5000 }, paid: true, countsTowardPrice: false, notes: 'Es un fondo: no se descuenta del precio, pero si sube el precio se cubre primero con esto.' }) },
  { key: 'adhesion', title: 'Adhesión', enabled: true, hint: '12,5 % del precio con IVA · pagado', build: () => base({ title: 'Adhesión', amount: { type: 'pctTotal', value: 12.5 }, paid: true }) },
  { key: 'adicional', title: 'Aportación adicional (marzo)', enabled: true, hint: '2,5 % del precio con IVA · pagado', build: () => base({ title: 'Aportación adicional (marzo)', amount: { type: 'pctTotal', value: 2.5 }, paid: true }) },
  { key: 'obra', title: '12 meses de obra', enabled: true, hint: '1,25 % del precio con IVA · pendiente', build: () => base({ title: '12 meses de obra', amount: { type: 'pctTotal', value: 1.25 } }) },
  { key: 'notaria', title: 'Notaría', enabled: true, hint: '1.300 € · en la entrega', build: (_c, d) => base({ title: 'Notaría', category: 'compra', amount: { type: 'fixed', value: 1300 }, countsTowardPrice: false, date: d }) },
  { key: 'registro', title: 'Registro', enabled: true, hint: '640 € · en la entrega', build: (_c, d) => base({ title: 'Registro', category: 'compra', amount: { type: 'fixed', value: 640 }, countsTowardPrice: false, date: d }) },
  { key: 'gestoria', title: 'Gestoría', enabled: true, hint: '130 € · en la entrega', build: (_c, d) => base({ title: 'Gestoría', category: 'compra', amount: { type: 'fixed', value: 130 }, countsTowardPrice: false, date: d }) },
  { key: 'tasacion', title: 'Tasación', enabled: true, hint: '370 € · antes de firmar la hipoteca', build: (_c, d) => base({ title: 'Tasación', category: 'compra', amount: { type: 'fixed', value: 370 }, countsTowardPrice: false, date: d }) },
  {
    key: 'ajd',
    title: 'AJD (impuesto de la escritura)',
    enabled: true,
    hint: '⚠️ No está en tu Excel. Se paga en la escritura: en la Comunidad de Madrid, 0,75 % del precio sin IVA (anunciado 0,4 % para menores de 40 desde 2027).',
    build: (_c, d) => base({ title: 'AJD (impuesto de la escritura)', category: 'impuestos', amount: { type: 'pctBase', value: 0.75 }, countsTowardPrice: false, date: d, notes: 'Comunidad de Madrid: 0,75 %. Si se aprueba la rebaja para menores de 40 (desde 2027), bajaría al 0,4 %.' }),
  },
]

export function HomeSetup({ onError }: { onError: (m: string) => void }) {
  const now = new Date()
  const [price, setPrice] = useState<number | null>(null)
  const [vat, setVat] = useState<number | null>(10)
  const [handover, setHandover] = useState(addMonths(monthKey(now), 24))
  const [quota, setQuota] = useState<number | null>(660)
  const [count, setCount] = useState<number | null>(24)
  const [day, setDay] = useState<number | null>(5)
  const [paid, setPaid] = useState(0)
  const [rows, setRows] = useState(() => Object.fromEntries(TEMPLATE.map((t) => [t.key, t.enabled])))
  const [busy, setBusy] = useState(false)

  const cfg: HomeConfig | null =
    price && price > 0
      ? {
          name: 'MEROE',
          basePrice: price,
          vatRate: (vat ?? 10) / 100,
          handover,
          mortgage: { ...DEFAULT_MORTGAGE },
          monthlySaving: { nita: 0, kitos: 0 },
        }
      : null
  const handoverDate = `${handover}-01`

  const create = async () => {
    if (!cfg) return
    setBusy(true)
    const items: Draft[] = []
    const add = (key: string) => {
      const row = TEMPLATE.find((t) => t.key === key)!
      if (rows[key]) items.push(row.build(cfg, handoverDate))
    }
    ;['reserva', 'adhesion', 'adicional'].forEach(add)
    if (quota && count) {
      items.push(
        base({
          title: 'Cuotas mensuales',
          amount: { type: 'fixed', value: quota },
          monthly: { count, day: day ?? 5, start: startForPaidCount(paid, day ?? 5, now), paidOverride: null },
        }),
      )
    }
    ;['obra', 'notaria', 'registro', 'gestoria', 'tasacion', 'ajd'].forEach(add)
    try {
      await setupHome(cfg, items)
    } catch (e) {
      onError(`No se pudo guardar: ${(e as Error).message}`)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-5 text-white shadow-lg shadow-orange-300/40">
        <p className="text-4xl">🏡</p>
        <h2 className="mt-2 text-2xl font-extrabold leading-tight">Vamos a montar MEROE</h2>
        <p className="mt-1 text-sm font-medium opacity-90">Un minuto y tendréis vuestro plan de pagos, la hipoteca y la previsión de ahorro. Todo se puede cambiar después.</p>
      </div>

      <Card className="space-y-4">
        <h3 className="font-extrabold">1 · El piso</h3>
        <div>
          <Label>Precio sin IVA</Label>
          <NumberField value={price} onChange={setPrice} suffix="€" label="Precio sin IVA" placeholder="Ej. 300.000" />
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
              value={handover}
              onChange={(e) => e.target.value && setHandover(e.target.value)}
              aria-label="Mes de entrega aproximado"
              className="h-12 w-full rounded-2xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both"
            />
          </div>
        </div>
        {cfg && (
          <p className="text-sm text-muted">
            Con IVA: <b className="text-ink">{eur(totalPrice(cfg))}</b>
          </p>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="font-extrabold">2 · Cuotas mensuales</h3>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Importe</Label>
            <NumberField value={quota} onChange={setQuota} suffix="€" label="Importe de la cuota" />
          </div>
          <div>
            <Label>Nº cuotas</Label>
            <NumberField value={count} onChange={setCount} label="Número de cuotas" />
          </div>
          <div>
            <Label>Día</Label>
            <NumberField value={day} onChange={setDay} label="Día del mes del cobro" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">¿Cuántas lleváis pagadas?</span>
          <Stepper value={paid} min={0} max={count ?? 24} onChange={setPaid} label="Cuotas pagadas" />
        </div>
        <p className="text-xs text-muted">A partir de ahora, cada día {day ?? 5} se marcará sola como pagada. Si no estáis seguros, podréis ajustarlo luego.</p>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-extrabold">3 · El resto de pagos</h3>
        <p className="text-xs text-muted">Sacados de vuestro Excel. Lo que queda del precio para la entrega (hipoteca + ahorros) se calcula solo.</p>
        {TEMPLATE.map((t) => {
          const draft = cfg ? t.build(cfg, handoverDate) : null
          return (
            <label key={t.key} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ${t.key === 'ajd' ? 'bg-amber-50' : 'bg-stone-50'}`}>
              <input
                type="checkbox"
                checked={rows[t.key]}
                onChange={(e) => setRows((r) => ({ ...r, [t.key]: e.target.checked }))}
                className="mt-1 size-5 shrink-0 accent-[#8b5cf6]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2 text-sm font-semibold">
                  <span>{t.title}</span>
                  {draft && cfg && <span className="tabular shrink-0">{eur(unitAmount(draft.amount, cfg))}</span>}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
              </span>
            </label>
          )
        })}
      </Card>

      <button
        onClick={create}
        disabled={!cfg || busy}
        className="h-14 w-full rounded-2xl bg-ink text-base font-bold text-cream transition active:scale-[0.98] disabled:opacity-30"
      >
        {cfg ? 'Crear el plan de MEROE' : 'Pon el precio para continuar'}
      </button>
    </div>
  )
}
