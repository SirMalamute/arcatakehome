import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize)
  if (pages <= 1) return null
  const from = page * pageSize + 1
  const to = Math.min(total, (page + 1) * pageSize)
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <span className="eyebrow">{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="font-mono text-[11px] text-muted-foreground">{page + 1} / {pages}</span>
        <Button variant="ghost" size="icon-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
