import {
  Timestamp,
  arrayRemove,
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { partnerOf } from '../lib/people'
import { dayKey, nextOccurrence, type Repeat } from '../lib/recurrence'
import { draftToDate } from '../lib/time'
import type { Assignee, NotifPrefs, Plan, PersonId, PlanDraft, PriorityConfig, PriorityId, Tag } from '../lib/types'

const plansCol = collection(db, 'plans')

const newId = () => doc(plansCol).id

function buildRepeat(draft: PlanDraft): Repeat | null {
  if (draft.repeatYearly) return { days: [], yearly: true, rotate: false }
  if (draft.repeatDays.length === 0) return null
  // Los turnos solo tienen sentido en tareas/planes asignados a una persona.
  const canRotate = draft.kind !== 'event' && (draft.mode === 'nita' || draft.mode === 'kitos')
  return { days: [...draft.repeatDays].sort(), yearly: false, rotate: draft.rotate && canRotate }
}

function sharedFields(draft: PlanDraft, seriesId: string | null) {
  const { date, allDay } = draftToDate(draft.dueDate, draft.dueTime)
  const repeat = date ? buildRepeat(draft) : null
  const repeats = repeat !== null
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    dueAt: date ? Timestamp.fromDate(date) : null,
    allDay,
    priority: draft.priority,
    tagIds: draft.tagIds,
    repeat,
    remindWeekBefore: draft.kind === 'event' && draft.remindWeekBefore,
    place: draft.place,
    seriesId: repeats ? (seriesId ?? newId()) : seriesId,
  }
}

/**
 * Crea un plan. En modo "duplicate" crea DOS documentos (uno para cada uno)
 * enlazados por `groupId`: comparten título, fecha, prioridad y etiquetas,
 * pero cada uno se completa de forma independiente.
 */
export async function createPlan(draft: PlanDraft, me: PersonId, extra: Record<string, unknown> = {}) {
  const batch = writeBatch(db)
  const base = {
    ...sharedFields(draft, null),
    spawnedFrom: null,
    done: false,
    doneAt: null,
    doneBy: null,
    createdBy: me,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  }

  if (draft.mode === 'duplicate') {
    const groupId = doc(plansCol).id
    for (const assignee of ['nita', 'kitos'] as const) {
      batch.set(doc(plansCol), { ...base, assignee, groupId })
    }
  } else {
    batch.set(doc(plansCol), { ...base, assignee: draft.mode, groupId: null })
  }

  await batch.commit()
}

/**
 * Guarda los cambios. Si el plan es una copia duplicada, los campos compartidos
 * se propagan a su pareja (el estado "hecho" de cada copia no se toca).
 */
export async function updatePlan(plan: Plan, draft: PlanDraft, siblings: Plan[]) {
  const batch = writeBatch(db)
  const shared = { ...sharedFields(draft, plan.seriesId), updatedAt: serverTimestamp() }
  const ref = doc(plansCol, plan.id)

  if (plan.groupId) {
    batch.update(ref, shared)
    siblings.forEach((s) => batch.update(doc(plansCol, s.id), shared))
  } else if (draft.mode === 'duplicate') {
    // Convertir un plan normal en duplicado: este queda para una persona
    // y se crea una copia nueva (pendiente) para la otra.
    const keep: PersonId = plan.assignee === 'both' ? plan.createdBy : plan.assignee
    const groupId = doc(plansCol).id
    batch.update(ref, { ...shared, assignee: keep, groupId })
    batch.set(doc(plansCol), {
      ...shared,
      assignee: partnerOf(keep),
      groupId,
      done: false,
      doneAt: null,
      doneBy: null,
      createdBy: plan.createdBy,
      createdAt: serverTimestamp(),
      spawnedFrom: null,
    })
  } else {
    batch.update(ref, { ...shared, assignee: draft.mode as Assignee })
  }

  await batch.commit()
}

