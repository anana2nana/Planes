import type { Timestamp } from 'firebase/firestore'

export type PersonId = 'nita' | 'kitos'
/** A quién está asignado un plan ya guardado. */
export type Assignee = PersonId | 'both'
/** Opción del selector al crear: "duplicate" genera una copia independiente para cada uno. */
export type AssignMode = Assignee | 'duplicate'

export type PriorityId = 'low' | 'medium' | 'high' | 'urgent'

export interface Plan {
  id: string
  title: string
  notes: string
  assignee: Assignee
  /** Si es una tarea duplicada, ambas copias comparten este id. */
  groupId: string | null
  dueAt: Timestamp | null
  /** true = solo cuenta el día (vence a las 23:59). */
  allDay: boolean
  priority: PriorityId
  tagIds: string[]
  done: boolean
  doneAt: Timestamp | null
  doneBy: PersonId | null
  createdBy: PersonId
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface PriorityLevel {
  label: string
  color: string
}

export type PriorityConfig = Record<PriorityId, PriorityLevel>

/** Datos editables desde el formulario. */
export interface PlanDraft {
  title: string
  notes: string
  mode: AssignMode
  dueDate: string // yyyy-mm-dd o ''
  dueTime: string // hh:mm o ''
  priority: PriorityId
  tagIds: string[]
}
