import { useEffect, useMemo, useState } from 'react'
import type { EuriborData } from '../../hooks/useHome'
import { eur, formatMonth, handover, type HomeConfig, type HomeItem, type MortgageConfig } from '../../lib/home'
import { simulate, variableRate } from '../../lib/mortgage'
import { refreshEuribor, saveHomeConfig } from '../../services/home'
import { LineChart } from './Charts'
import { Card, Label, NumberField, Segmented, SectionTitle } from './ui'

const pctFmt = (v: number) => `${v.toLocaleString('es-ES', { maximumFractionDigits: 3 })} %`
const shortMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

export function MortgageView({
  config,
  items,
  euribor,
  money,
  onError,
}: {
  config: HomeConfig
  items: HomeItem[]
  euribor: EuriborData | null
  money: (v: number) => string
  onError: (m: string) => void
}) {
  const [m, setM] = useState<MortgageConfig>(config.mortgage)
  const [refreshing, setRefreshing] = useState(false)

  // Guardar los cambios (compartidos con la pareja) poco después de dejar de tocar.
  useEffect(() => {
    if (JSON.stringify(m) === JSON.stringify(config.mortgage)) return
    const t = setTimeout(() => saveHomeConfig({ mortgage: m }).catch((e: Error) => onError(e.message)), 600)
    return () => clearTimeout(t)
  }, [m, config.mortgage, onError])

  const set = <K extends keyof MortgageConfig>(k: K, v: MortgageConfig[K]) => setM((x) => ({ ...x, [k]: v }))
  const effectiveEuribor = m.manualEuribor ?? euribor?.value ?? null
  const principal = Math.min(handover(items, config, new Date()).remaining, config.basePrice * m.pct)
  const needsEuribor = m.type !== 'fixed'
  const result = useMemo(() => simulate(principal, m, effectiveEuribor ?? 0), [principal, m, effectiveEuribor])

  const scenarios = needsEuribor && effectiveEuribor !== null ? [-1, 0, 1].map((d) => ({ d, r: simulate(principal, m, effectiveEuribor + d) })) : []

  const doRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshEuribor()
    } catch (e) {
      onError(`No se pudo actualizar el Euríbor: ${(e as Error).message}`)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Resultado */}
      <div className="rounded-[28px] bg-gradient-to-br from-sky-500 to-indigo-600 p-5 text-white shadow-lg shadow-indigo-300/40">
        <p className="text-xs font-bold uppercase tracking-wider opacity-80">Cuota estimada</p>
        <p className="tabular mt-1 text-4xl font-extrabold tracking-tight">
          {money(result.payment)}
          <span className="text-lg font-bold opacity-80">/mes</span>
        </p>
        <p className="mt-1 text-sm opacity-90">
          {money(principal)} a {m.years} años
          {result.phases.length > 1 && ` · después ${money(result.phases[1].payment)}/mes`}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="text-[11px] font-semibold opacity-80">Intereses en total</p>
            <p className="tabular font-extrabold">{money(result.totalInterest)}</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <p className="text-[11px] font-semibold opacity-80">Pagaréis en total</p>
            <p className="tabular font-extrabold">{money(result.totalPaid)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] opacity-75">
          Estimación{needsEuribor ? ', suponiendo que el Euríbor se queda como está' : ''}. La hipoteca se firma en {formatMonth(config.handover)}.
        </p>
      </div>

      {/* Condiciones */}
      <Card className="space-y-4">
        <h3 className="font-extrabold">Condiciones</h3>
        <Segmented
          label="Tipo de hipoteca"
          value={m.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'fixed', label: 'Fija' },
            { value: 'variable', label: 'Variable' },
            { value: 'mixed', label: 'Mixta' },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Financiación</Label>
            <NumberField value={Math.round(m.pct * 100)} onChange={(v) => v !== null && set('pct', Math.min(100, Math.max(0, v)) / 100)} suffix="%" label="Porcentaje financiado" />
          </div>
          <div>
            <Label>Plazo</Label>
            <NumberField value={m.years} onChange={(v) => v && set('years', Math.min(40, Math.max(1, Math.round(v))))} suffix="años" label="Plazo en años" />
          </div>
          {m.type !== 'variable' && (
            <div>
              <Label>Interés fijo (TIN)</Label>
              <NumberField value={m.fixedRate} onChange={(v) => v !== null && set('fixedRate', v)} suffix="%" label="Interés fijo" />
            </div>
          )}
          {m.type !== 'fixed' && (
            <div>
              <Label>Diferencial</Label>
              <NumberField value={m.spread} onChange={(v) => v !== null && set('spread', v)} suffix="%" label="Diferencial sobre el Euríbor" />
            </div>
          )}
          {m.type === 'mixed' && (
            <div>
              <Label>Años a tipo fijo</Label>
              <NumberField value={m.mixedYears} onChange={(v) => v && set('mixedYears', Math.max(1, Math.round(v)))} suffix="años" label="Años a tipo fijo" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted">
          {m.type === 'fixed'
            ? 'Fija: la cuota no cambia nunca.'
            : m.type === 'variable'
              ? `Variable: Euríbor + diferencial = ${effectiveEuribor !== null ? pctFmt(variableRate(effectiveEuribor, m.spread)) : '…'} hoy. Se revisa cada año.`
              : `Mixta: ${m.mixedYears} años al ${pctFmt(m.fixedRate)} y luego Euríbor + ${pctFmt(m.spread)}.`}
        </p>
      </Card>

      {/* Euríbor */}
      {needsEuribor && (
        <section>
          <SectionTitle
            right={
              <button onClick={doRefresh} disabled={refreshing} className="text-xs font-bold text-both disabled:opacity-50">
                {refreshing ? 'Actualizando…' : 'Actualizar'}
              </button>
            }
          >
            Euríbor a 12 meses
          </SectionTitle>
          <Card className="space-y-3">
            {euribor ? (
              <>
                <p>
                  <span className="tabular text-2xl font-extrabold">{pctFmt(euribor.value)}</span>
                  <span className="ml-2 text-xs text-muted">media de {formatMonth(euribor.month)} · fuente: BCE</span>
                </p>
                {euribor.history.length > 2 && (
                  <LineChart
                    title="Evolución del Euríbor a 12 meses"
                    points={euribor.history.slice(-36).map((h) => ({ x: h.month, y: h.value }))}
                    color="#4a3aa7"
                    formatY={pctFmt}
                    formatX={shortMonth}
                    zeroBased={false}
                    height={120}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Todavía no hay dato automático. Pulsa «Actualizar» o escribe uno a mano.</p>
            )}
            <div>
              <Label>Usar otro valor (opcional)</Label>
              <NumberField value={m.manualEuribor} onChange={(v) => set('manualEuribor', v)} suffix="%" label="Euríbor manual" placeholder={euribor ? `Automático: ${pctFmt(euribor.value)}` : 'Ej. 2,2'} />
            </div>
          </Card>
        </section>
      )}

      {/* Escenarios */}
      {scenarios.length > 0 && (
        <section>
          <SectionTitle>¿Y si cambia el Euríbor?</SectionTitle>
          <Card className="grid grid-cols-3 gap-2 text-center">
            {scenarios.map(({ d, r }) => (
              <div key={d} className={`rounded-2xl p-2.5 ${d === 0 ? 'bg-indigo-50' : 'bg-stone-50'}`}>
                <p className="text-[11px] font-bold text-muted">{d === 0 ? 'Como hoy' : d > 0 ? '+1 punto' : '−1 punto'}</p>
                <p className="tabular text-sm font-extrabold">{money(r.phases[r.phases.length - 1].payment)}</p>
                <p className="text-[10px] text-muted">/mes</p>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* Capital pendiente */}
      <section>
        <SectionTitle>Lo que queda por pagar al banco</SectionTitle>
        <Card>
          <LineChart
            title="Capital pendiente de la hipoteca por año"
            points={[{ x: '0', y: principal }, ...result.balanceByYear.map((b, i) => ({ x: String(i + 1), y: b }))]}
            color="#2a78d6"
            formatY={(v) => eur(v)}
            formatX={(x) => (x === '0' ? 'Firma' : `Año ${x}`)}
          />
        </Card>
      </section>
    </div>
  )
}
