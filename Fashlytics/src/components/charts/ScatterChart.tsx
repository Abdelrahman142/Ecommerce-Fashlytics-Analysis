import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RCScatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { useTheme } from '@/lib/theme'
import { TooltipShell } from './TooltipShell'
import { fmtMoney } from '@/lib/format'

export interface ScatterDatum {
  x: number
  y: number
  z?: number
  name?: string
}

interface ScatterChartProps {
  data: ScatterDatum[]
  height?: number
  xLabel?: string
  yLabel?: string
  xFormatter?: (n: number) => string
  yFormatter?: (n: number) => string
  currencySymbol?: string
}

export function ScatterChart({
  data,
  height = 320,
  xLabel = 'Price',
  yLabel = 'Rating',
  xFormatter = (n) => fmtMoney(n, '₹', 0),
  yFormatter = (n) => n.toFixed(1),
  currencySymbol = '₹',
}: ScatterChartProps) {
  const { chart } = useTheme()
  void currencySymbol
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RCScatter margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            tick={{ fontSize: 11, fill: chart.tick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => xFormatter(v)}
            label={{ value: xLabel, position: 'insideBottomRight', offset: -2, fontSize: 11, fill: chart.tick }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yLabel}
            domain={[0, 5]}
            tick={{ fontSize: 11, fill: chart.tick }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => yFormatter(v)}
          />
          <ZAxis type="number" dataKey="z" range={[40, 220]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3', stroke: chart.tick }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as ScatterDatum
              return (
                <TooltipShell
                  title={p.name ?? `${xLabel} × ${yLabel}`}
                  rows={[
                    { label: xLabel, value: xFormatter(p.x) },
                    { label: yLabel, value: yFormatter(p.y) },
                    { label: 'Products', value: String(p.z ?? 1) },
                  ]}
                />
              )
            }}
          />
          <Scatter
            data={data}
            fill="var(--color-brand-500)"
            fillOpacity={0.55}
            stroke="var(--color-brand-700)"
            strokeOpacity={0.8}
          />
        </RCScatter>
      </ResponsiveContainer>
    </div>
  )
}
