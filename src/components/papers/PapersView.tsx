import { useEffect, useRef, useState } from 'react'
import { loadBlob, millis, num, oneOf, removeItem, saveBlob, saveItem, str, useList } from '../../hooks/useList'
import { useLayer } from '../../hooks/useLayer'
import { useSheetState } from '../../hooks/useSheetState'
import { daysTo, expiryLevel, expiryText, warrantyEnd, ymdOf, type ExpiryLevel } from '../../lib/due'
import { compressImage } from '../../lib/image'
import type { AssignMode, PersonId } from '../../lib/types'
import { Avatar } from '../Avatar'
import { BottomSheet } from '../BottomSheet'
import { CloseIcon, PlusIcon, TrashIcon } from '../Icons'

export type PaperKind = 'garantia' | 'documento' | 'seguro' | 'coche' | 'contrato' | 'otro'
export const PAPER_KINDS: Record<PaperKind, { label: string; plural: string; emoji: string }> = {
  garantia: { label: 'Garantía', plural: 'Garantías', emoji: '🧾' },
  documento: { label: 'Documento', plural: 'Documentos', emoji: '🪪' },
  seguro: { label: 'Seguro', plural: 'Seguros', emoji: '🛡️' },
  coche: { label: 'Coche', plural: 'Coche', emoji: '🚗' },
  contrato: { label: 'Contrato', plural: 'Contratos', emoji: '📄' },
  otro: { label: 'Otro', plural: 'Otros', emoji: '📎' },
}
const KIND_ORDER = Object.keys(PAPER_KINDS) as PaperKind[]

export interface Paper {
  id: string
  kind: PaperKind
  title: string
  owner: AssignMode
  /** Fecha de compra (garantías). */
  bought: string | null
  /** Caduca / vence (yyyy-mm-dd). */
  expires: string | null
  store: string
  price: number | null
  /** Número de póliza, de documento… */
  ref: string
  notes: string
  hasPhoto: boolean
  createdAt: number
}

const parse = (id: string, x: Record<string, any>): Paper => ({
  id,
  kind: oneOf<PaperKind>(x.kind, KIND_ORDER, 'otro'),
  title: str(x.title),
  owner: oneOf<AssignMode>(x.owner, ['nita', 'kitos', 'both'], 'both'),
  bought: str(x.bought) || null,
  expires: str(x.expires) || null,
  store: str(x.store),
  price: num(x.price),
  ref: str(x.ref),
  notes: str(x.notes),
  hasPhoto: x.hasPhoto === true,
  createdAt: millis(x.createdAt),
})
export const usePapers = () => useList('papers', parse)

export type PaperDraft = Omit<Paper, 'id' | 'createdAt'> & { id?: string }
export const emptyPaper = (o: Partial<PaperDraft> = {}): PaperDraft => ({ kind: 'garantia', title: '', owner: 'both', bought: null, expires: null, store: '', price: null, ref: '', notes: '', hasPhoto: false, ...o })

const TEMPLATES: (Partial<PaperDraft> & { title: string })[] = [
  { kind: 'documento', title: 'DNI', owner: 'nita' },
  { kind: 'documento', title: 'DNI', owner: 'kitos' },
  { kind: 'documento', title: 'Pasaporte', owner: 'nita' },
  { kind: 'documento', title: 'Pasaporte', owner: 'kitos' },
  { kind: 'documento', title: 'Carnet de conducir', owner: 'both' },
  { kind: 'documento', title: 'Tarjeta sanitaria', owner: 'both' },
  { kind: 'seguro', title: 'Seguro de hogar' },
  { kind: 'seguro', title: 'Seguro de salud' },
  { kind: 'coche', title: 'ITV' },
  { kind: 'coche', title: 'Seguro del coche' },
]

