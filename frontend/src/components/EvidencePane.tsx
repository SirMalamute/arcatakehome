import { AlertTriangle, Check, ChevronLeft, ChevronRight, CircleCheck, Copy, Link2, X } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { isNotStated } from '@/lib/answers'
import { formatValue } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Column, DocumentFull, Quote, ReviewItem } from '@/types'

const docCache = new Map<string, Promise<DocumentFull>>()
function loadDocument(id: string) {
  if (!docCache.has(id)) docCache.set(id, api.document(id))
  return docCache.get(id)!
}

/** Where the quote sits in the page: server-computed offsets, else a whitespace-insensitive search. */
function locate(page: string, q: Quote): [number, number] | null {
  if (q.start != null && q.end != null && q.end <= page.length) return [q.start, q.end]
  return findQuote(page, q.text)
}

function findQuote(page: string, quote: string): [number, number] | null {
  const words = quote.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!words.length) return null
  const m = new RegExp(words.join('\\s+'), 'i').exec(page)
  return m ? [m.index, m.index + m[0].length] : null
}

interface Span {
  start: number
  end: number
  active: boolean
}

/** Every quote on the page is highlighted; the selected one is emphasized and scrolled into view. */
function PageText({ text, quotes, activeText, scrollKey }: {
  text: string
  quotes: Quote[]
  activeText: string | null
  scrollKey: number
}) {
  const activeRef = useRef<HTMLElement>(null)
  const spans = useMemo(() => {
    const found = quotes
      .map((q) => {
        const m = locate(text, q)
        return m && { start: m[0], end: m[1], active: q.text === activeText }
      })
      .filter((s): s is Span => s !== null)
      .sort((a, b) => a.start - b.start)
    // Merge overlapping spans (two quotes can share text).
    const merged: Span[] = []
    for (const s of found) {
      const last = merged.at(-1)
      if (last && s.start <= last.end) {
        last.end = Math.max(last.end, s.end)
        last.active ||= s.active
      } else merged.push({ ...s })
    }
    return merged
  }, [text, quotes, activeText])

  // Scroll only when the user picks a quote, not when the panel first opens.
  useEffect(() => {
    if (scrollKey) activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [scrollKey])

  const parts: ReactNode[] = []
  let cursor = 0
  spans.forEach((s, i) => {
    parts.push(text.slice(cursor, s.start))
    parts.push(
      <mark
        key={i}
        ref={s.active ? activeRef : undefined}
        className={cn(
          'rounded-sm px-0.5 text-ink transition-colors',
          s.active ? 'bg-brand/25 shadow-[inset_0_-2px_0_var(--brand)]' : 'bg-brand/10 shadow-[inset_0_-1px_0_var(--brand)]',
        )}
      >
        {text.slice(s.start, s.end)}
      </mark>,
    )
    cursor = s.end
  })
  parts.push(text.slice(cursor))
  return <>{parts}</>
}

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  return Boolean(t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))
}

function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500)
    })
  }
  return [copied, copy]
}

