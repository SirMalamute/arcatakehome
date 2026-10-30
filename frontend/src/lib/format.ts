import type { Condition, DateRange, FilterField } from '@/types'

export const TYPE_LABELS: Record<string, string> = {
  ha_letter: 'HA letter',
  stability_protocol: 'Stability protocol',
  cmc_section: 'CMC section',
  csr: 'CSR',
  protocol: 'Protocol',
  sop: 'SOP',
  deviation: 'Deviation',
  other: 'Other',
}

export const AUTHORITY_LABELS: Record<string, string> = {
  FDA: 'FDA',
  EMA: 'EMA',
  HC: 'Health Canada',
  PMDA: 'PMDA',
  MHRA: 'MHRA',
  other: 'Other',
  none: 'None',
}

export const ALL_TYPES = Object.keys(TYPE_LABELS)
export const ALL_AUTHORITIES = Object.keys(AUTHORITY_LABELS)

export type ValueKind = 'enum' | 'enum_list' | 'date' | 'date_range' | 'word' | 'word_list'

export const FIELDS: Record<FilterField, { label: string; operators: Record<string, { label: string; kind: ValueKind }> }> = {
  type: {
    label: 'Type',
    operators: { is: { label: 'is', kind: 'enum' }, in: { label: 'is any of', kind: 'enum_list' } },
  },
  authority: {
    label: 'Authority',
    operators: { is: { label: 'is', kind: 'enum' }, in: { label: 'is any of', kind: 'enum_list' } },
  },
  product: {
    label: 'Product',
    operators: { is: { label: 'is', kind: 'enum' }, in: { label: 'is any of', kind: 'enum_list' } },
  },
  date: {
    label: 'Date',
    operators: {
      before: { label: 'before', kind: 'date' },
      after: { label: 'after', kind: 'date' },
      between: { label: 'between', kind: 'date_range' },
    },
  },
  text: {
    label: 'Text',
    operators: {
      contains_all: { label: 'contains all of', kind: 'word_list' },
      contains_any: { label: 'contains any of', kind: 'word_list' },
      contains_phrase: { label: 'contains phrase', kind: 'word' },
    },
  },
}

export function valueKind(c: Condition): ValueKind {
  return FIELDS[c.field].operators[c.operator]?.kind ?? 'enum'
}

export function emptyValue(kind: ValueKind): Condition['value'] {
  if (kind === 'enum_list' || kind === 'word_list') return []
  if (kind === 'date_range') return { from: '', to: '' }
  return ''
}

export function isComplete(c: Condition): boolean {
  const v = c.value
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') return Boolean(v.from && v.to)
  return Boolean(v)
}

function valueLabel(field: FilterField, v: string): string {
  if (field === 'type') return TYPE_LABELS[v] ?? v
  if (field === 'authority') return AUTHORITY_LABELS[v] ?? v
  return v
}

export function conditionLabel(c: Condition): string {
  const field = FIELDS[c.field]
  const op = field.operators[c.operator]?.label ?? c.operator
  let value: string
  if (Array.isArray(c.value)) value = c.value.map((v) => valueLabel(c.field, v)).join(', ')
  else if (typeof c.value === 'object') value = `${(c.value as DateRange).from} – ${(c.value as DateRange).to}`
  else value = c.field === 'text' ? `"${c.value}"` : valueLabel(c.field, c.value)
  return `${field.label} ${op} ${value}`
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join('; ')
  return String(value).replaceAll('_', ' ')
}

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
