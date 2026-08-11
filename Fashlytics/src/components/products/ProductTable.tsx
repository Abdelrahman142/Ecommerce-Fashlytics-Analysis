import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Columns3 } from 'lucide-react'
import type { Product } from '@/api/types'
import { cn } from '@/lib/cn'
import { fmtMoney, fmtRating } from '@/lib/format'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Dropdown } from '@/components/ui/Dropdown'
import { EmptyState } from '@/components/ui/States'
import { ProductImage } from './ProductImage'
import { Badge } from '@/components/ui/Badge'

export type SortKey = 't' | 'b' | 'c' | 'p' | 'r'
type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: SortKey
  label: string
  always?: boolean
}

const BASE_COLUMNS: ColumnDef[] = [
  { key: 't', label: 'Product', always: true },
  { key: 'b', label: 'Brand', always: true },
  { key: 'c', label: 'Category' },
  { key: 'p', label: 'Price', always: true },
  { key: 'r', label: 'Rating' },
]

interface ProductTableProps {
  items: Product[]
  onOpen: (id: string) => void
  currencySymbol: string
}

export function ProductTable({ items, onOpen, currencySymbol }: ProductTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('t')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [hidden, setHidden] = useState<Set<SortKey>>(new Set())

  const sorted = useMemo(() => {
    const arr = [...items]
    arr.sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [items, sortKey, sortDir])

  const columns = BASE_COLUMNS.filter((c) => !hidden.has(c.key))

  const pageItems = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 't' || key === 'b' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const toggleColumn = (key: SortKey) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportCsv = () => {
    const header = ['id', 'title', 'brand', 'category', 'gender', 'price', 'mrp', 'rating', 'available']
    const rows = sorted.map((p) => [
      p.id,
      `"${p.t.replaceAll('"', '""')}"`,
      `"${p.b.replaceAll('"', '""')}"`,
      `"${p.c.replaceAll('"', '""')}"`,
      p.g,
      p.p ?? '',
      p.m ?? '',
      p.r ?? '',
      p.av ? 'true' : 'false',
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fashlytics-products.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="size-3 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 dark:text-ink-3-dark" />
    return sortDir === 'asc' ? <ArrowUp className="size-3 text-brand-600 dark:text-brand-400" /> : <ArrowDown className="size-3 text-brand-600 dark:text-brand-400" />
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3 dark:border-edge-dark">
        <p className="text-sm font-semibold text-ink dark:text-ink-dark">Product Catalogue</p>
        <div className="flex items-center gap-2">
          <Dropdown
            width="w-44"
            trigger={(open) => (
              <Button size="sm" variant="outline" icon={<Columns3 className="size-3.5" />} className={cn(open && 'border-brand-500 text-brand-600')}>
                Columns
              </Button>
            )}
          >
            <div className="p-2">
              {BASE_COLUMNS.filter((c) => !c.always).map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink hover:bg-surface-3 dark:text-ink-dark dark:hover:bg-surface-3-dark">
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.key)}
                    onChange={() => toggleColumn(c.key)}
                    className="size-4 accent-brand-600"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Dropdown>
          <Button size="sm" variant="outline" icon={<Download className="size-3.5" />} onClick={exportCsv} disabled={sorted.length === 0}>
            Export
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-edge bg-surface-2 dark:border-edge-dark dark:bg-surface-2-dark">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-2.5">
                  <button
                    onClick={() => toggleSort(c.key)}
                    className="group flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase transition-colors hover:text-ink dark:text-ink-3-dark dark:hover:text-ink-dark"
                  >
                    {c.label}
                    <SortIcon col={c.key} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5 text-[11px] font-semibold tracking-wide text-ink-3 uppercase dark:text-ink-3-dark">
                Availability
              </th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p) => (
              <tr
                key={p.id}
                className="group border-b border-edge last:border-0 transition-colors hover:bg-brand-50/40 dark:border-edge-dark dark:hover:bg-brand-500/5"
              >
                <td className="px-4 py-3">
                  <button onClick={() => onOpen(p.id)} className="flex items-center gap-3 text-left">
                    <ProductImage src={p.img} alt={p.t} className="size-10 shrink-0 rounded-lg border border-edge dark:border-edge-dark" />
                    <span className="min-w-0 max-w-[280px]">
                      <span className="line-clamp-1 block text-[13px] font-medium text-ink transition-colors group-hover:text-brand-700 dark:text-ink-dark dark:group-hover:text-brand-300">
                        {p.t}
                      </span>
                      <span className="tnum mt-0.5 block truncate text-[11px] text-ink-3 dark:text-ink-3-dark">{p.id}</span>
                    </span>
                  </button>
                </td>
                {columns.some((c) => c.key === 'b') && (
                  <td className="px-4 py-3 text-[13px] text-ink-2 dark:text-ink-2-dark">{p.b}</td>
                )}
                {columns.some((c) => c.key === 'c') && (
                  <td className="px-4 py-3 text-[13px] text-ink-2 dark:text-ink-2-dark">
                    <span className="line-clamp-1 block max-w-[160px]">{p.c}</span>
                  </td>
                )}
                {columns.some((c) => c.key === 'p') && (
                  <td className="tnum px-4 py-3 text-[13px] font-semibold text-ink dark:text-ink-dark">
                    {fmtMoney(p.p, currencySymbol)}
                  </td>
                )}
                {columns.some((c) => c.key === 'r') && (
                  <td className="px-4 py-3">
                    {p.ha && p.r != null ? (
                      <span className="tnum text-[13px] font-medium text-ink dark:text-ink-dark">
                        {fmtRating(p.r)} <span className="text-[11px] text-ink-3 dark:text-ink-3-dark">/ 5</span>
                      </span>
                    ) : (
                      <span className="text-xs text-ink-3 dark:text-ink-3-dark">No rating</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3">
                  <Badge tone={p.av ? 'success' : 'neutral'} className={cn(!p.av && 'text-ink-2 dark:text-ink-2-dark')}>
                    {p.av ? 'In stock' : 'Out of stock'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageItems.length === 0 && (
          <EmptyState
            title="No products match"
            description="Adjust or clear the filters to explore the catalogue again."
          />
        )}
      </div>

      {sorted.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={sorted.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      )}
    </div>
  )
}
