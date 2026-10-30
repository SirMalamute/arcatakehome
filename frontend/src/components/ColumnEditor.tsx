import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Column, ColumnType } from '@/types'

const TYPES: { value: ColumnType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'A short free-text answer, e.g. a justification or a name and role.' },
  { value: 'list', label: 'List', hint: 'Several separate items, e.g. every commitment in a letter. Shown one per line.' },
  { value: 'date', label: 'Date', hint: 'A single date, returned as YYYY-MM-DD so the column sorts and exports cleanly.' },
  { value: 'number', label: 'Number', hint: 'A single numeric value, e.g. a shelf life in months.' },
  { value: 'boolean', label: 'Yes / No', hint: 'A yes/no judgement. Phrase the question so "yes" has one clear meaning.' },
  { value: 'enum', label: 'One of…', hint: 'Exactly one of the options you list. Add a "not_stated" option when the document may be silent.' },
]

function slug(label: string): string {
  const s = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return /^[a-z]/.test(s) ? s : `q_${s}`.slice(0, 40)
}

/** Derive unique, schema-safe keys from labels. */
export function withKeys(columns: Column[]): Column[] {
  const used = new Set<string>()
  return columns.map((c) => {
    let key = c.key || slug(c.label || 'question')
    for (let n = 2; used.has(key); n++) key = `${slug(c.label || 'question').slice(0, 36)}_${n}`
    used.add(key)
    return { ...c, key }
  })
}

export function ColumnEditor({ columns, onChange }: { columns: Column[]; onChange: (c: Column[]) => void }) {
  const update = (i: number, patch: Partial<Column>) =>
    onChange(columns.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <div className="space-y-3">
      {columns.map((c, i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          {/* Header: number, label (reads as a title), type, remove */}
          <div className="flex items-center gap-3">
            <span className="w-6 shrink-0 font-mono text-[10px] text-brand">{String(i + 1).padStart(2, '0')}</span>
            <input
              value={c.label}
              placeholder="Column label"
              aria-label="Column label"
              className="h-8 min-w-0 flex-1 bg-transparent font-heading text-[15px] font-medium text-ink outline-none placeholder:text-muted-foreground"
              onChange={(e) => update(i, { label: e.target.value, key: '' })}
            />
            <Select value={c.type} onValueChange={(t) => update(i, { type: t as ColumnType, options: t === 'enum' ? c.options ?? [] : null })}>
              <SelectTrigger size="sm" className="w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon-sm" aria-label="Remove column" onClick={() => onChange(columns.filter((_, j) => j !== i))}>
              <X />
            </Button>
          </div>
          {/* Body aligns with the label text (number column + gap). */}
          <div className="mt-3 space-y-2 pl-9">
            <Textarea
              value={c.question}
              rows={2}
              placeholder="The question to ask of each document"
              className="min-h-0 resize-none bg-background px-3 py-2 text-sm md:text-sm"
              onChange={(e) => update(i, { question: e.target.value })}
            />
            {c.type === 'enum' && (
              <Input
                className="bg-background px-3 text-sm md:text-sm"
                placeholder="Options, comma-separated"
                defaultValue={(c.options ?? []).join(', ')}
                onBlur={(e) => update(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            )}
            <p className="text-xs text-muted-foreground">{TYPES.find((t) => t.value === c.type)?.hint}</p>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        className="w-full rounded-xl border-dashed bg-transparent text-muted-foreground hover:text-ink"
        onClick={() => onChange([...columns, { key: '', label: '', question: '', type: 'text' }])}
      >
        <Plus /> Add question
      </Button>
    </div>
  )
}
