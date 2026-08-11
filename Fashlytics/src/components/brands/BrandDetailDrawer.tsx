import { useMemo } from 'react'
import { Layers, ShieldCheck } from 'lucide-react'
import type { Brand } from '@/api/types'
import { Drawer } from '@/components/ui/Drawer'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { fmtCompact, fmtMoney, fmtRating } from '@/lib/format'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'

interface BrandDetailDrawerProps {
  brand: Brand | null
  onClose: () => void
  currencySymbol: string
}

export function BrandDetailDrawer({ brand, onClose, currencySymbol }: BrandDetailDrawerProps) {
  const categoryData = useMemo<BarDatum[]>(
    () => (brand ? brand.categories.map((c) => ({ name: c.category, value: c.count })) : []),
    [brand],
  )

  if (!brand) return null

  const share = Math.min(100, Math.round((brand.products / (brand.products || 1)) * 100))

  return (
    <Drawer
      open={!!brand}
      onClose={onClose}
      width="max-w-xl"
      title={
        <div>
          <p className="text-xs text-ink-3 dark:text-ink-3-dark">Brand intelligence</p>
          <p className="mt-0.5 flex items-center gap-2 text-[15px] font-semibold text-ink dark:text-ink-dark">
            {brand.brand}
            {brand.suspected_truncated > 0 && <Badge tone="warn">Truncation suspected</Badge>}
          </p>
        </div>
      }
    >
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-edge bg-surface-2 p-3 dark:border-edge-dark dark:bg-surface-dark">
            <p className="label">Products</p>
            <p className="tnum mt-1 text-xl font-semibold text-ink dark:text-ink-dark">
              {fmtCompact(brand.products)}
            </p>
          </div>
          <div className="rounded-xl border border-edge bg-surface-2 p-3 dark:border-edge-dark dark:bg-surface-dark">
            <p className="label">Avg price</p>
            <p className="tnum mt-1 text-xl font-semibold text-ink dark:text-ink-dark">
              {fmtMoney(brand.avg_price, currencySymbol)}
            </p>
          </div>
          <div className="rounded-xl border border-edge bg-surface-2 p-3 dark:border-edge-dark dark:bg-surface-dark">
            <p className="label">Avg rating</p>
            <p className="tnum mt-1 text-xl font-semibold text-ink dark:text-ink-dark">
              {brand.avg_rating != null ? fmtRating(brand.avg_rating) : '—'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[13px]">
          <ShieldCheck className="size-4 text-brand-600 dark:text-brand-400" />
          <span className="text-ink-2 dark:text-ink-2-dark">
            {brand.corrected.toLocaleString('en-IN')} of {brand.products.toLocaleString('en-IN')} products had their brand
            name corrected by the ETL ({(brand.corrected / Math.max(1, brand.products) * 100).toFixed(1)}%).
          </span>
        </div>

        <div>
          <p className="label mb-2">Category mix</p>
          <BarChart data={categoryData} orientation="horizontal" categorical height={Math.max(120, categoryData.length * 34)} showAll />
        </div>

        <div>
          <p className="label mb-2">Catalog share</p>
          <div className="flex items-center gap-3">
            <Progress value={share} className="flex-1" />
            <span className="tnum text-xs font-medium text-ink-2 dark:text-ink-2-dark">100% of brand</span>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-edge bg-surface-2 p-3 text-[13px] text-ink-2 dark:border-edge-dark dark:bg-surface-dark dark:text-ink-2-dark">
          <Layers className="mt-0.5 size-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <span>{brand.brand} spans {brand.categories.length} fashion segments.</span>
        </div>
      </div>
    </Drawer>
  )
}
