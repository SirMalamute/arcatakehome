import { toast } from 'sonner'

import { DescribeSearch } from '@/components/DescribeSearch'
import { FilterBuilder } from '@/components/filter/FilterBuilder'
import { Panel } from '@/components/PageHeader'
import type { Facets, Filter } from '@/types'

/** Describe the documents in plain English to generate filters, then review or edit them below. */
export function DocumentSearch({ filter, facets, onChange }: {
  filter: Filter
  facets: Facets | null
  onChange: (f: Filter) => void
}) {
  return (
    <Panel className="space-y-5 p-5">
      <DescribeSearch
        onFilter={(f, explanation) => {
          onChange(f)
          toast(explanation, { description: 'Review or edit the filters below.' })
        }}
      />
      <div className="space-y-3 border-t pt-4">
        <div className="eyebrow">Filters</div>
        <FilterBuilder filter={filter} facets={facets} onChange={onChange} />
      </div>
    </Panel>
  )
}