const LEVEL_STYLE: Record<ExpiryLevel, string> = { none: 'text-muted', ok: 'text-muted', soon: 'text-amber-700', urgent: 'text-rose-600 font-bold', expired: 'text-rose-600 font-bold' }
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const parseYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const eur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, useGrouping: 'always' } as Intl.NumberFormatOptions)
export const paperDays = (p: Pick<Paper, 'expires'>, today = new Date()) => (p.expires ? daysTo(p.expires, today) : null)

/** Garantías, documentos, seguros… con su foto y aviso antes de que caduquen. `only` limita a unos tipos (p. ej. el coche). */
export function PapersView({ me, onError, only }: { me: PersonId; onError: (m: string) => void; only?: PaperKind[] }) {
  const { items, loading } = usePapers()
  const [kind, setKind] = useState<PaperKind | 'all'>('all')
  const [sheet, openSheet, closeSheet] = useSheetState<PaperDraft>()
  const mine = items.filter((p) => !only || only.includes(p.kind))
  const shown = mine.filter((p) => kind === 'all' || p.kind === kind)
  const soon = shown.filter((p) => ['soon', 'urgent', 'expired'].includes(expiryLevel(paperDays(p)))).sort((a, b) => (a.expires ?? '').localeCompare(b.expires ?? ''))
  const rest = shown.filter((p) => !soon.includes(p))
  const kinds = KIND_ORDER.filter((k) => mine.some((p) => p.kind === k))
  const templates = TEMPLATES.filter((t) => (!only || only.includes(t.kind!)) && !items.some((p) => p.title === t.title && p.owner === (t.owner ?? 'both')))

  return (
    <div className="space-y-4">
      {!only && kinds.length > 1 && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {(['all', ...kinds] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${kind === k ? 'bg-ink text-cream' : 'bg-surface shadow-sm'}`}>
              {k === 'all' ? 'Todo' : `${PAPER_KINDS[k].emoji} ${PAPER_KINDS[k].plural}`}
            </button>
          ))}
        </div>
      )}

      {soon.length > 0 && (
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-rose-600">⚠️ Caducan pronto</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
            {soon.map((p) => (
              <PaperRow key={p.id} p={p} onOpen={() => openSheet(p)} />
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-3xl bg-surface/70" />
      ) : (
        KIND_ORDER.filter((k) => rest.some((p) => p.kind === k)).map((k) => (
          <section key={k} className="space-y-2">
            <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">
              {PAPER_KINDS[k].emoji} {PAPER_KINDS[k].plural}
            </h2>
            <ul className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-surface shadow-[0_4px_16px_-6px_rgba(42,34,51,0.08)]">
              {rest
                .filter((p) => p.kind === k)
                .sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999') || a.title.localeCompare(b.title, 'es'))
                .map((p) => (
                  <PaperRow key={p.id} p={p} onOpen={() => openSheet(p)} />
                ))}
            </ul>
          </section>
        ))
      )}

      {!loading && mine.length === 0 && (
        <p className="rounded-3xl bg-surface/70 p-5 text-center text-sm text-muted">Haz una foto a los tickets de lo que compréis (electrodomésticos, muebles…) y apunta cuándo caducan el DNI, el pasaporte o los seguros. Os aviso antes de que venzan.</p>
      )}

      <button onClick={() => openSheet(emptyPaper({ kind: only?.[0] ?? (kind === 'all' ? 'garantia' : kind) }))} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 font-bold text-cream active:scale-[0.99]">
        <PlusIcon className="size-4" /> Añadir
      </button>

      {templates.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-xs font-semibold text-muted">Rápido:</p>
          <div className="flex flex-wrap gap-1.5">
            {templates.map((t) => (
              <button key={`${t.title}-${t.owner}`} onClick={() => openSheet(emptyPaper(t))} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm active:scale-95">
                {PAPER_KINDS[t.kind!].emoji} {t.title}
                {t.owner && t.owner !== 'both' && ` de ${t.owner === 'nita' ? 'Nita' : 'Kitos'}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet && <PaperSheet draft={sheet} me={me} onClose={closeSheet} onError={onError} />}
    </div>
  )
}

function PaperRow({ p, onOpen }: { p: Paper; onOpen: () => void }) {
  const days = paperDays(p)
  const level = expiryLevel(days)
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-stone-50">
        <span className="text-2xl" aria-hidden>
          {PAPER_KINDS[p.kind].emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-bold">
            <span className="truncate">{p.title}</span>
            {p.hasPhoto && <span className="text-xs" aria-label="Con foto">📷</span>}
          </span>
          <span className={`block truncate text-xs ${LEVEL_STYLE[level]}`}>
            {days !== null ? expiryText(days, p.kind === 'garantia' ? ['Garantía: acaba', 'Garantía: acabó'] : p.kind === 'seguro' || p.kind === 'contrato' ? ['Vence', 'Venció'] : ['Caduca', 'Caducó']) : p.store || 'Sin fecha de caducidad'}
            {p.expires && ` · ${dateFmt.format(parseYmd(p.expires))}`}
          </span>
        </span>
        {p.owner !== 'both' && <Avatar mode={p.owner} size="xs" />}
      </button>
    </li>
  )
}

const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'

function PaperSheet({ draft, me, onClose, onError }: { draft: PaperDraft; me: PersonId; onClose: () => void; onError: (m: string) => void }) {
  const [d, setD] = useState(draft)
  const [photo, setPhoto] = useState<string | null | undefined>(undefined) // undefined = sin cambios
  const [current, setCurrent] = useState<string | null>(null)
  const [viewing, setViewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [years, setYears] = useState(3)
  const file = useRef<HTMLInputElement>(null)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(draft) || photo !== undefined
  const set = (o: Partial<PaperDraft>) => setD((x) => ({ ...x, ...o }))
  const shown = photo === undefined ? current : photo

  useEffect(() => {
    if (draft.id && draft.hasPhoto)
      loadBlob('paperPhotos', draft.id)
        .then(setCurrent)
        .catch(() => {})
  }, [draft.id, draft.hasPhoto])

  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try {
      let img = await compressImage(f, 1600)
      if (img.dataUrl.length > 900_000) img = await compressImage(f, 1000)
      setPhoto(img.dataUrl)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const save = () => {
    if (!d.title.trim()) return
    const hasPhoto = photo === undefined ? d.hasPhoto : photo !== null
    const id = saveItem('papers', { ...d, title: d.title.trim(), store: d.store.trim(), ref: d.ref.trim(), notes: d.notes.trim(), hasPhoto }, me, onError)
    if (photo !== undefined) saveBlob('paperPhotos', id, photo, onError)
    onClose()
  }
  const setBought = (bought: string | null) => set({ bought, ...(bought && d.kind === 'garantia' ? { expires: warrantyEnd(bought, years) } : {}) })

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEdit ? `${PAPER_KINDS[d.kind].emoji} ${d.title}` : 'Nuevo'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!d.title.trim() || busy} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="radiogroup" aria-label="Tipo">
          {KIND_ORDER.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={d.kind === k} onClick={() => set({ kind: k })} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${d.kind === k ? 'bg-ink text-cream' : 'bg-stone-100'}`}>
              {PAPER_KINDS[k].emoji} {PAPER_KINDS[k].label}
            </button>
          ))}
        </div>
        <input autoFocus={!isEdit && !d.title} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder={d.kind === 'garantia' ? 'Lavadora, sofá, móvil…' : 'Nombre'} aria-label="Nombre" maxLength={80} className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both" style={{ fontSize: 20 }} />

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1" role="radiogroup" aria-label="De quién">
          {(['nita', 'kitos', 'both'] as AssignMode[]).map((o) => (
            <button key={o} type="button" role="radio" aria-checked={d.owner === o} onClick={() => set({ owner: o })} className={`flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold ${d.owner === o ? 'bg-surface shadow-sm' : 'text-muted'}`}>
              <Avatar mode={o} size="xs" /> {o === 'both' ? 'De los dos' : o === 'nita' ? 'Nita' : 'Kitos'}
            </button>
          ))}
        </div>

        {/* Foto */}
        <div>
          {shown ? (
            <div className="relative">
              <button type="button" onClick={() => setViewing(true)} className="block w-full">
                <img src={shown} alt="Foto" className="max-h-48 w-full rounded-2xl bg-stone-100 object-contain" />
              </button>
              <button type="button" onClick={() => setPhoto(null)} aria-label="Quitar foto" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/60 text-white">
                <CloseIcon className="size-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => file.current?.click()} disabled={busy} className="w-full rounded-2xl border-2 border-dashed border-stone-200 py-4 text-sm font-bold text-muted">
              {busy ? 'Preparando la foto…' : d.kind === 'garantia' ? '📷 Foto del ticket o la factura' : '📷 Foto (opcional)'}
            </button>
          )}
          <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        {d.kind === 'garantia' && (
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="text-xs font-semibold text-muted">
              Comprado el
              <input type="date" value={d.bought ?? ''} max={ymdOf(new Date())} onChange={(e) => setBought(e.target.value || null)} aria-label="Fecha de compra" className={input} />
            </label>
            <label className="text-xs font-semibold text-muted">
              Años de garantía
              <select
                value={years}
                onChange={(e) => {
                  const y = Number(e.target.value)
                  setYears(y)
                  if (d.bought) set({ expires: warrantyEnd(d.bought, y) })
                }}
                aria-label="Años de garantía"
                className={`${input} w-24`}
              >
                {[1, 2, 3, 5, 10].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label className="block text-xs font-semibold text-muted">
          {d.kind === 'garantia' ? 'Garantía hasta' : d.kind === 'seguro' || d.kind === 'contrato' ? 'Vence / se renueva' : 'Caduca'}
          <input type="date" value={d.expires ?? ''} onChange={(e) => set({ expires: e.target.value || null })} aria-label="Caduca" className={input} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <input value={d.store} onChange={(e) => set({ store: e.target.value })} placeholder={d.kind === 'garantia' ? 'Tienda' : d.kind === 'seguro' ? 'Compañía' : 'Dónde se renueva'} aria-label="Tienda o compañía" maxLength={60} className={input} />
          <input value={d.price ?? ''} onChange={(e) => set({ price: e.target.value ? Number(e.target.value.replace(',', '.')) || null : null })} inputMode="decimal" placeholder="Precio €" aria-label="Precio" className={input} />
        </div>
        <input value={d.ref} onChange={(e) => set({ ref: e.target.value })} placeholder={d.kind === 'seguro' ? 'Nº de póliza' : d.kind === 'garantia' ? 'Nº de serie o de pedido' : 'Número (opcional)'} aria-label="Número" maxLength={60} className={input} />
        <textarea value={d.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} placeholder="Notas: teléfono de asistencia, dónde está guardado el original…" aria-label="Notas" className="w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both" />
        {d.price !== null && <p className="-mt-3 text-xs text-muted">{eur(d.price)}</p>}

        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{draft.title}» y su foto?</p>
              <button
                onClick={() => {
                  removeItem('papers', draft.id!).catch((e: Error) => onError(e.message))
                  if (draft.hasPhoto) saveBlob('paperPhotos', draft.id!, null, onError)
                  onClose()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar
            </button>
          ))}
      </div>
      {viewing && shown && <PhotoView src={shown} onClose={() => setViewing(false)} />}
    </BottomSheet>
  )
}

/** Foto a pantalla completa (se puede ampliar con los dedos). */
export function PhotoView({ src, onClose }: { src: string; onClose: () => void }) {
  const close = useLayer('photo', onClose)
  return (
    <div className="fixed inset-0 z-[60] overflow-auto bg-black" role="dialog" aria-label="Foto">
      <button onClick={close} aria-label="Cerrar" className="pt-safe fixed right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/20 text-white">
        <CloseIcon className="size-5" />
      </button>
      <img src={src} alt="" className="min-h-full w-full object-contain" />
    </div>
  )
}
