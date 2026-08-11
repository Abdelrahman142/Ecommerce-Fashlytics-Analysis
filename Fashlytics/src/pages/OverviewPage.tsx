import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Gem,
  PackageX,
  Percent,
  ShieldAlert,
  Sparkles,
  Star,
  Tags,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { buildInsights } from '@/api/insights'
import { fmtCompact, fmtDate, fmtMoney, fmtPct, fmtRating } from '@/lib/format'
import { KpiCard } from '@/components/ui/KpiCard'
import { ChartCard } from '@/components/ui/ChartCard'
import { InsightCard } from '@/components/ui/InsightCard'
import { BarChart, type BarDatum } from '@/components/charts/BarChart'
import { HistogramChart } from '@/components/charts/HistogramChart'
import { DonutChart, DonutLegend } from '@/components/charts/DonutChart'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CardGridSkeleton, ChartGridSkeleton, EmptyDatasetState, ErrorState } from '@/components/ui/States'

const INSIGHT_ICONS: Record<string, typeof Star> = {
  'gender-dominant': Users,
  'top-brand': Trophy,
  'premium-share': Gem,
  'high-rated': Star,
  'rating-gap': ShieldAlert,
  oos: PackageX,
  discount: Percent,
}

export function OverviewPage() {
  const { version, refresh } = useDataVersion()
  const { data: overview, error, loading, reload } = useAsync(() => api.overview(), [version])
  const { data: products } = useAsync(() => api.products(), [version])
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [showAllCategories, setShowAllCategories] = useState(false)

  const insights = useMemo(
    () => (overview && products ? buildInsights(overview, products) : []),
    [overview, products],
  )

  if (loading || !overview) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (overview.kpis.total_products === 0) return <EmptyDatasetState />

  const k = overview.kpis
  const symbol = meta?.currency_symbol ?? '₹'

  const categoryData: BarDatum[] = overview.category_dist.map((c) => ({
    name: c.name,
    value: c.count,
  }))
  const brandData: BarDatum[] = overview.top_brands.map((b) => ({
    name: b.brand,
    value: b.count,
  }))
  const priceHist = overview.price_hist
  const ratingDist = overview.rating_dist

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Fashion Intelligence</h1>
          <p className="page-subtitle mt-1">
            Understand your product catalog, pricing, brands and customer-facing product attributes.
          </p>
        </div>
        <button onClick={refresh} className="btn-outline h-9" title="Refresh from data layer">
          <CalendarClock className="size-4 text-brand-600 dark:text-brand-400" />
          Last updated: {fmtDate(meta?.snapshot_end)}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Total Products"
          value={fmtCompact(k.total_products)}
          icon={<Boxes className="size-4" />}
          context={`${fmtCompact(k.in_stock)} in stock · ${fmtCompact(k.out_of_stock)} out`}
          accent
        />
        <KpiCard
          label="Brands"
          value={fmtCompact(k.brands)}
          icon={<Tags className="size-4" />}
          context={`${fmtCompact(k.total_products / k.brands)} products per brand on average`}
        />
        <KpiCard
          label="Categories"
          value={fmtCompact(k.categories)}
          icon={<Wallet className="size-4" />}
          context={`${k.categories} fashion segments across the catalog`}
        />
        <KpiCard
          label="Average Price"
          value={fmtMoney(k.avg_price, symbol)}
          icon={<Wallet className="size-4" />}
          context={`Median ${fmtMoney(k.median_price, symbol)} · avg ${fmtPct(k.avg_discount_pct, 0)} discount`}
        />
        <KpiCard
          label="Average Rating"
          value={
            <>
              {fmtRating(k.avg_rating)} <span className="text-base font-medium text-ink-3 dark:text-ink-3-dark">/ 5</span>
            </>
          }
          icon={<Star className="size-4" />}
          context={`${fmtPct(k.rating_coverage_pct)} of products are rated (${fmtCompact(k.products_rated)})`}
        />
      </div>

      {/* main charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Products by Category"
          subtitle="Share of the catalog per fashion segment"
          action={
            <Button size="sm" variant="ghost" onClick={() => setShowAllCategories((v) => !v)}>
              {showAllCategories ? 'Show top' : `View all ${categoryData.length}`}
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          <BarChart data={categoryData} orientation="horizontal" showAll={showAllCategories} categorical maxBars={9} height={showAllCategories ? 380 : 270} />
        </ChartCard>

        <ChartCard
          title="Top Brands by Product Count"
          subtitle="Largest catalog owners"
          action={
            <Link to="/brands" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              View brand intelligence →
            </Link>
          }
        >
          <BarChart data={brandData} orientation="horizontal" height={270} />
        </ChartCard>

        <ChartCard
          title="Product Price Distribution"
          subtitle={`Selling price histogram (${symbol}0–${symbol}4,000+)`}
        >
          <HistogramChart data={priceHist} height={260} />
        </ChartCard>

        <ChartCard
          title="Rating Distribution"
          subtitle="Average rating buckets (rated products only)"
        >
          <BarChart data={ratingDist.map((h) => ({ name: h.bin, value: h.count }))} height={260} color="var(--color-brand-400)" valueFormatter={(n) => fmtCompact(n)} />
        </ChartCard>
      </div>

      {/* distribution strip */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ChartCard title="Price Bands" subtitle="Selling price segmentation" bodyClassName="flex flex-col gap-3">
          <DonutChart
            data={overview.price_bands.map((b) => ({ name: b.band, count: b.count }))}
            centerValue={fmtCompact(k.total_products)}
            centerLabel="products"
            height={170}
          />
          <DonutLegend data={overview.price_bands.map((b) => ({ name: b.band, count: b.count }))} />
        </ChartCard>
        <ChartCard title="Rating Buckets" subtitle="low < 3 · mid 3–4 · high ≥ 4" bodyClassName="flex flex-col gap-3">
          <DonutChart
            data={overview.rating_buckets.map((b) => ({ name: b.band, count: b.count }))}
            centerValue={fmtCompact(k.products_rated)}
            centerLabel="rated"
            height={170}
          />
          <DonutLegend data={overview.rating_buckets.map((b) => ({ name: b.band, count: b.count }))} />
        </ChartCard>
        <ChartCard title="Gender Split" subtitle="Inferred customer gender" bodyClassName="flex flex-col gap-3">
          <DonutChart
            data={overview.gender_dist.map((g) => ({ name: g.name, count: g.count }))}
            centerValue={fmtCompact(k.total_products)}
            centerLabel="products"
            height={170}
          />
          <DonutLegend data={overview.gender_dist.map((g) => ({ name: g.name, count: g.count }))} />
        </ChartCard>
        <ChartCard title="Availability" subtitle="Stock status at snapshot" bodyClassName="flex flex-col gap-3">
          <DonutChart
            data={overview.availability.map((a) => ({ name: a.name, count: a.count }))}
            centerValue={fmtCompact(k.in_stock)}
            centerLabel="in stock"
            height={170}
            colors={['#2ec4b6', '#e76f51']}
          />
          <DonutLegend data={overview.availability.map((a) => ({ name: a.name, count: a.count }))} colors={['#2ec4b6', '#e76f51']} />        </ChartCard>
      </div>

      {/* insights */}
      <section className="relative overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50 via-surface to-surface p-6 dark:border-brand-500/20 dark:from-brand-500/10 dark:via-surface-2-dark dark:to-surface-2-dark">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm dark:bg-brand-500">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink dark:text-ink-dark">Key Insights</p>
              <p className="text-xs text-ink-2 dark:text-ink-2-dark">
                Computed automatically from the current dataset
              </p>
            </div>
          </div>
          <span className="hidden text-[11px] text-ink-3 sm:block dark:text-ink-3-dark">
            Snapshot {fmtDate(meta?.snapshot_start)} – {fmtDate(meta?.snapshot_end)}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((ins) => (
            <InsightCard
              key={ins.id}
              icon={INSIGHT_ICONS[ins.id] ?? Sparkles}
              title={ins.title}
              text={ins.text}
              tone={ins.tone}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>
      <CardGridSkeleton />
      <ChartGridSkeleton />
    </div>
  )
}
