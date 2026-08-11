import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import type { Product } from '@/api/types'
import { aggregateByCategory, histogram } from '@/api/selectors'
import { Select, type Option } from '@/components/ui/Select'
import { ChartCard } from '@/components/ui/ChartCard'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'
import { ScatterChart, type ScatterDatum } from '@/components/charts/ScatterChart'
import { RangeChart } from '@/components/charts/RangeChart'
import { Heatmap } from '@/components/charts/Heatmap'
import { PageSkeleton, ErrorState, EmptyDatasetState } from '@/components/ui/States'
import { fmtCompact, fmtMoney } from '@/lib/format'

interface Filters {
  brand: string
  category: string
  gender: string
  band: string
  availability: string
}

const DEFAULTS: Filters = { brand: 'all', category: 'all', gender: 'all', band: 'all', availability: 'all' }

function matches(p: Product, f: Filters): boolean {
  if (f.brand !== 'all' && p.b !== f.brand) return false
  if (f.category !== 'all' && p.c !== f.category) return false
  if (f.gender !== 'all' && p.g !== f.gender) return false
  if (f.band !== 'all' && p.pb !== f.band) return false
  if (f.availability === 'in' && !p.av) return false
  if (f.availability === 'out' && p.av) return false
  return true
}

export function AnalyticsPage() {
  const { version } = useDataVersion()
  const { data, error, loading, reload } = useAsync(() => api.products(), [version])
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [filters, setFilters] = useState<Filters>(DEFAULTS)

  const symbol = meta?.currency_symbol ?? '₹'

  const brandOptions: Option[] = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    for (const p of data.items) map.set(p.b, (map.get(p.b) ?? 0) + 1)
    return [{ value: 'all', label: 'All brands' }, ...[...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([n, c]) => ({ value: n, label: n, hint: `${fmtCompact(c)} products` }))]
  }, [data])

  const categoryOptions: Option[] = useMemo(() => {
    if (!data) return []
    return [
      { value: 'all', label: 'All categories' },
      ...[...new Set(data.items.map((p) => p.c))].map((c) => ({ value: c, label: c })),
    ]
  }, [data])

  const genderOptions: Option[] = useMemo(() => {
    if (!data) return []
    return [{ value: 'all', label: 'All genders' }, ...[...new Set(data.items.map((p) => p.g))].map((g) => ({ value: g, label: g }))]
  }, [data])

  const filtered = useMemo(() => (data ? data.items.filter((p) => matches(p, filters)) : []), [data, filters])

  const scatter = useMemo<ScatterDatum[]>(() => {
    const rated = filtered.filter((p) => p.r != null && p.p != null)
    const step = Math.max(1, Math.floor(rated.length / 1500))
    return rated.filter((_, i) => i % step === 0).map((p) => ({
      x: p.p ?? 0,
      y: p.r ?? 0,
      name: p.t.length > 48 ? `${p.t.slice(0, 47)}…` : p.t,
    }))
  }, [filtered])

  const range = useMemo(() => {
    const by = aggregateByCategory(filtered)
    return by.map((c) => ({
      category: c.category,
      min: c.price.min,
      q1: c.price.q1,
      median: c.price.median,
      q3: c.price.q3,
      max: c.price.max,
    }))
  }, [filtered])

  const ratingHist = useMemo(
    () => histogram(filtered.filter((p) => p.r != null).map((p) => p.r as number), 0.5, 5),
    [filtered],
  )

  const catCounts: BarDatum[] = useMemo(
    () => aggregateByCategory(filtered).slice(0, 15).map((c) => ({ name: c.category, value: c.count })),
    [filtered],
  )

  const heatmap = useMemo(() => {
    const catMap = new Map<string, number>()
    for (const p of filtered) catMap.set(p.c, (catMap.get(p.c) ?? 0) + 1)
    const cats = [...catMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c)
    const brandMap = new Map<string, number>()
    for (const p of filtered) brandMap.set(p.b, (brandMap.get(p.b) ?? 0) + 1)
    const brands = [...brandMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([b]) => b)
    const counts = brands.map((b) => cats.map((c) => filtered.filter((p) => p.b === b && p.c === c).length))
    return { rows: brands, cols: cats, counts }
  }, [filtered])

  if (loading || !data) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (data.count === 0) return <EmptyDatasetState />

  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULTS)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle mt-1">Explore the catalogue across price, rating, brand, category, gender and availability.</p>
      </div>

      {/* filter controls */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Select label="Brand" value={filters.brand} onChange={(v) => setFilters({ ...filters, brand: v })} options={brandOptions} searchable className="w-52" />
        <Select label="Category" value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} options={categoryOptions} searchable className="w-56" />
        <Select label="Gender" value={filters.gender} onChange={(v) => setFilters({ ...filters, gender: v })} options={genderOptions} className="w-40" />
        <Select
          label="Price band"
          value={filters.band}
          onChange={(v) => setFilters({ ...filters, band: v })}
          options={[
            { value: 'all', label: 'All bands' },
            { value: 'budget', label: 'Budget (< ₹500)' },
            { value: 'mid', label: 'Mid (₹500–1,499)' },
            { value: 'premium', label: 'Premium (₹1,500–3,999)' },
            { value: 'luxury', label: 'Luxury (₹4,000+)' },
          ]}
          className="w-44"
        />
        <Select
          label="Availability"
          value={filters.availability}
          onChange={(v) => setFilters({ ...filters, availability: v })}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'in', label: 'In stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
          className="w-40"
        />
        <div className="ml-auto flex items-baseline gap-3">
          {dirty && (
            <button className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300" onClick={() => setFilters(DEFAULTS)}>
              Reset filters
            </button>
          )}
          <p className="tnum text-[13px] text-ink-2 dark:text-ink-2-dark">
            <span className="font-semibold text-ink dark:text-ink-dark">{fmtCompact(filtered.length)}</span> products
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Price vs Rating"
          subtitle={`Scatter of selling price against average rating (sample, ${symbol})`}
          action={<BarChart3 className="size-4 text-ink-3 dark:text-ink-3-dark" />}
          bodyClassName="px-4"
        >
          <ScatterChart data={scatter} height={340} xFormatter={(n) => fmtMoney(n, symbol, 0)} />
        </ChartCard>

        <ChartCard title="Category Price Comparison" subtitle="Full range of selling prices per category" bodyClassName="px-5">
          <RangeChart data={range} currencySymbol={symbol} height={Math.max(200, range.length * 30)} />
        </ChartCard>

        <ChartCard title="Rating Distribution" subtitle="0.5-star buckets of the filtered set">
          <BarChart data={ratingHist.map((h) => ({ name: h.bin, value: h.count }))} height={300} color="var(--color-brand-400)" valueFormatter={(n) => fmtCompact(n)} showAll maxBars={10} />
        </ChartCard>

        <ChartCard title="Product Count by Category" subtitle="Top segments in the filtered set">
          <BarChart data={catCounts} orientation="horizontal" categorical height={300} showAll maxBars={12} />
        </ChartCard>
      </div>

      <ChartCard title="Brand × Category Matrix" subtitle="Concentration of the filtered set across leading brands and categories" bodyClassName="px-5">
        <Heatmap rows={heatmap.rows} cols={heatmap.cols} counts={heatmap.counts} height={360} />
      </ChartCard>
    </div>
  )
}
