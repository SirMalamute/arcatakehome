import { TYPE_LABELS } from '@/lib/format'

export function TypeTag({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded border bg-background px-1.5 py-px font-mono text-[10px] tracking-wide whitespace-nowrap text-muted-foreground uppercase">
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}
