import { Badge } from '@/components/ui/badge'
import { conditionLabel, isComplete } from '@/lib/format'
import type { Filter } from '@/types'

export function FilterChips({ filter, emptyLabel = 'All documents' }: { filter: Filter; emptyLabel?: string }) {
  const complete = filter.conditions.filter(isComplete)
  if (!complete.length) return <span className="eyebrow">{emptyLabel}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {complete.map((c, i) => (
        <Badge key={i} variant="outline" className="rounded-full bg-card font-normal text-ink">{conditionLabel(c)}</Badge>
      ))}
    </div>
  )
}
