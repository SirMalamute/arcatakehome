import { ArrowLeft, ArrowRight, Loader2, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { api } from '@/api'
import { ColumnEditor, withKeys } from '@/components/ColumnEditor'
import { DocumentResults } from '@/components/DocumentResults'
import { DocumentSearch } from '@/components/DocumentSearch'
import { FilterChips } from '@/components/filter/FilterChips'
import { InlineError } from '@/components/InlineError'
import { PageHeader } from '@/components/PageHeader'
import { PreviewPanel } from '@/components/PreviewPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDocumentSearch } from '@/hooks/useDocumentSearch'
import { useFacets } from '@/hooks/useFacets'
import { estimate, formatDuration, formatUsd } from '@/lib/estimate'
import { formatTokens } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Column, Filter, Template } from '@/types'

export function NewReviewPage() {
  const navigate = useNavigate()
  const facets = useFacets()
  const [params] = useSearchParams()
  const [step, setStep] = useState<1 | 2>(1)
  // ?type=ha_letter&template=ha_letters presets the review (used by the "Try" suggestion).
  const [filter, setFilter] = useState<Filter>(() =>
    params.get('type') ? { conditions: [{ field: 'type', operator: 'is', value: params.get('type')! }] } : { conditions: [] },
  )
  const { documents, total, loading, error: searchError, effectiveFilter } = useDocumentSearch(filter)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [templates, setTemplates] = useState<Template[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Every matching document starts selected; the user can uncheck.
  useEffect(() => setSelected(new Set(documents.map((d) => d.id))), [documents])
  useEffect(() => {
    api
      .templates()
      .then((ts) => {
        setTemplates(ts)
        const preset = ts.find((t) => t.id === params.get('template'))
        if (preset) {
          setTemplateId(preset.id)
          setColumns(preset.columns)
          setName(preset.name)
        }
      })
      .catch(() => setError('Could not load templates — is the API running?'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pickTemplate = (t: Template) => {
    setTemplateId(t.id)
    setColumns(t.columns)
    if (!name) setName(t.name)
  }

  const valid = name.trim() && columns.length > 0 && columns.every((c) => c.label.trim() && c.question.trim())

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const review = await api.createReview({
        name: name.trim(),
        filter: effectiveFilter,
        document_ids: [...selected],
        columns: withKeys(columns),
      })
      await api.runReview(review.id)
      navigate(`/reviews/${review.id}`)
    } catch (e) {
      setError(`Couldn't start the review: ${(e as Error).message}`)
      setCreating(false)
    }
  }

  const stepper = (
    <div className="flex items-center gap-3 font-mono text-[11px] tracking-wider uppercase">
      {['Select documents', 'Define questions'].map((label, i) => {
        const n = (i + 1) as 1 | 2
        const active = step === n
        return (
          <button
            key={label}
            disabled={n === 2 && !selected.size}
            onClick={() => setStep(n)}
            className={cn('flex items-center gap-2 transition-colors', active ? 'text-ink' : 'text-muted-foreground hover:text-ink')}
          >
            <span className={cn('flex size-5 items-center justify-center rounded-full border text-[10px]', active && 'border-brand bg-brand text-white')}>
              {n}
            </span>
            {label}
            {i === 0 && <span className="ml-1 h-px w-10 bg-border" />}
          </button>
        )
      })}
    </div>
  )

  if (step === 1) {
    return (
      <>
        <PageHeader
          index="01"
          eyebrow="New review"
          title="Which documents?"
          description="Describe the set in plain English or build filters. Nothing runs until you confirm."
        >
          {stepper}
        </PageHeader>
        <div className="space-y-6">
          <DocumentSearch filter={filter} facets={facets} onChange={setFilter} />
          <div className="sticky top-14 z-20 -mx-2 flex items-center justify-between rounded-xl bg-background/85 px-2 py-2 backdrop-blur-md">
            <span className="eyebrow">
              {searchError ? <span className="text-destructive">{searchError}</span> : <><span className="text-ink">{selected.size}</span> of {total} selected</>}
            </span>
            <Button className="rounded-full px-5" disabled={!selected.size} onClick={() => setStep(2)}>
              Confirm {selected.size} document{selected.size === 1 ? '' : 's'} <ArrowRight />
            </Button>
          </div>
          <DocumentResults
            documents={documents}
            loading={loading}
            selection={{ selected, onChange: setSelected }}
            onClearFilters={() => setFilter({ conditions: [] })}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        index="02"
        eyebrow="New review"
        title="What do you want to know?"
        description={`Each question becomes a column. It is asked of all ${selected.size} documents, and every answer must cite the source.`}
      >
        {stepper}
        <FilterChips filter={effectiveFilter} />
      </PageHeader>

      <div className="space-y-10">
        <section className="space-y-3">
          <div className="eyebrow">Start from a template</div>
          <div className="grid gap-3 sm:grid-cols-3">
            {templates.map((t, i) => (
              <button
                key={t.id}
                onClick={() => pickTemplate(t)}
                className={cn(
                  'group rounded-xl border bg-card p-5 text-left transition-all hover:border-brand/40',
                  templateId === t.id && 'border-brand shadow-[0_0_0_1px_var(--brand)]',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-brand">{String(i + 1).padStart(2, '0')}</span>
                  <span className="eyebrow">{t.columns.length} questions</span>
                </div>
                <div className="mt-4 font-heading text-[15px] font-medium text-ink">{t.name}</div>
                <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="eyebrow">Questions</div>
          {columns.length === 0 && (
            <p className="text-sm text-muted-foreground">Pick a template above, or add your own questions. Each one becomes a column in the results grid.</p>
          )}
          <ColumnEditor columns={columns} onChange={setColumns} />
        </section>

        {columns.length > 0 && (
          <PreviewPanel
            documents={documents.filter((d) => selected.has(d.id))}
            columns={columns}
            disabled={!columns.every((c) => c.label.trim() && c.question.trim())}
          />
        )}

        <InlineError message={error} onDismiss={() => setError(null)} />

        <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-5">
          <div className="max-w-sm flex-1 space-y-1.5">
            <Label htmlFor="name" className="eyebrow">Review name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 HA commitments" />
          </div>
          {columns.length > 0 && <Estimate documents={selected.size} questions={columns.length} />}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="rounded-full px-4" onClick={() => setStep(1)}>
              <ArrowLeft /> Back
            </Button>
            <Button className="rounded-full px-5" disabled={!valid || creating} onClick={create}>
              {creating ? <Loader2 className="animate-spin" /> : <Play />}
              Run on {selected.size} documents
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}

function Estimate({ documents, questions }: { documents: number; questions: number }) {
  const e = estimate(documents, questions)
  return (
    <div className="space-y-1" title="Rough: ~1k tokens per document per question, ~25s per document across 10 workers">
      <div className="eyebrow">Estimate</div>
      <div className="font-mono text-xs text-ink">
        {documents} docs × {questions} questions ≈ {formatTokens(e.tokens)} tokens · ~{formatUsd(e.usd)} · ~{formatDuration(e.seconds)}
      </div>
    </div>
  )
}
