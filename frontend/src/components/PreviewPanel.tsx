import { AlertTriangle, CircleCheck, FlaskConical, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { api } from '@/api'
import { withKeys } from '@/components/ColumnEditor'
import { InlineError } from '@/components/InlineError'
import { Panel } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isNotStated } from '@/lib/answers'
import { formatTokens, formatValue } from '@/lib/format'
import type { Column, DocumentSummary, PreviewResult } from '@/types'

/** Run the questions on one document before committing to all of them. */
export function PreviewPanel({ documents, columns, disabled }: {
  documents: DocumentSummary[]
  columns: Column[]
  disabled: boolean
}) {
  const [docId, setDocId] = useState<string | undefined>(documents[0]?.id)
  const [result, setResult] = useState<{ columns: Column[]; data: PreviewResult } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!docId) return
    const cols = withKeys(columns)
    setLoading(true)
    setError(null)
    try {
      setResult({ columns: cols, data: await api.preview(docId, cols) })
    } catch (e) {
      setError(`Preview failed: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Panel className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <div className="eyebrow">Preview</div>
          <p className="mt-1 text-sm text-muted-foreground">Check the wording on one document before spending tokens on all of them.</p>
        </div>
        <Select value={docId} onValueChange={setDocId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Pick a document" /></SelectTrigger>
          <SelectContent>
            {documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" className="rounded-full px-4" onClick={run} disabled={disabled || loading || !docId}>
          {loading ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          {loading ? 'Running…' : 'Preview on 1 document'}
        </Button>
      </div>

      <InlineError message={error} onDismiss={() => setError(null)} />

      {result && (
        <div className="divide-y rounded-lg border">
          {result.columns.map((c) => {
            const a = result.data.answers[c.key]
            const unverified = a?.quotes.some((q) => !q.verified)
            return (
              <div key={c.key} className="grid grid-cols-[12rem_1fr] gap-4 px-4 py-3 text-sm">
                <span className="font-medium text-ink">{c.label}</span>
                <div className="space-y-1">
                  {!a || a.status === 'not_found' ? (
                    <span className="text-muted-foreground">— Not found</span>
                  ) : isNotStated(a.value) ? (
                    <span className="text-warning">Not stated</span>
                  ) : (
                    <span className="text-ink">{formatValue(a.value)}</span>
                  )}
                  {a && a.quotes.length > 0 && (
                    <div className={`flex items-center gap-1.5 font-mono text-[10px] ${unverified ? 'text-warning' : 'text-success'}`}>
                      {unverified ? <AlertTriangle className="size-3" /> : <CircleCheck className="size-3" />}
                      {a.quotes.length} cite{a.quotes.length === 1 ? '' : 's'} · p.{[...new Set(a.quotes.map((q) => q.page))].join(', ')}
                      {unverified ? ' · not all verified' : ' · verified'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
            {formatTokens(result.data.tokens_in)} in / {formatTokens(result.data.tokens_out)} out tokens for this document
          </div>
        </div>
      )}
    </Panel>
  )
}
