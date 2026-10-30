import { useEffect, useRef, useState } from 'react'

import { TypeTag } from '@/components/TypeTag'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Column, ReviewItem } from '@/types'

import { CellView } from './CellView'

export interface SelectedCell {
  documentId: string
  columnKey: string
}

const PAGE = 60

/**
 * Rows render incrementally (60 at a time, more as you scroll) so large reviews stay fast.
 * The selected cell is always rendered and scrolled into view.
 */
export function ResultsGrid({ columns, items, selected, flashes, onSelect }: {
  columns: Column[]
  items: ReviewItem[]
  selected: SelectedCell | null
  flashes: Record<string, 'done' | 'failed'>
  onSelect: (c: SelectedCell) => void
}) {
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef<HTMLTableRowElement>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const selectedRow = selected ? items.findIndex((i) => i.document_id === selected.documentId) : -1
  const visible = Math.max(limit, selectedRow + 1)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), {
      root: scroller.current,
      rootMargin: '400px',
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible, items.length])

  useEffect(() => {
    if (!selected) return
    scroller.current
      ?.querySelector(`[data-cell="${selected.documentId}:${selected.columnKey}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selected])

  return (
    <div ref={scroller} className="h-full overflow-auto rounded-xl border bg-card">
      <table className="w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="eyebrow sticky top-0 left-0 z-20 w-80 min-w-80 border-r border-b bg-card px-5 py-3 text-left font-normal">
              Document
            </th>
            {columns.map((c, i) => (
              <th key={c.key} className="sticky top-0 z-10 w-64 min-w-64 border-b bg-card px-4 py-3 text-left font-normal">
                <Tooltip>
                  <TooltipTrigger className="flex items-baseline gap-2 text-left">
                    <span className="font-mono text-[10px] text-brand">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[13px] font-medium text-ink">{c.label}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{c.question}</TooltipContent>
                </Tooltip>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.slice(0, visible).map((item) => {
            const flash = flashes[item.document_id]
            const flashClass = flash === 'done' ? '[&>td]:animate-flash-done' : flash === 'failed' ? '[&>td]:animate-flash-failed' : undefined
            return (
              <tr key={item.document_id} className={cn('group', flashClass)}>
                <td
                  className={cn(
                    'sticky left-0 z-10 w-80 min-w-80 border-r border-b bg-card px-5 py-4 align-top',
                    item.status === 'failed' && 'shadow-[inset_2px_0_0_var(--destructive)]',
                    selected?.documentId === item.document_id && 'shadow-[inset_2px_0_0_var(--brand)]',
                  )}
                >
                  <div className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{item.title}</div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                    <TypeTag type={item.type} />
                    <span>{item.authority}</span>
                    <span>{item.date}</span>
                  </div>
                </td>
                {columns.map((c) => {
                  const isSelected = selected?.documentId === item.document_id && selected.columnKey === c.key
                  return (
                    <td
                      key={c.key}
                      data-cell={`${item.document_id}:${c.key}`}
                      onClick={() => onSelect({ documentId: item.document_id, columnKey: c.key })}
                      className={cn(
                        'w-64 min-w-64 scroll-mt-12 scroll-ml-80 cursor-pointer border-b px-4 py-4 align-top transition-colors hover:bg-muted/50',
                        isSelected && 'bg-brand/5 shadow-[inset_0_0_0_1.5px_var(--brand)]',
                      )}
                    >
                      <CellView item={item} columnKey={c.key} />
                    </td>
                  )
                })}
              </tr>
            )
          })}
          {visible < items.length && (
            <tr ref={sentinel}>
              <td colSpan={columns.length + 1} className="eyebrow px-5 py-4 text-center">
                Showing {visible} of {items.length} — scroll for more
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
