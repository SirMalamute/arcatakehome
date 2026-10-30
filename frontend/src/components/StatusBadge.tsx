import { cn } from '@/lib/utils'
import type { ItemStatus, ReviewStatus } from '@/types'

const DOT: Record<ItemStatus | ReviewStatus, string> = {
  draft: 'bg-muted-foreground/40',
  queued: 'bg-muted-foreground/40',
  running: 'bg-brand animate-pulse',
  done: 'bg-success',
  complete: 'bg-success',
  failed: 'bg-destructive',
}

export function StatusBadge({ status }: { status: ItemStatus | ReviewStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-ink uppercase">
      <span className={cn('size-1.5 rounded-full', DOT[status])} />
      {status}
    </span>
  )
}
