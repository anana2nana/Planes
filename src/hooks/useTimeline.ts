import { useMemo } from 'react'
import { timelineItems, type TimelineItem } from '../lib/timeline'
import type { PersonId } from '../lib/types'
import { useHealth } from '../components/health/HealthView'
import { usePapers } from '../components/papers/PapersView'
import { useSubs } from '../components/subs/SubsView'
import { useTrips } from '../components/trips/TripsView'
import { useUpkeep } from '../components/upkeep/UpkeepView'
import { useCapsules } from '../components/us/UsViews'
import { usePet } from './usePet'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Lo que tiene fecha en los módulos, de hace 2 meses a dentro de 13 (para el calendario). */
export function useTimeline(me: PersonId): TimelineItem[] {
  const { items: trips } = useTrips()
  const { items: papers } = usePapers()
  const { items: subs } = useSubs()
  const { items: upkeep } = useUpkeep()
  const { profile, care } = usePet()
  const { items: health } = useHealth(me)
  const { items: capsules } = useCapsules()
  return useMemo(() => {
    const t = new Date()
    const from = ymd(new Date(t.getFullYear(), t.getMonth() - 2, 1))
    const to = ymd(new Date(t.getFullYear(), t.getMonth() + 13, 0))
    return timelineItems({ trips, papers, subs, upkeep, petCare: care, petName: profile?.name ?? '', health, capsules }, me, from, to, t)
  }, [trips, papers, subs, upkeep, care, profile?.name, health, capsules, me])
}
