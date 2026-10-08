import type { Timestamp } from 'firebase/firestore'
import type { Repeat } from './recurrence'

export type PersonId = 'nita' | 'kitos'
/** A quién está asignado un plan ya guardado. */
export type Assignee = PersonId | 'both'
/** Opción del selector al crear: "duplicate" genera una copia independiente para cada uno. */
export type AssignMode = Assignee | 'duplicate'

export type PriorityId = 'low' | 'medium' | 'high' | 'urgent'

/** Un sitio (de Google Maps o escrito a mano). */
export interface PlaceInfo {
  name: string
  address: string
  placeId: string | null
  lat: number | null
  lng: number | null
}

/** Cita (médico, cumpleaños: no se completa) · Plan (ocio) · Tarea (casa, gata, gimnasio). */
export type Kind = 'event' | 'plan' | 'task'

export interface Plan {
  id: string
  kind: Kind
  title: string
  notes: string
  assignee: Assignee
  /** Si es una tarea duplicada, ambas copias comparten este id. */
  groupId: string | null
  /** Cómo se repite, o null. */
  repeat: Repeat | null
  /** Avisar también una semana antes (cumpleaños: para el regalo). */
  remindWeekBefore: boolean
  /** Dónde (para "Cómo llegar"). */
  place: PlaceInfo | null
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
  kind: Kind
  title: string
  notes: string
  mode: AssignMode
  dueDate: string // yyyy-mm-dd o ''
  dueTime: string // hh:mm o ''
  priority: PriorityId
  tagIds: string[]
  /** Días en que se repite; vacío = no se repite (salvo `repeatYearly`). */
  repeatDays: number[]
  repeatYearly: boolean
  /** Turnos: cada repetición le toca a la otra persona. */
  rotate: boolean
  remindWeekBefore: boolean
  place: PlaceInfo | null
}

/** Preferencias de notificación de cada persona (config/notifications). */
export interface NotifPrefs {
  /** Avisarme cuando mi pareja crea un plan para mí o completa uno. */
  activity: boolean
  /** Recordatorios antes de la fecha tope. */
  reminders: boolean
  /** Minutos de antelación (0 = a la hora). */
  leads: number[]
  /** Resumen de cada mañana con lo de hoy, y a qué hora (0-23). */
  digest: boolean
  digestHour: number
  /** Avisos de la casa: pago de mañana, actualizar el ahorro. */
  home: boolean
  /** Avisos de regalos (unas semanas antes de cada fecha). */
  gifts: boolean
}
