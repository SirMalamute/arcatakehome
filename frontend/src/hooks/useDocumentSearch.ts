import { useEffect, useMemo, useState } from 'react'

import { api } from '@/api'
import { useDebounced } from '@/hooks/useDebounced'
import { isComplete } from '@/lib/format'
import type { DocumentSummary, Filter } from '@/types'

/** Debounced live search; incomplete conditions (still being edited) are ignored. */
export function useDocumentSearch(filter: Filter, refreshKey = 0) {
  const effective = useMemo(() => ({ conditions: filter.conditions.filter(isComplete) }), [filter])
  const key = useDebounced(JSON.stringify(effective), 300)
  const [state, setState] = useState<{ documents: DocumentSummary[]; total: number; loading: boolean; error: string | null }>({
    documents: [],
    total: 0,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    api
      .search(JSON.parse(key))
      .then((r) => !cancelled && setState({ documents: r.documents, total: r.total, loading: false, error: null }))
      .catch((e) => !cancelled && setState({ documents: [], total: 0, loading: false, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key, refreshKey])

  return { ...state, effectiveFilter: effective }
}
