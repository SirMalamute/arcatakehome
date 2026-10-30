import { ArrowUpRight, Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '@/api'
import { PageHeader, Panel } from '@/components/PageHeader'
import { ProgressLine } from '@/components/ProgressLine'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolling } from '@/hooks/usePolling'
import { formatTokens } from '@/lib/format'
import type { ReviewSummary } from '@/types'

export function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null)
  const load = useCallback(() => {
    api.reviews().then(setReviews).catch(() => setReviews([]))
  }, [])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, Boolean(reviews?.some((r) => r.status === 'running')))

  return (
    <>
      <PageHeader
        eyebrow="Reviews"
        title="Bulk reviews"
        description="Ask the same questions of every document in a set. Every answer is backed by a verbatim quote and page number, checked against the source."
      />
      <QuickStart prominent={reviews?.length === 0} />
      {reviews === null ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : reviews.length === 0 ? (
        <Panel className="flex flex-col items-center gap-4 border-dashed py-16 text-center">
          <p className="eyebrow">No reviews yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Start with one of the suggestions above. It pre-fills the documents and questions, and you can edit both before anything runs.
          </p>
          <Button asChild variant="outline" className="rounded-full px-4"><Link to="/new"><Plus /> Start from scratch</Link></Button>
        </Panel>
      ) : (
        <Panel className="divide-y overflow-hidden">
          <div className="eyebrow grid grid-cols-[1fr_8rem_12rem_6rem_2rem] gap-6 px-6 py-3">
            <span>Name</span><span>Status</span><span>Progress</span><span className="text-right">Tokens</span><span />
          </div>
          {reviews.map((r) => (
            <Link
              key={r.id}
              to={`/reviews/${r.id}`}
              className="group grid grid-cols-[1fr_8rem_12rem_6rem_2rem] items-center gap-6 px-6 py-5 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="truncate font-heading text-base font-medium text-ink">{r.name}</div>
                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {r.total} documents · {r.column_count} questions · {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div><StatusBadge status={r.status} /></div>
              <div className="space-y-1.5">
                <ProgressLine done={r.done} failed={r.failed} total={r.total} />
                <div className="font-mono text-[11px] text-muted-foreground">{r.done + r.failed} / {r.total}</div>
              </div>
              <div className="text-right font-mono text-xs text-muted-foreground">{formatTokens(r.tokens_in + r.tokens_out)}</div>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand" />
            </Link>
          ))}
        </Panel>
      )}
    </>
  )
}


const SUGGESTIONS = [
  { template: 'ha_letters', type: 'ha_letter', title: 'HA commitments', body: 'Commitments, due dates, status and owners across all health-authority letters.' },
  { template: 'stability', type: 'stability_protocol', title: 'Stability protocols', body: 'The same 6 questions of every stability protocol: conditions, timepoints, criteria…' },
  { template: 'cmc', type: 'cmc_section', title: 'CMC excipients', body: 'Excipient grades, justifications and guidance cited in every CMC section.' },
]

function QuickStart({ prominent }: { prominent: boolean }) {
  return (
    <section className="mb-8 space-y-3">
      <div className="eyebrow">{prominent ? 'Try one of these' : 'Quick start'}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map((s, i) => (
          <Link
            key={s.template}
            to={`/new?type=${s.type}&template=${s.template}`}
            className="group rounded-xl border bg-card p-4 transition-colors hover:border-brand/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-brand">{String(i + 1).padStart(2, '0')}</span>
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" />
            </div>
            <div className="mt-3 font-heading text-[15px] font-medium text-ink">{s.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
