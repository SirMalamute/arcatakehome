import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_AUTHORITIES, ALL_TYPES, AUTHORITY_LABELS, TYPE_LABELS, valueKind } from '@/lib/format'
import type { Condition, DateRange, Facets } from '@/types'

import { DatePicker } from './DatePicker'
import { MultiSelect } from './MultiSelect'
import { TagInput } from './TagInput'

function enumOptions(field: Condition['field'], facets: Facets | null): { options: string[]; labels: Record<string, string> } {
  if (field === 'type') return { options: ALL_TYPES, labels: TYPE_LABELS }
  if (field === 'authority') return { options: ALL_AUTHORITIES, labels: AUTHORITY_LABELS }
  return { options: facets?.products ?? [], labels: {} }
}

export function ValueInput({ condition, facets, onChange }: {
  condition: Condition
  facets: Facets | null
  onChange: (value: Condition['value']) => void
}) {
  const kind = valueKind(condition)
  const v = condition.value

  switch (kind) {
    case 'enum': {
      const { options, labels } = enumOptions(condition.field, facets)
      return (
        <Select value={v as string} onValueChange={onChange}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>{labels[o] ?? o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case 'enum_list': {
      const { options, labels } = enumOptions(condition.field, facets)
      return <MultiSelect options={options} labels={labels} value={v as string[]} onChange={onChange} />
    }
    case 'date':
      return <DatePicker value={v as string} onChange={onChange} />
    case 'date_range': {
      const r = v as DateRange
      return (
        <div className="flex items-center gap-2">
          <DatePicker value={r.from} placeholder="From" onChange={(from) => onChange({ ...r, from })} />
          <span className="text-xs text-muted-foreground">and</span>
          <DatePicker value={r.to} placeholder="To" onChange={(to) => onChange({ ...r, to })} />
        </div>
      )
    }
    case 'word':
      return <Input className="h-7 w-56" value={v as string} placeholder="exact phrase" onChange={(e) => onChange(e.target.value)} />
    case 'word_list':
      return <TagInput value={v as string[]} onChange={onChange} />
  }
}