/** Docked evidence pane: answer, quotes (J/K to step), and the source page with matches highlighted. */
export function EvidencePane({ item, column, onClose }: {
  item: ReviewItem
  column: Column
  onClose: () => void
}) {
  const [doc, setDoc] = useState<DocumentFull | null>(null)
  const answer = item.answers?.[column.key]
  const quotes = answer?.quotes ?? []
  const firstPage = quotes[0]?.page ?? 1
  const [page, setPage] = useState(firstPage)
  const [activeQuote, setActiveQuote] = useState<number | null>(quotes.length ? 0 : null)
  const [scrollKey, setScrollKey] = useState(0)
  const [copied, copy] = useCopy()

  useEffect(() => {
    setDoc(null)
    loadDocument(item.document_id).then(setDoc)
  }, [item.document_id])

  useEffect(() => {
    setPage(firstPage)
    setActiveQuote(quotes.length ? 0 : null)
  }, [item.document_id, column.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectQuote = (i: number) => {
    setActiveQuote(i)
    setPage(quotes[i].page)
    setScrollKey((k) => k + 1)
  }

  // J / K step through quotes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.metaKey || e.ctrlKey || !quotes.length) return
      const key = e.key.toLowerCase()
      if (key !== 'j' && key !== 'k') return
      e.preventDefault()
      const cur = activeQuote ?? -1
      selectQuote(key === 'j' ? Math.min(quotes.length - 1, cur + 1) : Math.max(0, cur - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // re-bind each render so it sees current state

  const pageQuotes = useMemo(() => quotes.filter((q) => q.page === page), [quotes, page])
  const citation = (q: Quote) => `"${q.text.replace(/\s+/g, ' ').trim()}" — ${item.title}, p.${q.page}`

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
      <div className="space-y-2 border-b px-5 py-4">
        <div className="flex items-start gap-2">
          <div className="eyebrow min-w-0 flex-1 truncate">{item.title}</div>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Copy link to this answer"
            title="Copy link to this answer"
            onClick={() => copy('link', window.location.href)}
          >
            {copied === 'link' ? <Check className="text-success" /> : <Link2 />}
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Close (Esc)" title="Close (Esc)" onClick={onClose}>
            <X />
          </Button>
        </div>
        <h2 className="font-heading text-lg font-medium text-ink">{column.label}</h2>
        <p className="text-[13px] text-muted-foreground">{column.question}</p>
      </div>

      <div className="flex-1 space-y-7 overflow-auto px-5 py-5">
        <section className="space-y-2">
          <div className="eyebrow">Answer</div>
          {item.status === 'failed' ? (
            <p className="text-sm text-destructive">Failed: {item.error}</p>
          ) : !answer ? (
            <p className="text-sm text-muted-foreground">Not answered yet</p>
          ) : answer.status === 'not_found' ? (
            <p className="text-sm text-muted-foreground">Not found in this document</p>
          ) : isNotStated(answer.value) ? (
            <p className="text-sm text-warning">Not stated — the document addresses this but doesn't say.</p>
          ) : Array.isArray(answer.value) ? (
            <ul className="space-y-1.5">
              {answer.value.map((v, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-snug text-ink">
                  <span className="font-mono text-[11px] leading-6 text-brand">{String(i + 1).padStart(2, '0')}</span>
                  {String(v)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-heading text-lg leading-snug text-ink">{formatValue(answer.value)}</p>
          )}
        </section>

        {quotes.length > 0 && (
          <section className="space-y-3">
            <div className="eyebrow flex justify-between">
              <span>Evidence</span>
              <span className="normal-case tracking-normal">
                <kbd className="rounded border bg-background px-1">J</kbd> / <kbd className="rounded border bg-background px-1">K</kbd> to step
              </span>
            </div>
            {quotes.map((q, i) => (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => selectQuote(i)}
                onKeyDown={(e) => e.key === 'Enter' && selectQuote(i)}
                className={cn(
                  'group/q relative cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:border-brand/40',
                  activeQuote === i && 'border-brand/60 bg-brand/[0.03]',
                )}
              >
                <button
                  className="absolute top-2.5 right-2.5 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover/q:opacity-100 hover:bg-muted hover:text-ink focus-visible:opacity-100"
                  aria-label="Copy quote with citation"
                  title="Copy quote with citation"
                  onClick={(e) => {
                    e.stopPropagation()
                    copy(`q${i}`, citation(q))
                  }}
                >
                  {copied === `q${i}` ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                </button>
                <span className={cn('block border-l-2 pr-6 pl-3 text-[13px] leading-relaxed text-ink', q.verified ? 'border-brand' : 'border-warning')}>
                  {q.text}
                </span>
                <span className="mt-3 flex items-center gap-3 font-mono text-[10px] tracking-wide uppercase">
                  <span className="text-ink">Page {q.page}</span>
                  {q.verified ? (
                    <span className="flex items-center gap-1 text-success"><CircleCheck className="size-3" /> Verified in source</span>
                  ) : (
                    <span className="flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> Not found verbatim</span>
                  )}
                  <span className="ml-auto text-muted-foreground">
                    {copied === `q${i}` ? <span className="text-success">Copied</span> : `Match ${q.score}%`}
                  </span>
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Source</span>
            {doc && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                  <ChevronLeft />
                </Button>
                <span className="font-mono text-[11px] text-muted-foreground">Page {page} / {doc.page_count}</span>
                <Button variant="ghost" size="icon-sm" disabled={page >= doc.page_count} onClick={() => setPage(page + 1)} aria-label="Next page">
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
          {doc ? (
            <div className="rounded-lg border bg-background/60 p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink/85">
              <PageText
                text={doc.pages[page - 1] ?? ''}
                quotes={pageQuotes}
                activeText={activeQuote !== null ? quotes[activeQuote]?.text ?? null : null}
                scrollKey={scrollKey}
              />
            </div>
          ) : (
            <Skeleton className="h-64 w-full rounded-lg" />
          )}
        </section>
      </div>
    </aside>
  )
}
