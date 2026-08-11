import {
  Bar,
  BarChart as RCBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '@/lib/theme'
import { TooltipShell } from './TooltipShell'
import { fmtCompact, fmtInt } from '@/lib/format'

export interface MultiBarSeries {
  name: string
  data: { bin: string; count: number }[]
}

interface MultiBarChartProps {
  series: MultiBarSeries[]
  height?: number
  valueFormatter?: (n: number) => string
}

/** Grouped multi-series bars, merged on the bin label. */
export function MultiBarChart({ series, height = 280, valueFormatter = (n) => fmtInt(n) }: MultiBarChartProps) {
  const { chart } = useTheme()
  const bins = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.bin))))
  const merged = bins.map((bin) => {
    const row: Record<string, string | number> = { bin }
    for (const s of series) {
      const hit = s.data.find((d) => d.bin === bin)
      row[s.name] = hit?.count ?? 0
    }
    return row
  })

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RCBarChart data={merged} margin={{ left: 4, right: 8, top: 4, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 10.5, fill: chart.tick }}
            axisLine={false}
            tickLine={false}
            interval={2}
            angle={-30}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chart.tick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmtCompact(v)}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: chart.cursor }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipShell
                  title={`Price ${String(label)}`}
                  rows={payload.map((p) => ({
                    label: String(p.name),
                    value: valueFormatter(Number(p.value)) as string,
                    color: p.color as string,
                  }))}
                />
              ) : null
            }
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => <span className="text-ink-2 dark:text-ink-2-dark">{value}</span>}
          />
          {series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} radius={[3, 3, 0, 0]} fill={chart.categorical[i % chart.categorical.length]} maxBarSize={22} />
          ))}
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  )
}
