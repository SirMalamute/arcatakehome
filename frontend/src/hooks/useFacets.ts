import { useEffect, useState } from 'react'

import { api } from '@/api'
import type { Facets } from '@/types'

export function useFacets(refreshKey = 0): Facets | null {
  const [facets, setFacets] = useState<Facets | null>(null)
  useEffect(() => {
    api.facets().then(setFacets).catch(() => setFacets(null))
  }, [refreshKey])
  return facets
}
