import { Download, Loader2, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { api } from '@/api'
import { CellLegend } from '@/components/CellView'
import { EvidencePane } from '@/components/EvidencePane'
import { FilterChips } from '@/components/filter/FilterChips'
import { InlineError } from '@/components/InlineError'
import { PageHeader, Stat } from '@/components/PageHeader'
import { ProgressLine } from '@/components/ProgressLine'
import { ResultsGrid, type SelectedCell } from '@/components/ResultsGrid'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePolling } from '@/hooks/usePolling'
import { useResizableWidth } from '@/hooks/useResizableWidth'
import { useRowFlashes } from '@/hooks/useRowFlashes'
import { formatDuration } from '@/lib/estimate'
import { formatTokens } from '@/lib/format'
import type { Review } from '@/types'

function quoteStats(review: Review) {
  const quotes = review.items.flatMap((i) => Object.values(i.answers ?? {}).flatMap((a) => a.quotes))
  return { total: quotes.length, verified: quotes.filter((q) => q.verified).length }
}

/** Throughput-based ETA for the current run: elapsed / finished × remaining. */
function eta(review: Review): number | null {
  const remaining = review.queued + review.running
  if (!remaining || !review.started_at || !review.finished_this_run) return null
  const elapsed = (Date.now() - new Date(review.started_at).getTime()) / 1000
  return (elapsed / review.finished_this_run) * remaining
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
}

export function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [review, setReview] = useState<Review | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'export' | 'retry' | null>(null)
  const { width, startDrag } = useResizableWidth('evidence-pane-width')
  const flashes = useRowFlashes(review?.items)

  // Selection lives in the URL so any answer can be linked to: ?doc=…&col=…
  const selected: SelectedCell | null =
    params.get('doc') && params.get('col') ? { documentId: params.get('doc')!, columnKey: params.get('col')! } : null
  const panelOpen = Boolean(selected) && params.get('panel') !== '0'

  const select = useCallback(
    (cell: SelectedCell | null, open?: boolean) => {
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (cell) {
            next.set('doc', cell.documentId)
            next.set('col', cell.columnKey)
          } else {
            next.delete('doc')
            next.delete('col')
          }
          if (open === false) next.set('panel', '0')
          else if (open === true) next.delete('panel')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const load = useCallback(() => {
    if (!id) return
    api.review(id).then(setReview).catch((e) => setLoadError(e.message))
  }, [id])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, Boolean(review && (review.status === 'running' || review.queued + review.running > 0)))

  // Arrow keys move the selection; Enter opens the evidence pane; Esc closes it.
  useEffect(() => {
    if (!review) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return
      const rows = review.items
      const cols = review.columns
      if (!rows.length || !cols.length) return
      if (e.key === 'Escape' && panelOpen) {
        e.preventDefault()
        select(selected, false)
        return
      }
      if (e.key === 'Enter' && selected) {
        e.preventDefault()
        select(selected, !panelOpen)
        return
      }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      const r = selected ? rows.findIndex((i) => i.document_id === selected.documentId) : -1
      const c = selected ? cols.findIndex((x) => x.key === selected.columnKey) : -1
      const nr = r < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, r + move[0]))
      const nc = c < 0 ? 0 : Math.min(cols.length - 1, Math.max(0, c + move[1]))
      select({ documentId: rows[nr].document_id, columnKey: cols[nc].key })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [review, selected, panelOpen, select])

  const quotes = useMemo(() => (review ? quoteStats(review) : { total: 0, verified: 0 }), [review])

  if (loadError) return <InlineError message={loadError} />
  if (!review) return <Skeleton className="h-96 w-full rounded-xl" />

  const finished = review.done + review.failed
  const running = review.queued + review.running > 0
  const remaining = eta(review)
  const item = selected ? review.items.find((i) => i.document_id === selected.documentId) ?? null : null
  const column = selected ? review.columns.find((c) => c.key === selected.columnKey) ?? null : null

  const exportCsv = async () => {
    setBusy('export')
    setActionError(null)
    try {
      await api.downloadCsv(review.id)
    } catch {
      setActionError('Export failed — the API may be down. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const retry = async () => {
    setBusy('retry')
    setActionError(null)
    try {
      setReview(await api.retryFailed(review.id))
    } catch (e) {
      setActionError(`Retry failed: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={<><Link to="/" className="hover:text-ink">Reviews</Link> / Review</>}
        title={<span className="flex items-center gap-3">{review.name} <StatusBadge status={review.status} /></span>}
        actions={
          <>
            {review.failed > 0 && !running && (
              <Button variant="outline" className="rounded-full bg-card px-4" onClick={retry} disabled={busy !== null}>
                {busy === 'retry' ? <Loader2 className="animate-spin" /> : <RotateCcw />} Retry {review.failed} failed
              </Button>
            )}
            <Button className="rounded-full px-4" onClick={exportCsv} disabled={busy !== null}>
              {busy === 'export' ? <Loader2 className="animate-spin" /> : <Download />} Export CSV
            </Button>
          </>
        }
      >
        <FilterChips filter={review.filter} />
      </PageHeader>

      <InlineError message={actionError} onDismiss={() => setActionError(null)} className="-mt-4 mb-4" />

      <div className="mb-5 grid grid-cols-2 gap-x-10 gap-y-4 sm:grid-cols-5">
        <div className="col-span-2 space-y-2">
          <div className="eyebrow flex justify-between">
            <span>Progress</span>
            <span className="text-ink">{finished} / {review.total}</span>
          </div>
          <ProgressLine done={review.done} failed={review.failed} total={review.total} className="h-1.5" />
          {running && (
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-brand" />
              {review.running} running · {review.queued} queued
              {remaining !== null && <span className="text-ink">· ~{formatDuration(remaining)} remaining</span>}
            </div>
          )}
        </div>
        <Stat label="Done" value={review.done} tone="success" />
        <Stat label="Citations verified" value={`${quotes.verified}/${quotes.total}`} />
        <Stat label="Tokens in / out" value={<span className="font-mono text-base">{formatTokens(review.tokens_in)} / {formatTokens(review.tokens_out)}</span>} />
      </div>

      {review.failed > 0 && (
        <InlineError
          className="mb-4"
          message={`${review.failed} document${review.failed === 1 ? '' : 's'} failed${running ? ' so far' : ''} — failed rows are marked in red; hover a cell for the reason.${running ? '' : ' Use “Retry failed” to run them again.'}`}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <CellLegend />
        <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          ←↑↓→ move · Enter open · Esc close · J/K quotes
        </span>
      </div>

      <div className="flex h-[calc(100svh-6rem)] min-h-[28rem] gap-0">
        <div className="min-w-0 flex-1">
          <ResultsGrid
            columns={review.columns}
            items={review.items}
            selected={selected}
            flashes={flashes}
            onSelect={(cell) => select(cell, true)}
          />
        </div>
        {panelOpen && item && column && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize evidence pane"
              onPointerDown={startDrag}
              className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
            >
              <span className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-brand" />
            </div>
            <div style={{ width }} className="shrink-0">
              <EvidencePane item={item} column={column} onClose={() => select(selected, false)} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
