import { useEffect, useState } from 'react'
import { saveNote } from '../hooks/useNotes'
import { useShopping } from '../hooks/useShopping'
import { IDEA_CATEGORIES, IDEA_ORDER, type IdeaCategory } from '../lib/ideas'
import { findPlace } from '../lib/maps'
import { itemKey } from '../lib/shopping'
import type { Shared, ShareTarget } from '../lib/share'
import type { PersonId, PlaceInfo } from '../lib/types'
import { saveIdea } from '../services/ideas'
import { addShoppingItem } from '../services/shopping'
import { BottomSheet } from './BottomSheet'
import { GiftForm, emptyGift, hostOf } from './GiftsView'
import { RecipeEditor, emptyRecipe } from './food/RecipeEditor'
import { MediaSheet, emptyMedia } from './media/MediaView'
import { SpotSheet, emptySpot } from './spots/SpotsView'
import { guessSpotKind } from '../lib/spots'
import { mediaFromShare } from '../lib/media'

const TARGETS: { id: ShareTarget; label: string }[] = [
  { id: 'spot', label: '📍 Sitios' },
  { id: 'idea', label: '💡 Algún día' },
  { id: 'plan', label: '📅 Plan con fecha' },
  { id: 'recipe', label: '🍝 Receta' },
  { id: 'media', label: '🎬 Hemeroteca' },
  { id: 'gift', label: '🎁 Regalo' },
  { id: 'shopping', label: '🛒 Compra' },
  { id: 'note', label: '📝 Nota' },
]

