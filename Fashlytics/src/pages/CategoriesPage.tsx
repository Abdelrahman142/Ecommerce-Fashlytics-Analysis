import { useMemo, useState } from 'react'
import { Compass, Crown, Trophy, Wallet } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { fmtCompact, fmtMoney, fmtPct, fmtRating } from '@/lib/format'
import { KpiCard } from '@/components/ui/KpiCard'
import { ChartCard } from '@/components/ui/ChartCard'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'
import { RangeChart } from '@/components/charts/RangeChart'
import { MultiBarChart } from '@/components/charts/MultiBarChart'
import { PageSkeleton, ErrorState, EmptyDatasetState } from '@/components/ui/States'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

export function CategoriesPage() {
  const { version } = useDataVersion()
  const { data, error, loading, reload } = useAsync(() => api.categories(), [version])
  const { data: products } = useAsync(() => api.products(), [version])
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [selected, setSelected] = useState<string[]>([])

  const symbol = meta?.currency_symbol ?? '₹'

  const kpis = useMemo(() => {
    const items = data?.items ?? []
    const largest = items[0]
    const priced = items.filter((c) => c.avg_price != null)
    const highestPrice = priced.length
      ? priced.reduce((a, b) => (b.avg_price ?? 0) > (a.avg_price ?? 0) ? b : a)
      : null
    const rated = items.filter((c) => c.avg_rating != null)
    const highestRated = rated.length
      ? rated.reduce((a, b) => (b.avg_rating ?? 0) > (a.avg_rating ?? 0) ? b : a)
      : null
    return { total: items.length, largest, highestPrice, highestRated }
  }, [data])

  const countData: BarDatum[] = (data?.items ?? []).map((c) => ({ name: c.name, value: c.products }))
  const priceData: BarDatum[] = (data?.items ?? [])
    .filter((c) => c.avg_price != null)
    .sort((a, b) => (b.avg_price ?? 0) - (a.avg_price ?? 0))
    .map((c) => ({ name: c.name, value: c.avg_price ?? 0 }))
  const ratingData: BarDatum[] = (data?.items ?? [])
    .filter((c) => c.avg_rating != null)
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    .map((c) => ({ name: c.name, value: c.avg_rating ?? 0 }))

  const rangeData = useMemo(() => {
    if (!products) return []
    const map = new Map<string, { prices: number[] }>()
    for (const p of products.items) {
      if (p.p == null) continue
      let b = map.get(p.c)
      if (!b) {
        b = { prices: [] }
        map.set(p.c, b)
      }
      b.prices.push(p.p)
    }
    const out: { category: string; min: number; q1: number; median: number; q3: number; max: number }[] = []
    for (const [category, b] of map) {
      const sorted = [...b.prices].sort((x, y) => x - y)
      const q = (f: number) => {
        const pos = (sorted.length - 1) * f
        const lo = Math.floor(pos)
        const hi = Math.ceil(pos)
        return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
      }
      out.push({
        category,
        min: sorted[0],
        q1: q(0.25),
        median: q(0.5),
        q3: q(0.75),
        max: sorted[sorted.length - 1],
      })
    }
    return out.sort((a, b) => b.max - a.max)
  }, [products])

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))

  const comparison = useMemo(
    () => (data?.items ?? []).filter((c) => selected.includes(c.name)),
    [data, selected],
  )

  if (loading || !data) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (data.count === 0) return <EmptyDatasetState />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Category Intelligence</h1>
        <p className="page-subtitle mt-1">Segment performance, pricing and ratings across the fashion taxonomy.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Categories" value={fmtCompact(kpis.total)} icon={<Compass className="size-4" />} context="Fashion segments in the cleaned taxonomy" accent />
        <KpiCard
          label="Largest Category"
          value={kpis.largest ? kpis.largest.name : '—'}
          icon={<Trophy className="size-4" />}
          context={kpis.largest ? `${fmtCompact(kpis.largest.products)} products · ${fmtPct((kpis.largest.products / products?.count!)*100, 0)} of catalog` : undefined}
        />
        <KpiCard
          label="Highest-priced Category"
          value={kpis.highestPrice ? kpis.highestPrice.name : '—'}
          icon={<Wallet className="size-4" />}
          context={kpis.highestPrice ? `Average ${fmtMoney(kpis.highestPrice.avg_price, symbol)}` : undefined}
        />
        <KpiCard
          label="Highest-rated Category"
          value={kpis.highestRated ? kpis.highestRated.name : '—'}
          icon={<Crown className="size-4" />}
          context={kpis.highestRated ? `${fmtRating(kpis.highestRated.avg_rating)} / 5 average rating` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Products by Category" subtitle="Catalogue size per segment" bodyClassName="px-4">
          <BarChart data={countData} orientation="horizontal" categorical height={460} showAll maxBars={15} />
        </ChartCard>
        <ChartCard title="Average Price by Category" subtitle={`Mean selling price (${symbol})`}>
          <BarChart data={priceData} orientation="horizontal" categorical height={460} showAll valueFormatter={(n) => fmtMoney(n, symbol, 0)} />
        </ChartCard>
        <ChartCard title="Average Rating by Category" subtitle="Rated products only" bodyClassName="px-4">
          <BarChart data={ratingData} orientation="horizontal" categorical height={460} showAll color="var(--color-brand-400)" valueFormatter={(n) => n.toFixed(1)} />
        </ChartCard>
        <ChartCard title="Category Price Distribution" subtitle="Min, quartiles, median and max selling price" bodyClassName="px-5">
          <RangeChart data={rangeData} currencySymbol={symbol} height={Math.max(200, rangeData.length * 32)} />
        </ChartCard>
      </div>

      {/* comparison tool */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">Category Comparison</p>
            <p className="mt-0.5 text-xs text-ink-2 dark:text-ink-2-dark">
              Select two or more categories to compare them side by side.
            </p>
          </div>
          {selected.length > 0 && (
            <button className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" onClick={() => setSelected([])}>
              Clear selection
            </button>
          )}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {data.items.map((c) => (
            <button
              key={c.name}
              onClick={() => toggle(c.name)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all',
                selected.includes(c.name)
                  ? 'border-brand-600 bg-brand-600 text-white shadow-sm dark:border-brand-500 dark:bg-brand-500'
                  : 'border-edge bg-surface text-ink-2 hover:border-brand-400 hover:text-brand-600 dark:border-edge-dark dark:bg-transparent dark:text-ink-2-dark dark:hover:border-brand-500 dark:hover:text-brand-300',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {comparison.length === 0 ? (
          <p className="rounded-xl border border-dashed border-edge-2 py-10 text-center text-[13px] text-ink-3 dark:border-edge-2-dark dark:text-ink-3-dark">
            No categories selected — click the chips above to compare.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {comparison.map((c) => (
                <div key={c.name} className="rounded-xl border border-edge bg-surface-2 p-3 dark:border-edge-dark dark:bg-surface-dark">
                  <p className="truncate text-[12px] font-semibold text-ink dark:text-ink-dark">{c.name}</p>
                  <dl className="tnum mt-2 space-y-1 text-[12px]">
                    <div className="flex justify-between"><dt className="text-ink-3 dark:text-ink-3-dark">Products</dt><dd className="font-medium text-ink dark:text-ink-dark">{fmtCompact(c.products)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-3 dark:text-ink-3-dark">Avg price</dt><dd className="font-medium text-ink dark:text-ink-dark">{fmtMoney(c.avg_price, symbol)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-3 dark:text-ink-3-dark">Median</dt><dd className="font-medium text-ink dark:text-ink-dark">{fmtMoney(c.median_price, symbol)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-3 dark:text-ink-3-dark">Rating</dt><dd className="font-medium text-ink dark:text-ink-dark">{c.avg_rating != null ? fmtRating(c.avg_rating) : '—'}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-3 dark:text-ink-3-dark">Coverage</dt><dd className="font-medium text-ink dark:text-ink-dark">{fmtPct(c.rating_coverage_pct, 0)}</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {c.top_brands.slice(0, 3).map((b) => (
                      <Badge key={b.name} tone="neutral">{b.name}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="label mb-2">Price histogram by category (₹)</p>
              <MultiBarChart
                series={comparison.map((c) => ({ name: c.name, data: c.price_hist.map((h) => ({ bin: h.bin, count: h.count })) }))}
                height={280}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
