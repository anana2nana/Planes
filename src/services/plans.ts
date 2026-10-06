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
import { draftToDate } from '../lib/time'
import type { Assignee, NotifPrefs, Plan, PersonId, PlanDraft, PriorityConfig, PriorityId, Tag } from '../lib/types'

const plansCol = collection(db, 'plans')

function sharedFields(draft: PlanDraft) {
  const { date, allDay } = draftToDate(draft.dueDate, draft.dueTime)
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    dueAt: date ? Timestamp.fromDate(date) : null,
    allDay,
    priority: draft.priority,
    tagIds: draft.tagIds,
  }
}

/**
 * Crea un plan. En modo "duplicate" crea DOS documentos (uno para cada uno)
 * enlazados por `groupId`: comparten título, fecha, prioridad y etiquetas,
 * pero cada uno se completa de forma independiente.
 */
export async function createPlan(draft: PlanDraft, me: PersonId) {
  const batch = writeBatch(db)
  const base = {
    ...sharedFields(draft),
    done: false,
    doneAt: null,
    doneBy: null,
    createdBy: me,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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
  const shared = { ...sharedFields(draft), updatedAt: serverTimestamp() }
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
    })
  } else {
    batch.update(ref, { ...shared, assignee: draft.mode as Assignee })
  }

  await batch.commit()
}

export async function toggleDone(plan: Plan, me: PersonId) {
  const batch = writeBatch(db)
  const done = !plan.done
  batch.update(doc(plansCol, plan.id), {
    done,
    doneAt: done ? serverTimestamp() : null,
    doneBy: done ? me : null,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
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
