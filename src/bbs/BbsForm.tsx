// Apuntar en segundos (título y enlace) y la ficha completa de un plan o sitio de bbs.
import { useState, type FocusEvent, type ReactNode } from 'react'
import { BBS_KINDS, BBS_KIND_IDS, BBS_NAMES, BBS_PEOPLE, BBS_RATINGS, cleanLink, dateText, guessKind, linkLabel, ymdOf, type BbsItem, type BbsPerson, type BbsRating } from '../lib/bbs.ts'
import { BottomSheet } from '../components/BottomSheet'
import { PlaceField } from '../components/PlaceField'
import { BBS_COLORS, nameFor } from './people'
import { addBbsItem, emptyDraft, markDone, removeBbsItem, setHeart, setRating, setStatus, updateBbsItem, type BbsDraft } from './useBbs'
import { Hearts } from './Hearts'

const URL_RE = /https?:\/\/[^\s<>"']+/i
type DateMode = 'none' | 'day' | 'range' | 'until'
const modeOf = (d: Pick<BbsDraft, 'from' | 'to'>): DateMode => (d.from && d.to ? (d.from === d.to ? 'day' : 'range') : d.to ? 'until' : 'none')

/** Que el teclado de Android no tape el campo: llevarlo al centro cuando se abre el teclado. */
const keepVisible = (e: FocusEvent<HTMLElement>) => {
  const el = e.currentTarget
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
}

const input = 'h-12 w-full rounded-2xl border border-stone-200 bg-surface px-4 text-ink outline-none focus:border-bbs'

export function BbsForm({ item, draft: initial, me, onClose, onError }: { item: BbsItem | null; draft?: Partial<BbsDraft>; me: BbsPerson; onClose: () => void; onError: (m: string) => void }) {
  const start: BbsDraft = item
    ? { title: item.title, link: item.link, kind: item.kind, place: item.place, price: item.price, setting: item.setting, booking: item.booking, note: item.note, from: item.from, to: item.to }
    : { ...emptyDraft(), ...initial }
  const [d, setD] = useState<BbsDraft>(start)
  const [kindTouched, setKindTouched] = useState(!!item || (!!initial?.kind && initial.kind !== 'otro'))
  const [more, setMore] = useState(!!item || !!initial?.place)
  const [dateMode, setDateMode] = useState<DateMode>(modeOf(start))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<BbsDraft>) => setD((x) => ({ ...x, ...patch }))
  const dirty = JSON.stringify(d) !== JSON.stringify(start)
  const valid = d.title.trim().length > 0

  // Si se pega un enlace en el título (lo normal al copiar de Instagram), se mueve a su sitio.
  const onTitle = (v: string) => {
    const url = v.match(URL_RE)?.[0]
    if (url && !d.link) {
      const rest = v.replace(url, '').trim()
      set({ title: rest, link: cleanLink(url) })
    } else set({ title: v })
  }

  const save = () => {
    if (!valid) return
    const final: BbsDraft = { ...d, title: d.title.trim(), link: cleanLink(d.link), kind: kindTouched ? d.kind : guessKind(`${d.title} ${d.note} ${d.place?.name ?? ''}`, d.link) }
    if (item) updateBbsItem(item.id, final, me, onError)
    else addBbsItem(final, me, onError)
    onClose()
  }

  const setMode = (m: DateMode) => {
    setDateMode(m)
    const today = ymdOf(new Date())
    if (m === 'none') set({ from: null, to: null })
    if (m === 'day') set({ from: d.from ?? d.to ?? today, to: d.from ?? d.to ?? today })
    if (m === 'range') set({ from: d.from ?? today, to: d.to && d.to !== d.from ? d.to : null })
    if (m === 'until') set({ from: null, to: d.to ?? null })
  }

  const k = BBS_KINDS[d.kind]
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={item ? `${k.emoji} ${item.title}` : 'Apuntar'}
      footer={
        (!item || dirty) && (
          <button onClick={save} disabled={!valid} className="h-13 w-full rounded-2xl bg-bbs font-extrabold text-white transition active:scale-[0.99] disabled:opacity-40">
            {item ? 'Guardar cambios' : 'Apuntar'}
          </button>
        )
      }
    >
      <div className="space-y-4">
        {item && <ItemHeader item={item} me={me} onError={onError} onClose={onClose} />}

        <label className="block">
          <span className="text-xs font-bold text-muted">Qué es</span>
          <input
            value={d.title}
            onChange={(e) => onTitle(e.target.value)}
            onFocus={keepVisible}
            autoFocus={!item && !d.title}
            enterKeyHint="next"
            maxLength={120}
            placeholder="Ramen en Lavapiés, expo de Sorolla…"
            aria-label="Qué es"
            className={`mt-1 ${input} text-lg font-bold`}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-muted">Enlace (Instagram, TikTok, Maps, web…)</span>
          <input
            value={d.link}
            onChange={(e) => set({ link: e.target.value })}
            onFocus={keepVisible}
            inputMode="url"
            enterKeyHint="done"
            onKeyDown={(e) => e.key === 'Enter' && !more && save()}
            placeholder="https://…"
            aria-label="Enlace"
            className={`mt-1 ${input}`}
          />
        </label>
        {d.link && /^https?:\/\//i.test(d.link) && (
          <a href={d.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-bbs-ink">
            Abrir en {linkLabel(d.link) || 'la web'} ↗
          </a>
        )}

        {!more ? (
          <button onClick={() => setMore(true)} className="w-full rounded-2xl bg-stone-50 py-3 text-sm font-bold text-muted">
            ＋ Más detalles (dónde, precio, fechas…) · opcional
          </button>
        ) : (
          <>
            <Field label="Tipo">
              <div className="flex flex-wrap gap-2">
                {BBS_KIND_IDS.map((id) => (
                  <Pill
                    key={id}
                    on={d.kind === id}
                    onClick={() => {
                      setKindTouched(true)
                      set({ kind: id })
                    }}
                  >
                    {BBS_KINDS[id].emoji} {BBS_KINDS[id].label}
                  </Pill>
                ))}
              </div>
            </Field>
            <Field label="Dónde">
              <PlaceField value={d.place} onChange={(place) => set({ place })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((p) => (
                    <Pill key={p} on={d.price === p} onClick={() => set({ price: (d.price === p ? 0 : p) as BbsDraft['price'] })} grow>
                      {'€'.repeat(p)}
                    </Pill>
                  ))}
                </div>
              </Field>
              <Field label="¿Hay que reservar?">
                <div className="flex gap-1.5">
                  <Pill on={d.booking} onClick={() => set({ booking: true })} grow>
                    Sí
                  </Pill>
                  <Pill on={!d.booking} onClick={() => set({ booking: false })} grow>
                    No
                  </Pill>
                </div>
              </Field>
            </div>
            <Field label="Interior o exterior (para cuando llueve)">
              <div className="flex gap-1.5">
                {(
                  [
                    ['in', '🏠 Interior'],
                    ['out', '🌳 Exterior'],
                    ['both', 'Las dos'],
                  ] as const
                ).map(([id, label]) => (
                  <Pill key={id} on={d.setting === id} onClick={() => set({ setting: d.setting === id ? null : id })} grow>
                    {label}
                  </Pill>
                ))}
              </div>
            </Field>
            <Field label="¿Tiene fecha? (mercadillos, expos que cierran…)">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['none', 'No'],
                    ['day', 'Un día'],
                    ['range', 'Temporada'],
                    ['until', 'Hasta…'],
                  ] as const
                ).map(([id, label]) => (
                  <Pill key={id} on={dateMode === id} onClick={() => setMode(id)}>
                    {label}
                  </Pill>
                ))}
              </div>
              {dateMode !== 'none' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {dateMode === 'range' && <DateInput label="Desde" value={d.from} onChange={(from) => set({ from })} />}
                  {dateMode === 'day' && <DateInput label="El día" value={d.from} onChange={(v) => set({ from: v, to: v })} />}
                  {(dateMode === 'range' || dateMode === 'until') && <DateInput label="Hasta" value={d.to} min={d.from ?? undefined} onChange={(to) => set({ to })} />}
                </div>
              )}
              {dateMode !== 'none' && d.to && <p className="mt-1.5 text-xs text-muted">🔔 {dateMode === 'day' ? 'Os avisaremos una semana y dos días antes.' : 'Os avisaremos una semana antes de que acabe, dos días antes y el último día.'}</p>}
            </Field>
            <Field label="Nota">
              <textarea
                value={d.note}
                onChange={(e) => set({ note: e.target.value })}
                onFocus={keepVisible}
                rows={3}
                maxLength={2000}
                placeholder="Qué pedir, con quién, a qué hora hay menos cola…"
                aria-label="Nota"
                className="w-full rounded-2xl border border-stone-200 bg-surface p-3 text-ink outline-none focus:border-bbs"
              />
            </Field>
          </>
        )}

        {item && (
          <div className="space-y-3 border-t border-stone-100 pt-4">
            <p className="text-xs text-muted">
              Lo apuntó {item.addedBy === me ? 'tú' : BBS_NAMES[item.addedBy]}
              {item.createdMs ? ` el ${new Date(item.createdMs).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}` : ''}
            </p>
            {item.addedBy === me &&
              (confirmDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      removeBbsItem(item.id).catch((e: Error) => onError(e.message))
                      onClose()
                    }}
                    className="h-11 flex-1 rounded-2xl bg-rose-600 text-sm font-bold text-white"
                  >
                    Sí, borrarlo del todo
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-2xl bg-stone-100 text-sm font-bold">
                    No
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="text-sm font-semibold text-rose-600">
                  Borrar
                </button>
              ))}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** Arriba de la ficha: ❤️, estado (hecho / descartar) y "¿qué tal fue?". */
