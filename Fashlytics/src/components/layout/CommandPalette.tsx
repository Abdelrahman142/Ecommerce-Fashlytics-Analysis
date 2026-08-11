import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Boxes, CornerDownLeft, Loader2, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { Product } from '@/api/types'
import { cn } from '@/lib/cn'
import { useDebounce } from '@/lib/useDebounce'
import { fmtMoney } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { ProductImage } from '@/components/products/ProductImage'

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { version } = useDataVersion()
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 180)
  const { data, loading } = useAsync(() => api.products(), [version])
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setHighlight(0)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => h + 1)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(0, h - 1))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const results = useMemo<Product[]>(() => {
    const items = data?.items ?? []
    const q = debounced.trim().toLowerCase()
    if (!q) return items.slice(0, 12)
    return items
      .filter((p) => p.t.toLowerCase().includes(q) || p.b.toLowerCase().includes(q))
      .slice(0, 12)
  }, [data, debounced])

  useEffect(() => setHighlight(0), [debounced])

  if (!open) return null

  const go = (id: string) => {
    navigate(`/products?pid=${id}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px] dark:bg-black/60" onClick={onClose} />
      <div className="absolute inset-x-0 top-[12vh] mx-auto w-[min(92vw,640px)] animate-rise overflow-hidden rounded-2xl border border-edge bg-surface shadow-pop dark:border-edge-dark dark:bg-surface-2-dark">
        <div className="flex items-center gap-3 border-b border-edge px-4 dark:border-edge-dark">
          <Search className="size-4 shrink-0 text-ink-3 dark:text-ink-3-dark" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands…"
            className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 dark:text-ink-dark dark:placeholder:text-ink-3-dark"
          />
          {loading && <Loader2 className="size-4 animate-spin text-ink-3 dark:text-ink-3-dark" />}
          <kbd className="hidden rounded-md border border-edge px-1.5 py-0.5 text-[10px] text-ink-3 sm:block dark:border-edge-dark dark:text-ink-3-dark">
            ESC
          </kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-10 text-center">
              <Boxes className="size-5 text-ink-3 dark:text-ink-3-dark" />
              <p className="text-sm font-medium text-ink dark:text-ink-dark">No products found</p>
              <p className="text-xs text-ink-2 dark:text-ink-2-dark">
                Try a different product or brand name.
              </p>
            </div>
          )}
          {results.map((p, i) => (
            <button
              key={p.id}
              onClick={() => go(p.id)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                i === highlight ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-surface-3 dark:hover:bg-surface-3-dark',
              )}
            >
              <ProductImage src={p.img} alt={p.t} className="size-10 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink dark:text-ink-dark">
                  {p.t}
                </span>
                <span className="block truncate text-xs text-ink-2 dark:text-ink-2-dark">
                  {p.b} · {p.c}
                </span>
              </span>
              <span className="tnum text-xs font-semibold text-ink-2 dark:text-ink-2-dark">
                {fmtMoney(p.p)}
              </span>
              <CornerDownLeft className="size-3.5 shrink-0 text-ink-3 dark:text-ink-3-dark" />
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-edge bg-surface-2 px-4 py-2 text-[11px] text-ink-3 dark:border-edge-dark dark:bg-surface-dark dark:text-ink-3-dark">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowRight className="size-3" /> Select
            </span>
            <span>↑↓ Navigate</span>
            <span>Esc Close</span>
          </span>
          <span className="tnum">{data ? data.count.toLocaleString('en-IN') : ''} products indexed</span>
        </div>
      </div>
    </div>
  )
}
