import { AlertCircle, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Error shown where it happened, instead of a toast. */
export function InlineError({ message, onDismiss, className }: { message: string | null; onDismiss?: () => void; className?: string }) {
  if (!message) return null
  return (
    <div role="alert" className={cn('flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive', className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="text-destructive/70 hover:text-destructive">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
