import { useMemo } from 'react'
import { Box, ExternalLink, Star, Truck } from 'lucide-react'
import type { Product } from '@/api/types'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { ProductImage } from './ProductImage'
import { fmtMoney, fmtPct, fmtRating } from '@/lib/format'
import { cn } from '@/lib/cn'

interface ProductDetailDrawerProps {
  product: Product | null
  onClose: () => void
  /** full product list so positioning can be computed against real averages */
  products: Product[]
  currencySymbol: string
}

function CompareBar({
  value,
  baseline,
  fmt,
  label,
  invert = false,
}: {
  value: number
  baseline: number
  fmt: (n: number) => string
  label: string
  invert?: boolean
}) {
  const pct = baseline === 0 ? 0 : (value / baseline - 1) * 100
  const above = invert ? pct < 0 : pct >= 0
  const ratio = Math.min(1, value / (baseline || value || 1))
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[12px]">
        <span className="text-ink-2 dark:text-ink-2-dark">{label}</span>
        <span className="tnum">
          <span className="font-semibold text-ink dark:text-ink-dark">{fmt(value)}</span>
          <span className="text-ink-3 dark:text-ink-3-dark"> vs {fmt(baseline)}</span>
          <span className={cn('ml-1.5 font-semibold', above ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
            {pct >= 0 ? '+' : ''}
            {pct.toFixed(0)}%
          </span>
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3 dark:bg-surface-3-dark">
        <div
          className={cn('h-full rounded-full', above ? 'bg-brand-600 dark:bg-brand-500' : 'bg-brand-300 dark:bg-brand-700')}
          style={{ width: `${Math.max(4, ratio * 100)}%` }}
        />
        <span
          className="absolute top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full bg-ink/50 dark:bg-ink-dark/50"
          style={{ left: '100%' }}
          title="category average"
        />
      </div>
    </div>
  )
}

export function ProductDetailDrawer({ product, onClose, products, currencySymbol }: ProductDetailDrawerProps) {
  const averages = useMemo(() => {
    const cat = new Map<string, { sum: number; n: number; rsum: number; rn: number }>()
    const brand = new Map<string, { sum: number; n: number }>()
    for (const p of products) {
      let c = cat.get(p.c)
      if (!c) {
        c = { sum: 0, n: 0, rsum: 0, rn: 0 }
        cat.set(p.c, c)
      }
      if (p.p != null) {
        c.sum += p.p
        c.n++
      }
      if (p.r != null) {
        c.rsum += p.r
        c.rn++
      }
      let b = brand.get(p.b)
      if (!b) {
        b = { sum: 0, n: 0 }
        brand.set(p.b, b)
      }
      if (p.p != null) {
        b.sum += p.p
        b.n++
      }
    }
    const mean = (m: { sum: number; n: number }) => (m.n ? m.sum / m.n : 0)
    return {
      catAvgPrice: product ? mean(cat.get(product.c) ?? { sum: 0, n: 0 }) : 0,
      catAvgRating: product
        ? (() => {
            const c = cat.get(product.c)
            return c && c.rn ? c.rsum / c.rn : 0
          })()
        : 0,
      brandAvgPrice: product ? mean(brand.get(product.b) ?? { sum: 0, n: 0 }) : 0,
    }
  }, [products, product])

  if (!product) return null

  const p = product
  const pricePct = p.p != null && p.m != null ? (p.d ?? (p.m > 0 ? (1 - p.p / p.m) * 100 : 0)) : null

  return (
    <Drawer
      open={!!product}
      onClose={onClose}
      width="max-w-2xl"
      title={
        <div>
          <p className="text-xs text-ink-3 dark:text-ink-3-dark">Product details</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-ink dark:text-ink-dark">{p.t}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        {/* hero */}
        <div className="flex gap-4">
          <ProductImage src={p.img} alt={p.t} className="size-28 shrink-0 rounded-xl border border-edge dark:border-edge-dark" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{p.b}</Badge>
              <Badge tone="neutral">{p.c}</Badge>
              {p.g !== 'Unknown' && <Badge tone="neutral">{p.g}</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tnum text-2xl font-semibold text-ink dark:text-ink-dark">
                {fmtMoney(p.p, currencySymbol)}
              </span>
              {p.m != null && p.m > 0 && (
                <span className="tnum text-sm text-ink-3 line-through dark:text-ink-3-dark">
                  {fmtMoney(p.m, currencySymbol)}
                </span>
              )}
              {pricePct != null && pricePct > 0 && (
                <Badge tone="success">{fmtPct(pricePct, 0)} off</Badge>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
              {p.ha && p.r != null ? (
                <span className="flex items-center gap-1 font-medium text-ink dark:text-ink-dark">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  <span className="tnum">{fmtRating(p.r)}</span>
                  <span className="text-ink-3 dark:text-ink-3-dark">/ 5</span>
                </span>
              ) : (
                <span className="text-ink-3 dark:text-ink-3-dark">No rating yet</span>
              )}
              <Badge tone={p.av ? 'success' : 'neutral'}>{p.av ? 'In stock' : 'Out of stock'}</Badge>
              {p.s && (
                <span className="flex items-center gap-1 text-ink-2 dark:text-ink-2-dark">
                  <Truck className="size-3.5" /> {p.s}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* description */}
        {p.desc && (
          <section>
            <p className="label mb-2">Description</p>
            <p className="text-[13px] leading-relaxed text-ink-2 dark:text-ink-2-dark">{p.desc}</p>
          </section>
        )}

        {/* attributes */}
        {p.at.length > 0 && (
          <section>
            <p className="label mb-2">Product attributes</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {p.at.map((a) => (
                <div key={a.k} className="rounded-lg border border-edge bg-surface-2 px-3 py-2 dark:border-edge-dark dark:bg-surface-dark">
                  <p className="text-[10.5px] font-medium text-ink-3 uppercase dark:text-ink-3-dark">{a.k}</p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink dark:text-ink-dark">{a.v}</p>
                </div>
              ))}
              {p.ic > 0 && (
                <div className="rounded-lg border border-edge bg-surface-2 px-3 py-2 dark:border-edge-dark dark:bg-surface-dark">
                  <p className="text-[10.5px] font-medium text-ink-3 uppercase dark:text-ink-3-dark">Images</p>
                  <p className="mt-0.5 truncate text-[13px] font-medium text-ink dark:text-ink-dark">{p.ic} gallery photos</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* positioning */}
        <section className="rounded-xl border border-edge bg-surface-2 p-4 dark:border-edge-dark dark:bg-surface-dark">
          <div className="mb-3 flex items-center gap-2">
            <Box className="size-4 text-brand-600 dark:text-brand-400" />
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">Product Positioning</p>
          </div>
          <div className="space-y-4">
            {p.p != null && (
              <CompareBar
                value={p.p}
                baseline={averages.catAvgPrice}
                fmt={(n) => fmtMoney(n, currencySymbol)}
                label="Price vs category average"
              />
            )}
            {p.r != null && (
              <CompareBar
                value={p.r}
                baseline={averages.catAvgRating}
                fmt={(n) => n.toFixed(1)}
                label="Rating vs category average"
                invert
              />
            )}
            {p.p != null && (
              <CompareBar
                value={p.p}
                baseline={averages.brandAvgPrice}
                fmt={(n) => fmtMoney(n, currencySymbol)}
                label="Price vs brand average"
              />
            )}
          </div>
        </section>

        {/* meta */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="label">Category</p>
            <p className="mt-1 text-[13px] font-medium text-ink dark:text-ink-dark">{p.c}</p>
          </div>
          <div>
            <p className="label">Gender</p>
            <p className="mt-1 text-[13px] font-medium text-ink dark:text-ink-dark">{p.g}</p>
          </div>
          <div>
            <p className="label">Attributes</p>
            <p className="tnum mt-1 text-[13px] font-medium text-ink dark:text-ink-dark">{p.na}</p>
          </div>
          {p.pk != null && (
            <div>
              <p className="label">Pack of</p>
              <p className="tnum mt-1 text-[13px] font-medium text-ink dark:text-ink-dark">{p.pk}</p>
            </div>
          )}
        </section>

        <a
          href={p.u || '#'}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg border border-edge py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-500 hover:text-brand-600 dark:border-edge-dark dark:text-ink-2-dark dark:hover:border-brand-500 dark:hover:text-brand-300"
        >
          <ExternalLink className="size-4" />
          View on Flipkart
        </a>
      </div>
    </Drawer>
  )
}
