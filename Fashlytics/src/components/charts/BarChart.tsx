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

export interface BarDatum {
  name: string
  value: number
  value2?: number
}

interface BarChartProps {
  data: BarDatum[]
  height?: number
  orientation?: 'horizontal' | 'vertical'
  color?: string
  color2?: string
  valueFormatter?: (n: number) => string
  value2Formatter?: (n: number) => string
  /** render one bar per datum, coloured from the categorical palette */
  categorical?: boolean
  value2Label?: string
  showAll?: boolean
  maxBars?: number
}

export function BarChart({
  data,
  height = 260,
  orientation = 'vertical',
  color = 'var(--color-brand-600)',
  color2 = 'var(--color-brand-300)',
  valueFormatter = (n) => fmtInt(n),
  value2Formatter = (n) => n.toFixed(2),
  categorical = false,
  value2Label = 'Secondary',
  showAll = false,
  maxBars = 8,
}: BarChartProps) {
  const { chart } = useTheme()
  const horizontal = orientation === 'horizontal'
  const visible = showAll ? data : data.slice(0, maxBars)
  const hasSecond = data.some((d) => d.value2 != null)

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RCBarChart
          data={visible}
          margin={
            horizontal
              ? { left: 8, right: 16, top: 4, bottom: 0 }
              : { left: 4, right: 8, top: 4, bottom: 0 }
          }
          barCategoryGap={horizontal ? '28%' : '24%'}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chart.grid}
            vertical={false}
            horizontal={horizontal}
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                dataKey="value"
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtCompact(v)}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tick={{ fontSize: 11.5, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                interval={visible.length > 10 ? 1 : 0}
                angle={visible.length > 7 ? -35 : 0}
                textAnchor={visible.length > 7 ? 'end' : 'middle'}
                height={visible.length > 7 ? 58 : 30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtCompact(v)}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            cursor={{ fill: chart.cursor, radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const rows = payload.map((p) => {
                const key = p.dataKey as string
                const formatter = key === 'value2' ? value2Formatter : valueFormatter
                const lbl = key === 'value2' ? value2Label : 'Products'
                return { label: lbl, value: formatter(Number(p.value)) as string, color: p.color as string }
              })
              return <TooltipShell title={String(label)} rows={rows} />
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} fill={color}>
            {categorical &&
              visible.map((_, i) => (
                <Cell key={i} fill={chart.categorical[i % chart.categorical.length]} />
              ))}
          </Bar>
          {hasSecond && <Bar dataKey="value2" radius={[4, 4, 4, 4]} fill={color2} />}
        </RCBarChart>
      </ResponsiveContainer>
    </div>
  )
}
