import type { ReviewItem } from '@/types'

export type CellKind = 'pending' | 'failed' | 'not_found' | 'not_stated' | 'found'

const NOT_STATED = /^(not[ _]stated|unknown|unclear|not[ _]specified)$/i

/** The document answers the question, but says the fact isn't stated (e.g. enum "not_stated"). */
export function isNotStated(value: unknown): boolean {
  return typeof value === 'string' && NOT_STATED.test(value.trim())
}

export function cellKind(item: ReviewItem, key: string): CellKind {
  if (item.status === 'queued' || item.status === 'running') return 'pending'
  if (item.status === 'failed') return 'failed'
  const a = item.answers?.[key]
  if (!a || a.status === 'not_found') return 'not_found'
  return isNotStated(a.value) ? 'not_stated' : 'found'
}
