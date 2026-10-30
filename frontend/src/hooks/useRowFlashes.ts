import { useEffect, useRef, useState } from 'react'

import type { ReviewItem } from '@/types'

/** Rows that just finished since the previous poll, so they can pulse once. */
export function useRowFlashes(items: ReviewItem[] | undefined, durationMs = 2400) {
  const prev = useRef<Map<string, string> | null>(null)
  const [flashes, setFlashes] = useState<Record<string, 'done' | 'failed'>>({})

  useEffect(() => {
    if (!items) return
    const before = prev.current
    prev.current = new Map(items.map((i) => [i.document_id, i.status]))
    if (!before) return // first load: nothing "just" finished
    const fresh: Record<string, 'done' | 'failed'> = {}
    for (const i of items) {
      const was = before.get(i.document_id)
      if ((i.status === 'done' || i.status === 'failed') && was !== i.status) fresh[i.document_id] = i.status
    }
    if (!Object.keys(fresh).length) return
    setFlashes((f) => ({ ...f, ...fresh }))
    const t = setTimeout(
      () => setFlashes((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !(k in fresh)))),
      durationMs,
    )
    return () => clearTimeout(t)
  }, [items, durationMs])

  return flashes
}
