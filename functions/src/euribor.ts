// Euríbor a 12 meses (media mensual) del Banco Central Europeo, vía su API pública de datos.
// Serie: FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA (Euribor 1-year, average of observations through period).

export const ECB_EURIBOR_URL =
  'https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?format=csvdata&lastNObservations=60'

/** Separa una línea CSV respetando comillas ("a, b" es un solo campo). */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export interface RatePoint {
  /** yyyy-mm */
  month: string
  /** % (2.15 = 2,15 %) */
  value: number
}

/** Lee el CSV del BCE y devuelve los valores ordenados por mes. */
export function parseEcbCsv(csv: string): RatePoint[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toUpperCase())
  const iTime = header.indexOf('TIME_PERIOD')
  const iValue = header.indexOf('OBS_VALUE')
  if (iTime < 0 || iValue < 0) throw new Error('Formato del BCE inesperado (faltan TIME_PERIOD/OBS_VALUE)')
  return lines
    .slice(1)
    .map((l) => splitCsvLine(l))
    .map((f) => ({ month: (f[iTime] ?? '').trim().slice(0, 7), raw: (f[iValue] ?? '').trim() }))
    // Las celdas vacías son meses sin dato (no 0 %).
    .filter((p) => /^\d{4}-\d{2}$/.test(p.month) && p.raw !== '' && Number.isFinite(Number(p.raw)))
    .map((p) => ({ month: p.month, value: Number(p.raw) }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
