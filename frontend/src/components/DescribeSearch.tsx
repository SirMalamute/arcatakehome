import { ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { api } from '@/api'
import { InlineError } from '@/components/InlineError'
import { Button } from '@/components/ui/button'
import type { Filter } from '@/types'

const EXAMPLES = [
  'Health Canada letters before 2024 mentioning stability',
  'CMC sections for BRX-101',
  'Stability protocols from 2021 onward',
]

export function DescribeSearch({ onFilter }: { onFilter: (f: Filter, explanation: string) => void }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (value = text) => {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { filter, explanation } = await api.filterFromText(value)
      onFilter(filter, explanation)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full border bg-background py-1.5 pr-1.5 pl-4 transition-colors focus-within:border-brand">
        <Sparkles className="size-4 shrink-0 text-brand" />
        <input
          value={text}
          placeholder="Describe the documents you want…"
          className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button size="sm" className="rounded-full px-4" onClick={() => submit()} disabled={loading || !text.trim()}>
          {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
          Build filters
        </Button>
      </div>
      <InlineError message={error} onDismiss={() => setError(null)} />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setText(ex)
              submit(ex)
            }}
            className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-brand/40 hover:text-ink"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}