/**
 * Marca/desmarca un plan como hecho. Si se repite y se completa, crea la
 * siguiente repetición (salvo que ya exista, p. ej. si se desmarcó y se volvió a marcar).
 * Devuelve al instante la fecha de la siguiente repetición, si la hay.
 */
export function toggleDone(
  plan: Plan,
  me: PersonId,
  allPlans: Plan[],
): { next: Date | null; nextAssignee: Assignee; committed: Promise<void> } {
  const batch = writeBatch(db)
  const done = !plan.done
  batch.update(doc(plansCol, plan.id), {
    done,
    doneAt: done ? serverTimestamp() : null,
    doneBy: done ? me : null,
    updatedAt: serverTimestamp(),
  })

  let next: Date | null = null
  let nextAssignee: Assignee = plan.assignee
  const alreadySpawned = allPlans.some((p) => p.spawnedFrom === plan.id)
  if (done && plan.kind !== 'event' && plan.repeat && plan.dueAt && !alreadySpawned) {
    next = nextOccurrence(plan.dueAt.toDate(), plan.repeat)
    // Turnos: la siguiente vez le toca a la otra persona.
    if (plan.repeat.rotate && plan.assignee !== 'both' && !plan.groupId) nextAssignee = partnerOf(plan.assignee)
    if (next) {
      const seriesId = plan.seriesId ?? newId()
      batch.set(doc(plansCol), {
        kind: plan.kind,
        title: plan.title,
        notes: plan.notes,
        assignee: nextAssignee,
        // Las dos copias de un duplicado calculan el mismo id para la misma fecha.
        groupId: plan.groupId ? `${seriesId}_${dayKey(next)}` : null,
        dueAt: Timestamp.fromDate(next),
        allDay: plan.allDay,
        priority: plan.priority,
        tagIds: plan.tagIds,
        repeat: plan.repeat,
        remindWeekBefore: plan.remindWeekBefore,
        place: plan.place,
        seriesId,
        spawnedFrom: plan.id,
        done: false,
        doneAt: null,
        doneBy: null,
        createdBy: plan.createdBy,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
  }

  return { next, nextAssignee, committed: batch.commit() }
}

export async function deletePlans(ids: string[]) {
  const batch = writeBatch(db)
  ids.forEach((id) => batch.delete(doc(plansCol, id)))
  await batch.commit()
}

// ─── Etiquetas ──────────────────────────────────────────────────────────────

const tagsCol = collection(db, 'tags')

/** Devuelve el id al instante (generado en local) y la promesa de confirmación del servidor. */
export function saveTag(tag: Omit<Tag, 'id'> & { id?: string }): { id: string; committed: Promise<void> } {
  const ref: DocumentReference = tag.id ? doc(tagsCol, tag.id) : doc(tagsCol)
  const batch = writeBatch(db)
  batch.set(ref, { name: tag.name.trim(), color: tag.color })
  return { id: ref.id, committed: batch.commit() }
}

/** Borra la etiqueta y la quita de todos los planes que la usaban. */
export async function deleteTag(tagId: string, plans: Plan[]) {
  const batch = writeBatch(db)
  batch.delete(doc(tagsCol, tagId))
  plans
    .filter((p) => p.tagIds.includes(tagId))
    .forEach((p) => batch.update(doc(plansCol, p.id), { tagIds: arrayRemove(tagId) }))
  await batch.commit()
}

// ─── Prioridades ────────────────────────────────────────────────────────────

export async function savePriority(id: PriorityId, config: PriorityConfig[PriorityId]) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'config', 'priorities'), { [id]: config }, { merge: true })
  await batch.commit()
}

// ─── Notificaciones ─────────────────────────────────────────────────────────

export async function saveNotifPrefs(person: PersonId, prefs: NotifPrefs) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'config', 'notifications'), { [person]: prefs }, { merge: true })
  await batch.commit()
}