/** Lo que llega con "Compartir → Nitakitos" desde otra app. */
export function ShareSheet({
  shared,
  me,
  onClose,
  onToast,
  onMakePlan,
}: {
  shared: Shared
  me: PersonId
  onClose: () => void
  onToast: (m: string) => void
  onMakePlan: (p: { title: string; place: PlaceInfo | null; notes: string }) => void
}) {
  const partner: PersonId = me === 'nita' ? 'kitos' : 'nita'
  const [target, setTarget] = useState<ShareTarget>(shared.suggested)
  const [title, setTitle] = useState(shared.name || (shared.link ? hostOf(shared.link) : ''))
  const [category, setCategory] = useState<IdeaCategory>(shared.isMaps ? 'comer' : 'otros')
  const [place, setPlace] = useState<PlaceInfo | null>(null)
  const [finding, setFinding] = useState(shared.isMaps)
  const [gift, setGift] = useState(false)
  const [recipe, setRecipe] = useState(false)
  const [media, setMedia] = useState(false)
  const [spot, setSpot] = useState(false)
  const { items } = useShopping()
  const fail = (e: Error) => onToast(e.message)

  // Desde Google Maps: buscamos el sitio para tener dirección, mapa y botón "Ir".
  useEffect(() => {
    if (!shared.isMaps) return
    let alive = true
    findPlace([shared.name, shared.detail].filter(Boolean).join(', '))
      .then((p) => alive && setPlace(p))
      .catch(() => {})
      .finally(() => alive && setFinding(false))
    return () => {
      alive = false
    }
  }, [shared])

  // Enlace como nota, salvo el de Google Maps (ya va en el sitio).
  const linkNote = shared.link && !(shared.isMaps && place) ? shared.link : ''
  const shopping = shared.lines.filter((l) => l.length <= 60)

  if (gift)
    return <GiftForm draft={emptyGift({ title, url: shared.link })} me={me} partner={partner} onClose={onClose} onError={onToast} onSaved={() => onToast('🎁 Guardado en Planes → Regalos (solo lo ves tú)')} />

  if (spot)
    return (
      <SpotSheet
        draft={emptySpot({ name: title.trim(), place, kind: guessSpotKind(title), link: shared.isMaps ? '' : shared.link })}
        me={me}
        onClose={onClose}
        onSaved={() => onToast('📍 Guardado en Nosotros → Sitios')}
        onError={onToast}
      />
    )

  if (media) {
    const m = mediaFromShare([shared.name, ...shared.lines.slice(1)].join('\n'), shared.link)
    return <MediaSheet draft={emptyMedia({ ...m, title: title.trim() === shared.name ? m.title : title.trim() })} me={me} onClose={onClose} onSaved={() => onToast('🎬 Guardado en Nosotros → Hemeroteca')} onError={onToast} />
  }

  if (recipe)
    return (
      <RecipeEditor
        draft={emptyRecipe({ title: /^https?:/.test(title) || /tiktok|youtube|instagram/i.test(title) ? '' : title, url: shared.link })}
        me={me}
        onClose={onClose}
        onError={onToast}
        onSaved={() => onToast('🍝 Receta guardada en Comida → Recetas')}
      />
    )

  const save = () => {
    const t = title.trim()
    if (target === 'gift') return setGift(true)
    if (target === 'recipe') return setRecipe(true)
    if (target === 'media') return setMedia(true)
    if (target === 'spot') return setSpot(true)
    if (target === 'plan') {
      onMakePlan({ title: t, place, notes: linkNote })
      return
    }
    if (target === 'idea') {
      saveIdea({ title: t, category, place, notes: linkNote }, me).catch(fail)
      onToast(`💡 «${t}» guardado en Planes → Algún día`)
    } else if (target === 'note') {
      saveNote({ emoji: '📝', title: t.slice(0, 60) || 'Compartido', body: [...shared.lines.slice(t ? 1 : 0), shared.link].filter(Boolean).join('\n'), pinned: false }, me).catch(fail)
      onToast('📝 Guardado en Casa → Notas')
    } else if (target === 'shopping') {
      const fresh = shopping.filter((l, i, all) => all.findIndex((x) => itemKey(x) === itemKey(l)) === i)
      const added = fresh.filter((l) => addShoppingItem(l, 'super', me, items)).length
      onToast(added ? `🛒 ${added} ${added === 1 ? 'cosa añadida' : 'cosas añadidas'} a la compra` : 'Ya estaba todo en la lista')
    }
    onClose()
  }

  const canSave = target === 'shopping' ? shopping.length > 0 : target === 'recipe' || title.trim() !== ''

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Guardar en Nitakitos"
      footer={
        <button onClick={save} disabled={!canSave} className="h-13 w-full rounded-2xl bg-ink font-bold text-cream disabled:opacity-30">
          {target === 'gift' || target === 'plan' || target === 'recipe' || target === 'media' || target === 'spot' ? 'Seguir' : 'Guardar'}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dónde guardarlo">
          {TARGETS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={target === t.id}
              onClick={() => setTarget(t.id)}
              className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-95 ${target === t.id ? 'bg-ink text-cream' : 'bg-stone-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {target === 'shopping' ? (
          <div className="rounded-2xl bg-stone-50 p-3">
            <p className="mb-1 text-xs font-semibold text-muted">Se añadirá a la lista:</p>
            <ul className="list-inside list-disc text-sm font-semibold">
              {shopping.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Título"
            maxLength={120}
            className="w-full border-0 border-b-2 border-stone-100 bg-transparent py-2 text-xl font-bold outline-none focus:border-both"
            style={{ fontSize: 20 }}
          />
        )}

        {target === 'idea' && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de idea">
            {IDEA_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${category === c ? 'bg-both text-white' : 'bg-stone-100'}`}
              >
                {IDEA_CATEGORIES[c].emoji} {IDEA_CATEGORIES[c].label}
              </button>
            ))}
          </div>
        )}

        {(target === 'idea' || target === 'plan' || target === 'spot') && shared.isMaps && (
          <p className="rounded-2xl bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700">
            {finding ? '📍 Buscando el sitio en Google Maps…' : place ? `📍 ${place.name} · ${place.address}` : '📍 No he encontrado el sitio: se guarda el enlace.'}
          </p>
        )}
        {shared.link && !shared.isMaps && target !== 'shopping' && <p className="truncate text-xs text-muted">🔗 {shared.link}</p>}
        {target === 'recipe' && <p className="text-xs text-muted">En el siguiente paso puedes pegar la descripción del vídeo para sacar los ingredientes.</p>}
        {target === 'gift' && <p className="text-xs text-muted">🤫 Solo lo verás tú, en Planes → Regalos.</p>}
      </div>
    </BottomSheet>
  )
}
