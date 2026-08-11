import {
  Bar,
  BarChart as RCBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTheme } from '@/lib/theme'
import { TooltipShell } from './TooltipShell'
import { fmtCompact, fmtInt } from '@/lib/format'

export interface HistDatum {
  bin: string
  count: number
}

interface HistogramChartProps {
  data: HistDatum[]
  height?: number
  color?: string
  valueFormatter?: (n: number) => string
}

/** Continuous-bin histogram, bars that sit on the axis baseline. */
export function HistogramChart({
  data,
  height = 260,
  color = 'var(--color-brand-600)',
  valueFormatter = (n) => fmtInt(n),
}: HistogramChartProps) {
  const { chart } = useTheme()
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RCBarChart data={data} margin={{ left: 4, right: 8, top: 4, bottom: 0 }} barCategoryGap={1}>
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
                  rows={[
                    {
                      label: 'Products',
                      value: valueFormatter(Number(payload[0].value)),
                      color: color as string,
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]} fill={color}>
            {data.map((d, i) => (
              <Cell
                key={d.bin}
                fill={d.count === 0 ? chart.grid : i % 2 === 0 ? color : 'var(--color-brand-400)'}
              />
            ))}
          </Bar>
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  )
}
