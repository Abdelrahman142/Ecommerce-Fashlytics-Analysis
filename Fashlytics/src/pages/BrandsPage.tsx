import { useMemo, useState } from 'react'
import { Award, Tags, TrendingUp, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { fmtCompact, fmtMoney, fmtRating } from '@/lib/format'
import { KpiCard } from '@/components/ui/KpiCard'
import { ChartCard } from '@/components/ui/ChartCard'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { Badge } from '@/components/ui/Badge'
import { SearchInput } from '@/components/ui/SearchInput'
import { PageSkeleton, ErrorState, EmptyDatasetState } from '@/components/ui/States'
import { BrandDetailDrawer } from '@/components/brands/BrandDetailDrawer'

export function BrandsPage() {
  const { version } = useDataVersion()
  const { data, error, loading, reload } = useAsync(() => api.brands(), [version])
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = data?.items ?? []
    if (!q) return items
    return items.filter((b) => b.brand.toLowerCase().includes(q))
  }, [data, query])

  const kpis = useMemo(() => {
    const items = data?.items ?? []
    const totalBrands = items.length
    const avgPerBrand = totalBrands ? Math.round(items.reduce((s, b) => s + b.products, 0) / totalBrands) : 0
    const avgPrice = items.length
      ? items.reduce((s, b) => s + (b.avg_price ?? 0), 0) / items.length
      : 0
    const rated = items.filter((b) => b.avg_rating != null)
    const best = rated.length
      ? rated.reduce((a, b) => ((b.avg_rating ?? 0) > (a.avg_rating ?? 0) ? b : a))
      : null
    return { totalBrands, avgPerBrand, avgPrice, best }
  }, [data])

  const selectedBrand = useMemo(
    () => (data ? (data.items.find((b) => b.brand === selected) ?? null) : null),
    [data, selected],
  )

  if (loading || !data) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (data.count === 0) return <EmptyDatasetState />

  const symbol = meta?.currency_symbol ?? '₹'

  const countData: BarDatum[] = data.items.slice(0, 15).map((b) => ({ name: b.brand, value: b.products }))
  const priceData: BarDatum[] = data.items
    .filter((b) => b.avg_price != null)
    .sort((a, b) => (b.avg_price ?? 0) - (a.avg_price ?? 0))
    .slice(0, 12)
    .map((b) => ({ name: b.brand, value: b.avg_price ?? 0 }))
  const ratingData: BarDatum[] = data.items
    .filter((b) => b.avg_rating != null)
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    .slice(0, 12)
    .map((b) => ({ name: b.brand, value: b.avg_rating ?? 0 }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Brand Intelligence</h1>
        <p className="page-subtitle mt-1">Leaderboards, positioning and brand × category dynamics.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Brands" value={fmtCompact(kpis.totalBrands)} icon={<Tags className="size-4" />} context="Canonical brands after cleaning" accent />
        <KpiCard label="Avg Products / Brand" value={fmtCompact(kpis.avgPerBrand)} icon={<TrendingUp className="size-4" />} context="Catalogue concentration across brands" />
        <KpiCard label="Average Brand Price" value={fmtMoney(kpis.avgPrice, symbol)} icon={<Wallet className="size-4" />} context="Mean of brand-level average selling prices" />
        <KpiCard
          label="Highest Rated Brand"
          value={kpis.best ? kpis.best.brand : '—'}
          icon={<Award className="size-4" />}
          context={kpis.best ? `${fmtRating(kpis.best.avg_rating)} / 5 across ${fmtCompact(kpis.best.products)} products` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Brand Product Count" subtitle="Top 15 brands by catalogue size">
          <BarChart data={countData} orientation="horizontal" height={300} categorical showAll />
        </ChartCard>
        <ChartCard title="Average Price by Brand" subtitle={`Highest average selling price (${symbol})`}>
          <BarChart data={priceData} orientation="horizontal" height={300} categorical showAll valueFormatter={(n) => fmtMoney(n, symbol, 0)} />
        </ChartCard>
        <ChartCard title="Average Rating by Brand" subtitle="Highest rated brands (rated products only)">
          <BarChart data={ratingData} orientation="horizontal" height={300} categorical showAll valueFormatter={(n) => n.toFixed(1)} color="var(--color-brand-400)" />
        </ChartCard>
        <ChartCard title="Brand × Category" subtitle="Top 20 brands across the top 12 categories" bodyClassName="px-4">
          <Heatmap rows={data.matrix.brands} cols={data.matrix.categories} counts={data.matrix.counts} height={420} />
        </ChartCard>
      </div>

      {/* brand table */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge px-4 py-3 dark:border-edge-dark">
          <p className="text-sm font-semibold text-ink dark:text-ink-dark">All Brands</p>
          <SearchInput value={query} onChange={setQuery} placeholder="Search brands…" className="w-full sm:w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-edge bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase dark:border-edge-dark dark:bg-surface-2-dark dark:text-ink-3-dark">
                <th className="px-4 py-2.5">Brand</th>
                <th className="px-4 py-2.5">Products</th>
                <th className="px-4 py-2.5">Avg Price</th>
                <th className="px-4 py-2.5">Avg Rating</th>
                <th className="px-4 py-2.5">Categories</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 60).map((b) => (
                <tr
                  key={b.brand}
                  onClick={() => setSelected(b.brand)}
                  className="cursor-pointer border-b border-edge transition-colors last:border-0 hover:bg-brand-50/40 dark:border-edge-dark dark:hover:bg-brand-500/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-ink dark:text-ink-dark">{b.brand}</span>
                      {b.suspected_truncated > 0 && <Badge tone="warn">trunc.</Badge>}
                    </div>
                  </td>
                  <td className="tnum px-4 py-3 text-[13px] text-ink-2 dark:text-ink-2-dark">{fmtCompact(b.products)}</td>
                  <td className="tnum px-4 py-3 text-[13px] font-medium text-ink dark:text-ink-dark">{fmtMoney(b.avg_price, symbol)}</td>
                  <td className="tnum px-4 py-3 text-[13px] text-ink-2 dark:text-ink-2-dark">
                    {b.avg_rating != null ? `${fmtRating(b.avg_rating)} / 5` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex max-w-[280px] flex-wrap gap-1">
                      {b.categories.slice(0, 2).map((c) => (
                        <Badge key={c.category} tone="neutral">{c.category}</Badge>
                      ))}
                      {b.categories.length > 2 && (
                        <span className="tnum text-[11px] text-ink-3 dark:text-ink-3-dark">
                          +{b.categories.length - 2}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-ink-3 dark:text-ink-3-dark">
            No brands match “{query}”.
          </p>
        )}
        {filtered.length > 60 && (
          <p className="border-t border-edge px-4 py-2.5 text-[12px] text-ink-3 dark:border-edge-dark dark:text-ink-3-dark">
            Showing 60 of {filtered.length.toLocaleString('en-IN')} — refine the search to narrow down.
          </p>
        )}
      </div>

      <BrandDetailDrawer brand={selectedBrand} onClose={() => setSelected(null)} currencySymbol={symbol} />
    </div>
  )
}
