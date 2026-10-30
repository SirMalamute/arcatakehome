import type {
  Column,
  DocumentFull,
  DocumentSummary,
  Facets,
  Filter,
  PreviewResult,
  Review,
  ReviewSummary,
  Template,
} from '@/types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function errorMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? String(d)).join('; ')
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
  return 'Request failed'
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, errorMessage(body.detail))
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export interface UploadResult {
  documents: DocumentSummary[]
  errors: { filename: string; error: string }[]
}

export const api = {
  facets: () => request<Facets>('/documents/facets'),
  search: (filter: Filter, limit = 1000) =>
    post<{ documents: DocumentSummary[]; total: number }>('/documents/search', { filter, limit }),
  filterFromText: (text: string) =>
    post<{ filter: Filter; explanation: string }>('/documents/filter-from-text', { text }),
  document: (id: string) => request<DocumentFull>(`/documents/${id}`),
  upload: (form: FormData) => request<UploadResult>('/documents/upload', { method: 'POST', body: form }),

  templates: () => request<Template[]>('/templates'),

  reviews: () => request<ReviewSummary[]>('/reviews'),
  review: (id: string) => request<Review>(`/reviews/${id}`),
  createReview: (body: { name: string; filter: Filter; document_ids: string[]; columns: Column[] }) =>
    post<Review>('/reviews', body),
  preview: (document_id: string, columns: Column[]) =>
    post<PreviewResult>('/reviews/preview', { document_id, columns }),
  runReview: (id: string) => post<Review>(`/reviews/${id}/run`),
  retryFailed: (id: string) => post<Review>(`/reviews/${id}/retry-failed`),

  async downloadCsv(id: string) {
    const res = await fetch(`${API_URL}/reviews/${id}/export.csv`)
    if (!res.ok) throw new ApiError(res.status, 'Export failed')
    const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: match?.[1] ?? 'review.csv' })
    a.click()
    URL.revokeObjectURL(url)
  },
}
