import type { Kind } from './types'

/** Textos e iconos de cada tipo, en un único sitio. */
export const KINDS: Record<
  Kind,
  { emoji: string; one: string; tab: string; new: string; placeholder: string; dateLabel: string; article: 'una' | 'un' }
> = {
  event: {
    emoji: '📅',
    one: 'Cita',
    tab: 'Agenda',
    new: 'Nueva cita',
    placeholder: 'Médico, cumple de Laura…',
    dateLabel: 'Cuándo',
    article: 'una',
  },
  plan: {
    emoji: '💞',
    one: 'Plan',
    tab: 'Planes',
    new: 'Nuevo plan',
    placeholder: '¿Qué plan tenemos?',
    dateLabel: 'Fecha tope',
    article: 'un',
  },
  task: {
    emoji: '🧹',
    one: 'Tarea',
    tab: 'Tareas',
    new: 'Nueva tarea',
    placeholder: 'Limpiar la cocina, arenero de la gata…',
    dateLabel: 'Para cuándo',
    article: 'una',
  },
}

export const KIND_ORDER: Kind[] = ['event', 'plan', 'task']

/** Las citas que se repiten cada año se muestran como cumpleaños. */
export const eventEmoji = (yearly: boolean) => (yearly ? '🎂' : '📅')
