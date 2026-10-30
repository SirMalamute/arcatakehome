import type { ReactNode } from 'react'

/** Numbered eyebrow, display title, one-line description, actions on the right. */
export function PageHeader({ index, eyebrow, title, description, actions, children }: {
  index?: string
  eyebrow: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 space-y-3">
        <div className="eyebrow flex items-center gap-2">
          {index && <span className="text-brand">{index}</span>}
          {index && <span className="h-px w-6 bg-brand/60" />}
          <span>{eyebrow}</span>
        </div>
        <h1 className="text-3xl font-medium text-ink">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'success' | 'destructive' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'destructive' ? 'text-destructive' : 'text-ink'
  return (
    <div className="space-y-1">
      <div className="eyebrow">{label}</div>
      <div className={`font-heading text-xl font-medium tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border bg-card ${className}`}>{children}</div>
}
