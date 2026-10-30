import { useState } from 'react'

import { DocumentResults } from '@/components/DocumentResults'
import { DocumentSearch } from '@/components/DocumentSearch'
import { PageHeader } from '@/components/PageHeader'
import { UploadModal } from '@/components/UploadModal'
import { useDocumentSearch } from '@/hooks/useDocumentSearch'
import { useFacets } from '@/hooks/useFacets'
import type { Filter } from '@/types'

export function DocumentsPage() {
  const [filter, setFilter] = useState<Filter>({ conditions: [] })
  const [refreshKey, setRefreshKey] = useState(0)
  const facets = useFacets(refreshKey)
  const { documents, total, loading, error } = useDocumentSearch(filter, refreshKey)

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Document library"
        description="Submissions, HA correspondence, CMC sections, stability protocols, SOPs and deviations. Search by metadata and full text, or describe what you need."
        actions={<UploadModal onUploaded={() => setRefreshKey((k) => k + 1)} />}
      />
      <div className="space-y-6">
        <DocumentSearch filter={filter} facets={facets} onChange={setFilter} />
        <div className="space-y-3">
          <div className="eyebrow">
            {error ? <span className="text-destructive">{error}</span> : `${total} document${total === 1 ? '' : 's'}`}
          </div>
          <DocumentResults documents={documents} loading={loading} onClearFilters={() => setFilter({ conditions: [] })} />
        </div>
      </div>
    </>
  )
}
