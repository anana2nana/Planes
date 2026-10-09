import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { DEFAULT_PRIORITIES } from '../lib/colors'
import type { NotifPrefs, PersonId, Plan, PriorityConfig, Tag } from '../lib/types'
import { parseRepeat } from '../lib/recurrence'

export interface SyncState {
  loading: boolean
  /** true si los datos vienen de la caché local (sin conexión con el servidor). */
  offline: boolean
  /** true mientras hay cambios locales pendientes de subir. */
  pending: boolean
  error: string | null
}

function parsePlace(raw: unknown): Plan['place'] {
  const p = raw as Partial<NonNullable<Plan['place']>> | null | undefined
  if (!p || typeof p.name !== 'string' || !p.name) return null
  return {
    name: p.name,
    address: typeof p.address === 'string' ? p.address : '',
    placeId: typeof p.placeId === 'string' ? p.placeId : null,
    lat: typeof p.lat === 'number' ? p.lat : null,
    lng: typeof p.lng === 'number' ? p.lng : null,
  }
}

const initialSync: SyncState = { loading: true, offline: false, pending: false, error: null }

/** Planes en tiempo real: cualquier cambio de cualquiera de los dos aparece al instante. */
export function usePlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [sync, setSync] = useState<SyncState>(initialSync)

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'plans'),
        { includeMetadataChanges: true },
        (snap) => {
          setPlans(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' })
              return {
                id: d.id,
                title: data.title ?? '',
                notes: data.notes ?? '',
                assignee: data.assignee ?? 'both',
                groupId: data.groupId ?? null,
                kind: data.kind === 'event' || data.kind === 'task' ? data.kind : 'plan',
                repeat: parseRepeat(data.repeat),
                remindWeekBefore: data.remindWeekBefore === true,
                place: parsePlace(data.place),
                seriesId: data.seriesId ?? null,
                spawnedFrom: data.spawnedFrom ?? null,
                health: data.health === true,
                dueAt: data.dueAt ?? null,
                allDay: data.allDay ?? false,
                priority: data.priority ?? 'medium',
                tagIds: data.tagIds ?? [],
                done: data.done ?? false,
                doneAt: data.doneAt ?? null,
                doneBy: data.doneBy ?? null,
                createdBy: data.createdBy ?? 'nita',
                createdAt: data.createdAt ?? null,
                updatedAt: data.updatedAt ?? null,
              } satisfies Plan
            }),
          )
          setSync({
            loading: false,
            offline: snap.metadata.fromCache,
            pending: snap.metadata.hasPendingWrites,
            error: null,
          })
        },
        (err) => setSync((s) => ({ ...s, loading: false, error: err.message })),
      ),
    [],
  )

  return { plans, sync }
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])

  useEffect(
    () =>
      onSnapshot(collection(db, 'tags'), (snap) => {
        setTags(
          snap.docs
            .map((d) => ({ id: d.id, name: d.get('name') ?? '', color: d.get('color') ?? '#8b5cf6' }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
      }),
    [],
  )

  return tags
}

export function usePriorities(): PriorityConfig {
  const [config, setConfig] = useState<PriorityConfig>(DEFAULT_PRIORITIES)

  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'priorities'), (snap) => {
        const data = snap.data() as Partial<PriorityConfig> | undefined
        setConfig({
          urgent: { ...DEFAULT_PRIORITIES.urgent, ...data?.urgent },
          high: { ...DEFAULT_PRIORITIES.high, ...data?.high },
          medium: { ...DEFAULT_PRIORITIES.medium, ...data?.medium },
          low: { ...DEFAULT_PRIORITIES.low, ...data?.low },
        })
      }),
    [],
  )

  return config
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = { activity: true, reminders: true, leads: [60, 1440], digest: true, digestHour: 8, home: true, gifts: true }

export function useNotifPrefs(): Record<PersonId, NotifPrefs> {
  const [prefs, setPrefs] = useState({ nita: DEFAULT_NOTIF_PREFS, kitos: DEFAULT_NOTIF_PREFS })

  useEffect(
    () =>
      onSnapshot(doc(db, 'config', 'notifications'), (snap) => {
        const data = snap.data() as Partial<Record<PersonId, Partial<NotifPrefs>>> | undefined
        setPrefs({
          nita: { ...DEFAULT_NOTIF_PREFS, ...data?.nita },
          kitos: { ...DEFAULT_NOTIF_PREFS, ...data?.kitos },
        })
      }),
    [],
  )

  return prefs
}
