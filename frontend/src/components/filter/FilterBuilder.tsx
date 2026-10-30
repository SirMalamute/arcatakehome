import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FIELDS, emptyValue } from '@/lib/format'
import type { Condition, Facets, Filter, FilterField } from '@/types'

import { ValueInput } from './ValueInput'

function newCondition(field: FilterField): Condition {
  const [operator, { kind }] = Object.entries(FIELDS[field].operators)[0]
  return { field, operator, value: emptyValue(kind) }
}

/** Flat list of conditions, all ANDed. */
export function FilterBuilder({ filter, facets, onChange }: {
  filter: Filter
  facets: Facets | null
  onChange: (f: Filter) => void
}) {
  const update = (i: number, c: Condition) =>
    onChange({ conditions: filter.conditions.map((x, j) => (j === i ? c : x)) })
  const remove = (i: number) => onChange({ conditions: filter.conditions.filter((_, j) => j !== i) })

  return (
    <div className="space-y-2">
      {filter.conditions.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-12 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">{i === 0 ? 'Where' : 'and'}</span>
          <Select value={c.field} onValueChange={(f) => update(i, newCondition(f as FilterField))}>
            <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FIELDS).map(([key, f]) => (
                <SelectItem key={key} value={key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={c.operator}
            onValueChange={(op) => {
              const kind = FIELDS[c.field].operators[op].kind
              const sameKind = FIELDS[c.field].operators[c.operator]?.kind === kind
              update(i, { ...c, operator: op, value: sameKind ? c.value : emptyValue(kind) })
            }}
          >
            <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FIELDS[c.field].operators).map(([key, op]) => (
                <SelectItem key={key} value={key}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ValueInput condition={c} facets={facets} onChange={(value) => update(i, { ...c, value })} />
          <Button variant="ghost" size="icon-sm" aria-label="Remove filter" onClick={() => remove(i)}>
            <X />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => onChange({ conditions: [...filter.conditions, newCondition('type')] })}
      >
        <Plus /> Add filter
      </Button>
    </div>
  )
}