function ItemHeader({ item, me, onError, onClose }: { item: BbsItem; me: BbsPerson; onError: (m: string) => void; onClose: () => void }) {
  const mine = !!item.hearts[me]
  const today = ymdOf(new Date())
  const when = dateText(item)
  return (
    <div className="space-y-3">
      {when && <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">📅 {when}</p>}
      {item.status === 'pending' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHeart(item.id, me, !mine, onError)}
            aria-pressed={mine}
            className={`flex h-12 items-center gap-2 rounded-2xl px-4 font-bold active:scale-95 ${mine ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-ink'}`}
          >
            {mine ? '❤️ Me apetece' : '🤍 ¿Te apetece?'}
          </button>
          <Hearts item={item} me={me} />
        </div>
      )}

      {item.status === 'done' ? (
        <div className="rounded-3xl bg-bbs-soft p-4">
          <p className="font-extrabold text-bbs-ink">
            ✓ Hecho{item.doneAt ? ` el ${new Date(`${item.doneAt}T12:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted">¿Qué tal fue? Cada uno pone lo suyo.</p>
          <ul className="mt-3 space-y-2">
            {BBS_PEOPLE.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className={`w-14 shrink-0 text-sm font-bold ${BBS_COLORS[p].text}`}>{nameFor(p, me)}</span>
                {p === me ? (
                  <span className="flex flex-1 gap-1.5" role="group" aria-label="Tu valoración">
                    {(Object.keys(BBS_RATINGS) as BbsRating[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRating(item.id, me, item.ratings[me] === r ? null : r, onError)}
                        aria-pressed={item.ratings[me] === r}
                        className={`h-10 flex-1 rounded-xl text-sm font-bold transition active:scale-95 ${item.ratings[me] === r ? 'bg-bbs text-white' : 'bg-surface text-ink'}`}
                      >
                        {BBS_RATINGS[r].emoji} {BBS_RATINGS[r].label}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span className="text-sm text-muted">{item.ratings[p] ? `${BBS_RATINGS[item.ratings[p]!].emoji} ${BBS_RATINGS[item.ratings[p]!].label}` : 'Aún no ha dicho nada'}</span>
                )}
              </li>
            ))}
          </ul>
          <button onClick={() => setStatus(item.id, 'pending', me, onError)} className="mt-3 text-xs font-semibold text-muted">
            Volver a pendientes
          </button>
        </div>
      ) : item.status === 'dropped' ? (
        <button onClick={() => setStatus(item.id, 'pending', me, onError)} className="h-12 w-full rounded-2xl bg-stone-100 font-bold">
          ↩︎ Volver a pendientes
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => markDone(item.id, today, me, onError)} className="h-12 flex-1 rounded-2xl bg-bbs font-extrabold text-white active:scale-[0.99]">
            ✓ ¡Lo hemos hecho!
          </button>
          <button
            onClick={() => {
              setStatus(item.id, 'dropped', me, onError)
              onClose()
            }}
            className="h-12 rounded-2xl bg-stone-100 px-4 text-sm font-bold text-muted"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-muted">{label}</p>
      {children}
    </div>
  )
}

function Pill({ on, onClick, children, grow }: { on: boolean; onClick: () => void; children: ReactNode; grow?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`h-10 rounded-xl px-3 text-sm font-bold transition active:scale-95 ${grow ? 'flex-1' : ''} ${on ? 'bg-bbs text-white' : 'bg-stone-100 text-ink'}`}>
      {children}
    </button>
  )
}

function DateInput({ label, value, min, onChange }: { label: string; value: string | null; min?: string; onChange: (v: string | null) => void }) {
  return (
    <label className="text-xs font-semibold text-muted">
      {label}
      <input type="date" value={value ?? ''} min={min} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className={`mt-1 ${input} px-3`} />
    </label>
  )
}
