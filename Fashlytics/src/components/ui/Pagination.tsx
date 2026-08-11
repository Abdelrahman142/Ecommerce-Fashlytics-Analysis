import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Select } from './Select'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizes?: number[]
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const range = (): (number | '…')[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
    const out: (number | '…')[] = [1]
    const start = Math.max(2, page - 1)
    const end = Math.min(pages - 1, page + 1)
    if (start > 2) out.push('…')
    for (let i = start; i <= end; i++) out.push(i)
    if (end < pages - 1) out.push('…')
    out.push(pages)
    return out
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <p className="tnum text-[13px] text-ink-2 dark:text-ink-2-dark">
        {from}–{to} of {total.toLocaleString('en-IN')}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-3 dark:text-ink-3-dark">Rows</span>
          <Select
            value={String(pageSize)}
            onChange={(v) => onPageSizeChange(Number(v))}
            options={pageSizes.map((s) => ({ value: String(s), label: String(s) }))}
            className="w-20"
          />
        </div>
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            className="btn-ghost size-8 rounded-lg p-0 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          {range().map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1 text-xs text-ink-3 dark:text-ink-3-dark">
                …
              </span>
            ) : (
              <button
                key={p}
                className={cn(
                  'tnum size-8 rounded-lg text-[13px] font-medium transition-colors',
                  p === page
                    ? 'bg-brand-600 text-white dark:bg-brand-500'
                    : 'text-ink-2 hover:bg-surface-3 hover:text-ink dark:text-ink-2-dark dark:hover:bg-surface-3-dark dark:hover:text-ink-dark',
                )}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            className="btn-ghost size-8 rounded-lg p-0 disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      </div>
    </div>
  )
}
