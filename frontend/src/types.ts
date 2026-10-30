export type DocType =
  | 'ha_letter'
  | 'stability_protocol'
  | 'cmc_section'
  | 'csr'
  | 'protocol'
  | 'sop'
  | 'deviation'
  | 'other'

export type Authority = 'FDA' | 'EMA' | 'HC' | 'PMDA' | 'MHRA' | 'other' | 'none'

export interface DocumentSummary {
  id: string
  title: string
  filename: string
  file_ext: string
  type: DocType
  authority: Authority
  product: string | null
  date: string | null
  page_count: number
  created_at: string
}

export interface DocumentFull extends DocumentSummary {
  pages: string[]
}

export interface Facets {
  types: string[]
  authorities: string[]
  products: string[]
  min_date: string | null
  max_date: string | null
  total: number
}

// --- Filters -----------------------------------------------------------------

export type FilterField = 'type' | 'authority' | 'product' | 'date' | 'text'
export type DateRange = { from: string; to: string }
export type ConditionValue = string | string[] | DateRange

export interface Condition {
  field: FilterField
  operator: string
  value: ConditionValue
}

export interface Filter {
  conditions: Condition[]
}

// --- Reviews -----------------------------------------------------------------

export type ColumnType = 'text' | 'date' | 'number' | 'boolean' | 'enum' | 'list'

export interface Column {
  key: string
  label: string
  question: string
  type: ColumnType
  options?: string[] | null
}

export interface Template {
  id: string
  name: string
  description: string
  columns: Column[]
}

export interface Quote {
  text: string
  page: number
  verified: boolean
  score: number
  /** Character offsets of the verified match in the page text. */
  start?: number | null
  end?: number | null
}

export interface Answer {
  status: 'found' | 'not_found'
  value: unknown
  quotes: Quote[]
}

export type ItemStatus = 'queued' | 'running' | 'done' | 'failed'
export type ReviewStatus = 'draft' | 'running' | 'complete'

export interface ReviewItem {
  document_id: string
  status: ItemStatus
  answers: Record<string, Answer> | null
  error: string | null
  tokens_in: number
  tokens_out: number
  title: string
  type: DocType
  authority: Authority
  product: string | null
  date: string | null
  page_count: number
}

export interface Progress {
  total: number
  done: number
  failed: number
  running: number
  queued: number
  tokens_in: number
  tokens_out: number
  finished_this_run: number
}

export interface ReviewSummary extends Progress {
  id: string
  name: string
  status: ReviewStatus
  created_at: string
  column_count: number
}

export interface Review extends Progress {
  id: string
  name: string
  status: ReviewStatus
  created_at: string
  started_at: string | null
  filter: Filter
  columns: Column[]
  items: ReviewItem[]
}

export interface PreviewResult {
  answers: Record<string, Answer>
  tokens_in: number
  tokens_out: number
}
