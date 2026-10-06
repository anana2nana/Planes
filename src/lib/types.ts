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
  /** Días de la semana en que se repite (0 = domingo … 6 = sábado), o null. */
  repeatDays: number[] | null
  /** Común a todas las repeticiones de un mismo plan. */
  seriesId: string | null
  /** Repetición anterior de la que se creó este plan al completarla. */
  spawnedFrom: string | null
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
  /** Días en que se repite; vacío = no se repite. */
  repeatDays: number[]
}

/** Preferencias de notificación de cada persona (config/notifications). */
export interface NotifPrefs {
  /** Avisarme cuando mi pareja crea un plan para mí o completa uno. */
  activity: boolean
  /** Recordatorios antes de la fecha tope. */
  reminders: boolean
  /** Minutos de antelación (0 = a la hora). */
  leads: number[]
}
