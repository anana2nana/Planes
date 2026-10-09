import { MEDIA_ORDER, type Media, type MediaKind, type MediaStatus } from '../lib/media'
import type { PersonId } from '../lib/types'
import { millis, num, oneOf, saveItem, str, useList } from './useList'

const parse = (id: string, x: Record<string, any>): Media => ({
  id,
  kind: oneOf<MediaKind>(x.kind, MEDIA_ORDER, 'peli'),
  title: str(x.title),
  subtitle: str(x.subtitle),
  cover: str(x.cover) || null,
  status: oneOf<MediaStatus>(x.status, ['want', 'doing', 'done'], 'want'),
  where: str(x.where),
  recommendedBy: str(x.recommendedBy),
  progress: str(x.progress),
  rating: { nita: num(x.rating?.nita), kitos: num(x.rating?.kitos) },
  comment: str(x.comment),
  finishedAt: str(x.finishedAt) || null,
  createdAt: millis(x.createdAt),
})

export const useMedia = () => useList('media', parse)

export type MediaDraft = Omit<Media, 'id' | 'createdAt'> & { id?: string }
export const saveMedia = (m: MediaDraft, me: PersonId, onError: (m: string) => void) => saveItem('media', m, me, onError)
