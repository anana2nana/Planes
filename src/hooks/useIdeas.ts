import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { IDEA_CATEGORIES, type Idea, type IdeaCategory } from '../lib/ideas'

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  useEffect(
    () =>
      onSnapshot(collection(db, 'ideas'), (snap) =>
        setIdeas(
          snap.docs
            .map((d) => {
              const x = d.data({ serverTimestamps: 'estimate' })
              return {
                id: d.id,
                title: x.title ?? '',
                category: (x.category in IDEA_CATEGORIES ? x.category : 'otros') as IdeaCategory,
                place: x.place?.name ? x.place : null,
                notes: x.notes ?? '',
                done: x.done === true,
                addedBy: x.addedBy === 'nita' || x.addedBy === 'kitos' ? x.addedBy : null,
                createdAt: x.createdAt?.toMillis?.() ?? 0,
                doneAt: x.doneAt?.toMillis?.() ?? null,
              }
            })
            .sort((a, b) => b.createdAt - a.createdAt),
        ),
      ),
    [],
  )
  return ideas
}
