import { cn } from '@/lib/utils'

/** Hairline progress: done in brand blue, failed in red. */
export function ProgressLine({ done, failed, total, className }: { done: number; failed: number; total: number; className?: string }) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0)
  return (
    <div className={cn('flex h-1 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className="bg-brand transition-all duration-500" style={{ width: `${pct(done)}%` }} />
      <div className="bg-destructive transition-all duration-500" style={{ width: `${pct(failed)}%` }} />
    </div>
  )
}
