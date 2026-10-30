import { FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Panel } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { TypeTag } from '@/components/TypeTag'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { AUTHORITY_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { DocumentSummary } from '@/types'

interface Selection {
  selected: Set<string>
  onChange: (s: Set<string>) => void
}

const PAGE_SIZE = 25

export function DocumentResults({ documents, loading, selection, onClearFilters }: {
  documents: DocumentSummary[]
  loading: boolean
  selection?: Selection
  onClearFilters?: () => void
}) {
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [documents])

  if (loading && !documents.length) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }
  if (!documents.length) {
    return (
      <Panel className="border-dashed py-16 text-center">
        <p className="eyebrow">No matches</p>
        <p className="mt-2 text-sm text-muted-foreground">No documents match these filters. Try removing a condition, or widen the date range.</p>
        {onClearFilters && (
          <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onClearFilters}>Clear filters</Button>
        )}
      </Panel>
    )
  }

  const allSelected = selection && documents.every((d) => selection.selected.has(d.id))
  const toggle = (id: string) => {
    if (!selection) return
    const next = new Set(selection.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onChange(next)
  }
  const cols = selection ? 'grid-cols-[1.5rem_1fr_9rem_7rem_5rem_6rem_3rem]' : 'grid-cols-[1fr_9rem_7rem_5rem_6rem_3rem]'

  return (
    <Panel className={cn('divide-y overflow-hidden', loading && 'opacity-60')}>
      <div className={cn('eyebrow grid items-center gap-4 px-5 py-3', cols)}>
        {selection && (
          <Checkbox
            checked={allSelected}
            aria-label="Select all matching documents"
            title="Select all matching documents (every page)"
            onCheckedChange={(v) => selection.onChange(new Set(v ? documents.map((d) => d.id) : []))}
          />
        )}
        <span>Title</span><span>Type</span><span>Authority</span><span>Product</span><span>Date</span><span className="text-right">Pages</span>
      </div>
      {documents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((d) => {
        const checked = selection?.selected.has(d.id)
        return (
          <div
            key={d.id}
            onClick={() => toggle(d.id)}
            className={cn(
              'grid items-center gap-4 px-5 py-3 text-sm transition-colors',
              cols,
              selection && 'cursor-pointer hover:bg-muted/40',
              selection && !checked && 'text-muted-foreground',
            )}
          >
            {selection && <Checkbox checked={checked} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggle(d.id)} />}
            <span className="flex min-w-0 items-center gap-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground/70" />
              <span className={cn('truncate', !(selection && !checked) && 'text-ink')}>{d.title}</span>
            </span>
            <span><TypeTag type={d.type} /></span>
            <span>{AUTHORITY_LABELS[d.authority] ?? d.authority}</span>
            <span className="font-mono text-xs">{d.product ?? '—'}</span>
            <span className="font-mono text-xs text-muted-foreground">{d.date ?? '—'}</span>
            <span className="text-right font-mono text-xs text-muted-foreground">{d.page_count}</span>
          </div>
        )
      })}
      <Pager page={page} pageSize={PAGE_SIZE} total={documents.length} onPage={setPage} />
    </Panel>
  )
}
