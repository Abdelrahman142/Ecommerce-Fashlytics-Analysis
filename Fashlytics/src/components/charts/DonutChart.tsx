import { Cell, Pie, PieChart as RCPieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTheme } from '@/lib/theme'
import { TooltipShell } from './TooltipShell'
import { fmtCompact, fmtInt } from '@/lib/format'

export interface DonutDatum {
  name: string
  count: number
}

interface DonutChartProps {
  data: DonutDatum[]
  height?: number
  centerLabel: string
  centerValue: string
  valueFormatter?: (n: number) => string
  colors?: string[]
}

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
  valueFormatter = (n) => fmtCompact(n),
  colors,
}: DonutChartProps) {
  const { chart } = useTheme()
  const palette = colors ?? chart.categorical
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RCPieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            innerRadius="62%"
            outerRadius="86%"
            paddingAngle={2}
            strokeWidth={0}
            cornerRadius={3}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={palette[i % palette.length]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipShell
                  title={String(payload[0].name)}
                  rows={[
                    {
                      label: 'Products',
                      value: valueFormatter(Number(payload[0].value)),
                      color: payload[0].payload.fill as string,
                    },
                    {
                      label: 'Share',
                      value: `${(((Number(payload[0].value) / total) * 100) || 0).toFixed(1)}%`,
                    },
                  ]}
                />
              ) : null
            }
          />
        </RCPieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-2xl font-semibold text-ink dark:text-ink-dark">
          {centerValue}
        </span>
        <span className="text-[11px] text-ink-3 dark:text-ink-3-dark">{centerLabel}</span>
      </div>
    </div>
  )
}

export function DonutLegend({
  data,
  colors,
  valueFormatter = (n) => fmtInt(n),
}: {
  data: DonutDatum[]
  colors?: string[]
  valueFormatter?: (n: number) => string
}) {
  const { chart } = useTheme()
  const palette = colors ?? chart.categorical
  const total = data.reduce((s, d) => s + d.count, 0)
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center justify-between gap-3 text-[13px]">
          <span className="flex min-w-0 items-center gap-2 text-ink-2 dark:text-ink-2-dark">
            <span
              className="size-2.5 shrink-0 rounded-[4px]"
              style={{ background: palette[i % palette.length] }}
            />
            <span className="truncate">{d.name}</span>
          </span>
          <span className="tnum flex items-center gap-2 font-medium text-ink dark:text-ink-dark">
            {valueFormatter(d.count)}
            <span className="tnum w-10 text-right text-xs text-ink-3 dark:text-ink-3-dark">
              {total ? ((d.count / total) * 100).toFixed(1) : '0.0'}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
