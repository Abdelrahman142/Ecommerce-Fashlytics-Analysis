import { useMemo } from 'react'
import { ClipboardCheck, Database, FileWarning, Layers, RefreshCw, ShieldCheck, XOctagon } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { fmtCompact, fmtDate, fmtDateTime, fmtPct } from '@/lib/format'
import { KpiCard } from '@/components/ui/KpiCard'
import { ChartCard } from '@/components/ui/ChartCard'
import { RadialProgress, Progress } from '@/components/ui/Progress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { PageSkeleton, ErrorState, EmptyDatasetState } from '@/components/ui/States'
import { cn } from '@/lib/cn'

export function QualityPage() {
  const { version, refresh } = useDataVersion()
  const { data, error, loading, reload } = useAsync(() => api.quality(), [version])

  const byCategory = useMemo(() => {
    const map = new Map<string, { PASS: number; WARN: number; FAIL: number }>()
    for (const c of data?.checks ?? []) {
      const row = map.get(c.category) ?? { PASS: 0, WARN: 0, FAIL: 0 }
      row[c.status] += 1
      map.set(c.category, row)
    }
    return [...map.entries()]
  }, [data])

  if (loading || !data) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (data.checks_total === 0) return <EmptyDatasetState />

  const totals = data.totals
  const totalRecords = totals.products + totals.listings + totals.attributes
  const passShare = (data.checks_by_status.PASS / Math.max(1, data.checks_total)) * 100
  const missingTotal = Object.values(data.missing_values).reduce((a, b) => a + b, 0)

  const kpis = [
    {
      label: 'Total Records',
      value: fmtCompact(totalRecords),
      icon: <Database className="size-4" />,
      context: `${fmtCompact(totals.products)} products · ${fmtCompact(totals.listings)} listings · ${fmtCompact(totals.attributes)} attributes`,
    },
    {
      label: 'Valid Records',
      value: fmtCompact(data.valid_records),
      icon: <ShieldCheck className="size-4" />,
      context: `${fmtPct((data.valid_records / totalRecords) * 100, 1)} of the processed layer passed structural validation`,
    },
    {
      label: 'Invalid / Rejected',
      value: fmtCompact(data.invalid_records),
      icon: <XOctagon className="size-4" />,
      context: 'Records rejected by structural validation during ETL',
    },
    {
      label: 'Duplicate Records',
      value: fmtCompact(data.duplicate_records),
      icon: <Layers className="size-4" />,
      context: 'Rows sharing a natural key across listings & attributes',
    },
    {
      label: 'Missing Values',
      value: fmtCompact(missingTotal),
      icon: <FileWarning className="size-4" />,
      context: `Across required & optional columns (e.g. description, rating, brand)`,
    },
    {
      label: 'Data Freshness',
      value: fmtDate(data.freshness.snapshot_start),
      icon: <RefreshCw className="size-4" />,
      context: `Snapshot ${fmtDate(data.freshness.snapshot_start)} – ${fmtDate(data.freshness.snapshot_end)}`,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Data Quality</h1>
        <p className="page-subtitle mt-1">
          Automated checks over the processed layer — {data.checks_total} checks, generated {fmtDateTime(data.freshness.generated_at)}.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* health score */}
        <ChartCard title="Data Health Score" subtitle="Weighted across all checks">
          <div className="flex flex-col items-center justify-center gap-4 py-2">
            <RadialProgress value={data.score} size={176}>
              <span className="tnum text-4xl font-semibold text-ink dark:text-ink-dark">{data.score}%</span>
              <span className="text-xs text-ink-3 dark:text-ink-3-dark">health score</span>
            </RadialProgress>
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-2 dark:text-ink-2-dark">
                  <ShieldCheck className="size-3.5 text-emerald-500" /> Passed
                </span>
                <span className="tnum font-semibold text-ink dark:text-ink-dark">{data.checks_by_status.PASS}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-2 dark:text-ink-2-dark">
                  <FileWarning className="size-3.5 text-amber-500" /> Warnings
                </span>
                <span className="tnum font-semibold text-ink dark:text-ink-dark">{data.checks_by_status.WARN}</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 text-ink-2 dark:text-ink-2-dark">
                  <XOctagon className="size-3.5 text-rose-500" /> Failed
                </span>
                <span className="tnum font-semibold text-ink dark:text-ink-dark">{data.checks_by_status.FAIL}</span>
              </div>
              <Progress value={passShare} className="h-2" barClassName="bg-emerald-500 dark:bg-emerald-500" />
              <p className="text-[11px] text-ink-3 dark:text-ink-3-dark">{data.score_formula}</p>
            </div>
          </div>
        </ChartCard>

        {/* right column */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {kpis.map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} context={k.context} accent={k.label === 'Data Freshness'} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChartCard title="Missing Values by Column" subtitle="Nulls in the products layer" bodyClassName="px-4">
              <ul className="space-y-2.5 px-2 py-1">
                {Object.entries(data.missing_values)
                  .sort((a, b) => b[1] - a[1])
                  .map(([col, n]) => (
                    <li key={col}>
                      <div className="mb-1 flex items-center justify-between text-[12px]">
                        <span className="text-ink-2 dark:text-ink-2-dark">{col}</span>
                        <span className="tnum font-medium text-ink dark:text-ink-dark">{fmtCompact(n)}</span>
                      </div>
                      <Progress value={(n / totals.products) * 100} className="h-1.5" />
                    </li>
                  ))}
              </ul>
            </ChartCard>
            <ChartCard title="Checks by Category" subtitle="PASS / WARN / FAIL per domain" bodyClassName="px-4">
              <ul className="space-y-2.5 px-2 py-1">
                {byCategory.map(([cat, row]) => (
                  <li key={cat}>
                    <div className="mb-1 flex items-center justify-between text-[12px]">
                      <span className="text-ink-2 dark:text-ink-2-dark">{cat}</span>
                      <span className="flex items-center gap-2 text-[11px]">
                        <span className="tnum font-semibold text-emerald-600 dark:text-emerald-400">{row.PASS} ✓</span>
                        {row.WARN > 0 && <span className="tnum font-semibold text-amber-600 dark:text-amber-400">{row.WARN} ⚠</span>}
                        {row.FAIL > 0 && <span className="tnum font-semibold text-rose-600 dark:text-rose-400">{row.FAIL} ✕</span>}
                      </span>
                    </div>
                    <Progress value={(row.PASS / Math.max(1, row.PASS + row.WARN + row.FAIL)) * 100} barClassName="bg-emerald-500 dark:bg-emerald-500" />
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>
        </div>
      </div>

      {/* checks table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-edge px-4 py-3 dark:border-edge-dark">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-ink-dark">
            <ClipboardCheck className="size-4 text-brand-600 dark:text-brand-400" />
            Check Results
          </p>
          <div className="flex items-center gap-2">
            <Badge tone="success">{data.checks_by_status.PASS} passed</Badge>
            <Badge tone="warn">{data.checks_by_status.WARN} warning</Badge>
            <Badge tone={data.checks_by_status.FAIL > 0 ? 'warn' : 'neutral'}>
              {data.checks_by_status.FAIL} failed
            </Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-edge bg-surface-2 text-[11px] font-semibold tracking-wide text-ink-3 uppercase dark:border-edge-dark dark:bg-surface-2-dark dark:text-ink-3-dark">
                <th className="px-4 py-2.5">Check</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Records Affected</th>
                <th className="px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((c) => (
                <tr key={c.check_id} className="group border-b border-edge align-top transition-colors last:border-0 hover:bg-surface-2/60 dark:border-edge-dark dark:hover:bg-surface-3-dark/60">
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-ink dark:text-ink-dark">{c.title}</p>
                    <p className="tnum mt-0.5 text-[11px] text-ink-3 dark:text-ink-3-dark">{c.check_id}</p>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-ink-2 dark:text-ink-2-dark">{c.category}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className={cn('tnum px-4 py-3 text-right text-[13px]', c.records_affected > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-medium text-ink-2 dark:text-ink-2-dark')}>
                    {c.records_affected > 0 ? fmtCompact(c.records_affected) : '—'}
                  </td>
                  <td className="max-w-[340px] px-4 py-3 text-[12px] leading-relaxed text-ink-2 dark:text-ink-2-dark">
                    {c.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-edge px-4 py-2.5 text-[11px] text-ink-3 dark:border-edge-dark dark:text-ink-3-dark">
          <span>Warnings are documented dataset characteristics, not defects.</span>
          <button onClick={refresh} className="flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            <RefreshCw className="size-3" /> Re-run
          </button>
        </div>
      </div>
    </div>
  )
}
