import { AlertTriangle, OctagonX } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cellKind } from '@/lib/answers'
import { formatValue } from '@/lib/format'
import type { Answer, ReviewItem } from '@/types'

function Cites({ answer }: { answer: Answer }) {
  if (!answer.quotes.length) return null
  const unverified = answer.quotes.some((q) => !q.verified)
  const pages = [...new Set(answer.quotes.map((q) => q.page))]
  return (
    <div className={`flex items-center gap-1.5 font-mono text-[10px] ${unverified ? 'text-warning' : 'text-muted-foreground'}`}>
      {unverified && <AlertTriangle className="size-3" aria-label="Unverified quote" />}
      {answer.quotes.length} cite{answer.quotes.length === 1 ? '' : 's'} · p.{pages.join(', ')}
    </div>
  )
}

export function CellView({ item, columnKey }: { item: ReviewItem; columnKey: string }) {
  const kind = cellKind(item, columnKey)
  const answer = item.answers?.[columnKey]

  switch (kind) {
    case 'pending':
      return (
        <div className="space-y-1.5 py-0.5">
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      )
    case 'failed':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-destructive uppercase">
              <OctagonX className="size-3" /> Failed
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{item.error}</TooltipContent>
        </Tooltip>
      )
    case 'not_found':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block px-1 text-sm text-muted-foreground/60">—</span>
          </TooltipTrigger>
          <TooltipContent>Not found in this document</TooltipContent>
        </Tooltip>
      )
    case 'not_stated':
      return (
        <div className="space-y-1.5">
          <span className="inline-flex items-center rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-warning uppercase">
            Not stated
          </span>
          <Cites answer={answer!} />
        </div>
      )
    case 'found': {
      const value = answer!.value
      return (
        <div className="space-y-1.5">
          {Array.isArray(value) ? (
            <ul className="space-y-0.5 text-[13px] leading-snug text-ink">
              {value.slice(0, 2).map((v, i) => (
                <li key={i} className="line-clamp-1 before:mr-1.5 before:text-brand before:content-['–']">{String(v)}</li>
              ))}
              {value.length > 2 && <li className="text-xs text-muted-foreground">+{value.length - 2} more</li>}
            </ul>
          ) : (
            <div className="line-clamp-2 text-[13px] leading-snug text-ink">{formatValue(value)}</div>
          )}
          <Cites answer={answer!} />
        </div>
      )
    }
  }
}

export function CellLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-brand" /> Answered</span>
      <span className="flex items-center gap-1.5"><span className="text-sm leading-none">—</span> Not found</span>
      <span className="flex items-center gap-1.5"><span className="rounded border border-warning/30 bg-warning/10 px-1 text-warning">Not stated</span> Doc says it's unknown</span>
      <span className="flex items-center gap-1.5 text-destructive"><OctagonX className="size-3" /> Failed</span>
      <span className="flex items-center gap-1.5 text-warning"><AlertTriangle className="size-3" /> Unverified quote</span>
    </div>
  )
}
