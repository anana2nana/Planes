import { useState, type ReactNode } from 'react'
import { deleteRecipe, saveRecipe, type RecipeDraft } from '../../hooks/useMenu'
import { useLayer } from '../../hooks/useLayer'
import { splitRecipeText, sourceOf } from '../../lib/menu'
import { emptyStep, splitQty, type Phase, type Step, type Tip } from '../../lib/recipe'
import type { PersonId } from '../../lib/types'
import { BottomSheet } from '../BottomSheet'
import { ChevronIcon, PlusIcon, TrashIcon } from '../Icons'

const EMOJIS = ['🍲', '🥘', '🍝', '🍛', '🥗', '🍗', '🐟', '🥩', '🍳', '🌮', '🍕', '🥪', '🍜', '🫘', '🥔', '🍰']
const input = 'h-11 w-full rounded-xl border border-stone-200 bg-surface px-3 font-semibold outline-none focus:border-both'
const area = 'w-full resize-none rounded-xl border border-stone-200 bg-surface px-3 py-2 outline-none focus:border-both'

export const emptyRecipe = (o: Partial<RecipeDraft> = {}): RecipeDraft => ({
  title: '',
  emoji: '🍲',
  url: '',
  ingredients: [],
  steps: '',
  servings: null,
  notes: '',
  description: '',
  tags: [],
  groups: [],
  gear: [],
  gearNote: '',
  phases: [],
  tips: [],
  credit: '',
  ...o,
})

/** En el editor, los ingredientes de cada grupo se escriben como líneas ("300 g harina"). */
interface GroupDraft {
  name: string
  note: string
  text: string
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function toEditable(r: RecipeDraft) {
  // Las recetas sencillas antiguas (solo texto) pasan a un grupo y una fase sin nombre.
  const groups: GroupDraft[] = r.groups.length
    ? r.groups.map((g) => ({ name: g.name, note: g.note, text: g.items.map((i) => [i.q, i.name].filter(Boolean).join(' ')).join('\n') }))
    : [{ name: '', note: '', text: r.ingredients.join('\n') }]
  const phases: Phase[] = r.phases.length
    ? r.phases
    : [{ title: '', why: '', steps: lines(r.steps).map((t) => emptyStep({ text: t.replace(/^\d+[.)]\s*/, '') })) }]
  return { groups, phases }
}

function move<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** Editor completo de una receta: datos, grupos de ingredientes, fases y pasos, equipo y consejos. */
export function RecipeEditor({
  draft,
  me,
  onClose,
  onError,
  onSaved,
}: {
  draft: RecipeDraft
  me: PersonId
  onClose: () => void
  onError: (m: string) => void
  onSaved?: (id: string, title: string) => void
}) {
  const close = useLayer('recipeEdit', onClose)
  const initial = useState(() => ({ ...draft, ...toEditable(draft), tagsText: draft.tags.join(', '), gearText: draft.gear.join('\n') }))[0]
  const [d, setD] = useState(initial)
  const [paste, setPaste] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const isEdit = Boolean(draft.id)
  const dirty = JSON.stringify(d) !== JSON.stringify(initial)
  const canSave = d.title.trim() !== ''
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  const setPhase = (i: number, p: Phase) => set('phases', d.phases.map((x, j) => (j === i ? p : x)))
  const setGroup = (i: number, g: GroupDraft) => set('groups', d.groups.map((x, j) => (j === i ? g : x)))

  const save = () => {
    if (!canSave) return
    const groups = d.groups.map((g) => ({ name: g.name.trim(), note: g.note.trim(), items: lines(g.text).map(splitQty) })).filter((g) => g.items.length || g.name)
    const phases = d.phases
      .map((p) => ({
        ...p,
        title: p.title.trim(),
        why: p.why.trim(),
        steps: p.steps
          .filter((s) => s.title.trim() || s.text.trim())
          .map((s) => ({ ...s, title: s.title.trim(), text: s.text.trim(), cue: s.cue.trim(), fix: s.fix.trim(), chips: s.chips.map((c) => c.trim()).filter(Boolean), tech: s.tech.map((t) => t.trim()).filter(Boolean) })),
      }))
      .filter((p) => p.steps.length || p.title)
    const { tagsText, gearText, ...rest } = d
    const out: RecipeDraft = {
      ...rest,
      title: d.title.trim(),
      url: d.url.trim(),
      description: d.description.trim(),
      tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      gear: lines(gearText),
      groups,
      phases,
      tips: d.tips.filter((t) => t.title.trim() || t.text.trim()),
      // Las de texto sencillo se rellenan solas al guardar a partir de grupos y fases.
      ingredients: groups.length ? [] : rest.ingredients,
      steps: phases.length ? '' : rest.steps,
    }
    const id = saveRecipe(out, me, onError)
    onSaved?.(id, out.title)
    close()
  }

  const applyPaste = () => {
    if (!paste) return
    const r = splitRecipeText(paste)
    setD((x) => {
      const groups = [...x.groups]
      if (r.ingredients.length) groups[0] = { ...groups[0], text: [groups[0]?.text.trim(), ...r.ingredients].filter(Boolean).join('\n') }
      const phases = [...x.phases]
      if (r.steps) phases[0] = { ...phases[0], steps: [...phases[0].steps, ...lines(r.steps).map((t) => emptyStep({ text: t.replace(/^\d+[.)]\s*/, '') }))] }
      return { ...x, groups, phases }
    })
    setPaste(null)
  }

  return (
    <BottomSheet
      open
      onClose={close}
      title={isEdit ? `${d.emoji} Editar receta` : 'Nueva receta'}
      footer={
        !isEdit || dirty ? (
          <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
            {isEdit ? 'Guardar cambios' : 'Guardar receta'}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        {/* Datos */}
        <div className="space-y-3">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1" role="radiogroup" aria-label="Icono">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={d.emoji === e}
                onClick={() => set('emoji', e)}
                className={`grid size-10 shrink-0 place-items-center rounded-xl text-xl ${d.emoji === e ? 'bg-both-soft ring-2 ring-both' : 'bg-stone-100'}`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            autoFocus={!isEdit && !d.title}
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Lentejas de la abuela, carbonara…"
            aria-label="Nombre de la receta"
            maxLength={100}
            className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none placeholder:text-stone-300 focus:border-both"
            style={{ fontSize: 20 }}
          />
          <textarea value={d.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Una frase para saber de qué va" aria-label="Descripción" className={area} />
          <div className="flex gap-2">
            <input value={d.url} onChange={(e) => set('url', e.target.value)} type="url" inputMode="url" placeholder="Enlace al vídeo o a la web" aria-label="Enlace de la receta" className={input} />
            {sourceOf(d.url.trim()) && (
              <a href={d.url.trim()} target="_blank" rel="noreferrer" className="grid h-11 shrink-0 place-items-center rounded-xl bg-sky-50 px-3 text-sm font-bold text-sky-700">
                {sourceOf(d.url.trim())!.emoji} Ver
              </a>
            )}
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <label className="relative">
              <input
                value={d.servings ?? ''}
                onChange={(e) => set('servings', e.target.value ? Math.max(1, Math.min(20, Number(e.target.value) || 1)) : null)}
                inputMode="numeric"
                placeholder="—"
                aria-label="Raciones"
                className={`${input} pr-16`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">raciones</span>
            </label>
            <input value={d.tagsText} onChange={(e) => set('tagsText', e.target.value)} placeholder="Etiquetas: 2 h, pasta fresca…" aria-label="Etiquetas" className={input} />
          </div>
        </div>

        {paste === null ? (
          <button type="button" onClick={() => setPaste('')} className="w-full rounded-2xl bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-700">
            📋 Pegar la descripción de un vídeo
            <span className="block text-xs font-medium opacity-80">Separo los ingredientes y los pasos y los añado.</span>
          </button>
        ) : (
          <div className="space-y-2 rounded-2xl bg-violet-50 p-3">
            <textarea autoFocus value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} placeholder="Pega aquí el texto…" aria-label="Texto pegado" className={area} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPaste(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-muted">
                Cancelar
              </button>
              <button type="button" onClick={applyPaste} disabled={!paste.trim()} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                Separar
              </button>
            </div>
          </div>
        )}

        {/* Ingredientes */}
        <Section title="Ingredientes" hint="Uno por línea, con la cantidad delante: «300 g harina»">
          {d.groups.map((g, i) => (
            <Box
              key={i}
              onUp={i > 0 ? () => set('groups', move(d.groups, i, -1)) : undefined}
              onDown={i < d.groups.length - 1 ? () => set('groups', move(d.groups, i, 1)) : undefined}
              onDelete={d.groups.length > 1 ? () => set('groups', d.groups.filter((_, j) => j !== i)) : undefined}
            >
              <input value={g.name} onChange={(e) => setGroup(i, { ...g, name: e.target.value })} placeholder={d.groups.length > 1 ? 'Nombre del grupo (La salsa…)' : 'Grupo (opcional: La masa, La salsa…)'} aria-label={`Grupo ${i + 1}`} className={`${input} h-10 text-sm`} />
              <textarea value={g.text} onChange={(e) => setGroup(i, { ...g, text: e.target.value })} rows={Math.max(4, lines(g.text).length + 1)} placeholder={'300 g harina\n3 huevos\n1 pizca sal'} aria-label={i === 0 ? 'Ingredientes' : `Ingredientes del grupo ${i + 1}`} className={area} />
              <input value={g.note} onChange={(e) => setGroup(i, { ...g, note: e.target.value })} placeholder="Nota (opcional)" aria-label="Nota del grupo" className={`${input} h-10 text-sm font-medium`} />
            </Box>
          ))}
          <AddButton onClick={() => set('groups', [...d.groups, { name: '', note: '', text: '' }])}>Grupo de ingredientes</AddButton>
        </Section>

        <Section title="Antes de empezar" hint="Utensilios, uno por línea (opcional)">
          <textarea value={d.gearText} onChange={(e) => set('gearText', e.target.value)} rows={3} placeholder={'Báscula\nAmasadora'} aria-label="Utensilios" className={area} />
          <input value={d.gearNote} onChange={(e) => set('gearNote', e.target.value)} placeholder="Nota: saca los huevos 30 min antes…" aria-label="Nota de antes de empezar" className={`${input} h-10 text-sm font-medium`} />
        </Section>

        {/* Pasos */}
        <Section title="Paso a paso" hint="Agrupa los pasos en fases si quieres (La masa, La salsa…)">
          {d.phases.map((p, i) => (
            <Box
              key={i}
              onUp={i > 0 ? () => set('phases', move(d.phases, i, -1)) : undefined}
              onDown={i < d.phases.length - 1 ? () => set('phases', move(d.phases, i, 1)) : undefined}
              onDelete={d.phases.length > 1 ? () => set('phases', d.phases.filter((_, j) => j !== i)) : undefined}
            >
              <input value={p.title} onChange={(e) => setPhase(i, { ...p, title: e.target.value })} placeholder="Fase (opcional: La masa…)" aria-label={`Fase ${i + 1}`} className={`${input} h-10 text-sm`} />
              <input value={p.why} onChange={(e) => setPhase(i, { ...p, why: e.target.value })} placeholder="Qué buscas en esta fase (opcional)" aria-label="Objetivo de la fase" className={`${input} h-10 text-sm font-medium`} />
              <div className="space-y-2">
                {p.steps.map((s, k) => (
                  <StepEditor
                    key={k}
                    n={k + 1}
                    step={s}
                    onChange={(st) => setPhase(i, { ...p, steps: p.steps.map((x, j) => (j === k ? st : x)) })}
                    onUp={k > 0 ? () => setPhase(i, { ...p, steps: move(p.steps, k, -1) }) : undefined}
                    onDown={k < p.steps.length - 1 ? () => setPhase(i, { ...p, steps: move(p.steps, k, 1) }) : undefined}
                    onDelete={() => setPhase(i, { ...p, steps: p.steps.filter((_, j) => j !== k) })}
                  />
                ))}
              </div>
              <AddButton onClick={() => setPhase(i, { ...p, steps: [...p.steps, emptyStep()] })}>Paso</AddButton>
            </Box>
          ))}
          <AddButton onClick={() => set('phases', [...d.phases, { title: '', why: '', steps: [emptyStep()] }])}>Fase</AddButton>
        </Section>

        {/* Consejos */}
        <Section title="Claves y qué hacer si falla" hint="Opcional">
          {d.tips.map((t, i) => (
            <Box key={i} onDelete={() => set('tips', d.tips.filter((_, j) => j !== i))}>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set('tips', d.tips.map((x, j) => (j === i ? { ...x, kind: x.kind === 'good' ? 'warn' : 'good' } : x)))}
                  aria-label={t.kind === 'good' ? 'Clave (tocar para cambiar a problema)' : 'Problema (tocar para cambiar a clave)'}
                  className={`h-10 shrink-0 rounded-xl px-3 text-sm font-bold ${t.kind === 'good' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                >
                  {t.kind === 'good' ? '✅ Clave' : '⚠️ Si falla'}
                </button>
                <input value={t.title} onChange={(e) => set('tips', d.tips.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Título" aria-label="Título del consejo" className={`${input} h-10 text-sm`} />
              </div>
              <textarea value={t.text} onChange={(e) => set('tips', d.tips.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} rows={2} aria-label="Consejo" className={area} />
            </Box>
          ))}
          <AddButton onClick={() => set('tips', [...d.tips, { title: '', text: '', kind: 'good' } as Tip])}>Consejo</AddButton>
        </Section>

        <Section title="Notas y créditos">
          <textarea value={d.notes} onChange={(e) => set('notes', e.target.value)} rows={3} placeholder="Tus adaptaciones: «la última vez, menos sal»…" aria-label="Notas" className={area} />
          <input value={d.credit} onChange={(e) => set('credit', e.target.value)} placeholder="Basada en… (opcional)" aria-label="Créditos" className={`${input} h-10 text-sm font-medium`} />
        </Section>

        {isEdit &&
          (confirm ? (
            <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3">
              <p className="flex-1 text-sm font-semibold text-rose-700">¿Borrar «{draft.title}»?</p>
              <button
                onClick={() => {
                  deleteRecipe(draft.id!).catch((e: Error) => onError(e.message))
                  close()
                }}
                className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white"
              >
                Borrar
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="mx-auto flex items-center gap-1 text-sm font-semibold text-rose-600">
              <TrashIcon className="size-4" /> Borrar receta
            </button>
          ))}
      </div>
    </BottomSheet>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-extrabold">{title}</h3>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Box({ children, onUp, onDown, onDelete }: { children: ReactNode; onUp?: () => void; onDown?: () => void; onDelete?: () => void }) {
  return (
    <div className="space-y-2 rounded-2xl bg-stone-50 p-2.5">
      {children}
      {(onUp || onDown || onDelete) && (
        <div className="flex justify-end gap-1">
          {onUp && <IconBtn label="Subir" onClick={onUp}><ChevronIcon className="size-4 -rotate-90" /></IconBtn>}
          {onDown && <IconBtn label="Bajar" onClick={onDown}><ChevronIcon className="size-4 rotate-90" /></IconBtn>}
          {onDelete && <IconBtn label="Quitar" onClick={onDelete} danger><TrashIcon className="size-4" /></IconBtn>}
        </div>
      )}
    </div>
  )
}

function IconBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`grid size-8 place-items-center rounded-lg bg-surface ${danger ? 'text-rose-600' : 'text-muted'}`}>
      {children}
    </button>
  )
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-stone-200 py-2 text-sm font-bold text-muted">
      <PlusIcon className="size-4" /> {children}
    </button>
  )
}

function StepEditor({ n, step, onChange, onUp, onDown, onDelete }: { n: number; step: Step; onChange: (s: Step) => void; onUp?: () => void; onDown?: () => void; onDelete: () => void }) {
  const [more, setMore] = useState(Boolean(step.cue || step.fix || step.tech.length || step.chips.length || step.timer))
  const set = <K extends keyof Step>(k: K, v: Step[K]) => onChange({ ...step, [k]: v })
  return (
    <div className="space-y-2 rounded-xl border border-stone-200 bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold">{n}</span>
        <input value={step.title} onChange={(e) => set('title', e.target.value)} placeholder="Título (opcional)" aria-label={`Título del paso ${n}`} className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 bg-surface px-2 text-sm font-bold outline-none focus:border-both" />
      </div>
      <textarea value={step.text} onChange={(e) => set('text', e.target.value)} rows={3} placeholder="Qué hay que hacer" aria-label={`Paso ${n}`} className={`${area} text-sm`} />
      {more && (
        <div className="space-y-2">
          <input value={step.chips.join(', ')} onChange={(e) => set('chips', e.target.value.split(',').map((t) => t.trimStart()).filter((t, i, a) => t || i === a.length - 1))} placeholder="Datos rápidos: fuego medio, 5 min" aria-label="Datos rápidos" className={`${input} h-9 text-sm font-medium`} />
          <textarea value={step.cue} onChange={(e) => set('cue', e.target.value)} rows={2} placeholder="✅ Señal de que va bien" aria-label="Señal de que va bien" className={`${area} text-sm`} />
          <textarea value={step.fix} onChange={(e) => set('fix', e.target.value)} rows={2} placeholder="⚠️ Si no está bien…" aria-label="Si no está bien" className={`${area} text-sm`} />
          <textarea value={step.tech.join('\n')} onChange={(e) => set('tech', e.target.value.split('\n'))} rows={2} placeholder="Técnica al detalle (una idea por línea)" aria-label="Técnica al detalle" className={`${area} text-sm`} />
          <label className="flex items-center gap-2 text-sm font-semibold">
            ⏱️ Temporizador
            <input
              value={step.timer ? Math.round(step.timer.seconds / 60) || '' : ''}
              onChange={(e) => {
                const m = Number(e.target.value)
                set('timer', m > 0 ? { seconds: Math.round(m * 60), label: step.timer?.label || `${step.title || 'Paso'}, ${m} min` } : null)
              }}
              inputMode="numeric"
              placeholder="—"
              aria-label="Minutos del temporizador"
              className="h-9 w-16 rounded-lg border border-stone-200 bg-surface px-2 text-center outline-none focus:border-both"
            />
            min
          </label>
        </div>
      )}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMore((v) => !v)} className="text-xs font-bold text-both">
          {more ? 'Menos detalles' : '+ Señal, si falla, técnica, temporizador'}
        </button>
        <div className="flex gap-1">
          {onUp && <IconBtn label="Subir paso" onClick={onUp}><ChevronIcon className="size-4 -rotate-90" /></IconBtn>}
          {onDown && <IconBtn label="Bajar paso" onClick={onDown}><ChevronIcon className="size-4 rotate-90" /></IconBtn>}
          <IconBtn label="Quitar paso" onClick={onDelete} danger><TrashIcon className="size-4" /></IconBtn>
        </div>
      </div>
    </div>
  )
}
