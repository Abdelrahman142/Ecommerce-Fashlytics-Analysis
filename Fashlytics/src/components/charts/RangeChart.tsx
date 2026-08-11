import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import type { PriceByCategoryPoint } from '@/api/selectors'
import { fmtMoney } from '@/lib/format'

interface RangeChartProps {
  data: PriceByCategoryPoint[]
  currencySymbol: string
  height?: number
}

/** Horizontal min–q1–median–q3–max range chart (boxplot-lite). */
export function RangeChart({ data, currencySymbol, height = 340 }: RangeChartProps) {
  const { chart } = useTheme()
  const [hover, setHover] = useState<string | null>(null)

  const max = Math.max(...data.map((d) => d.max), 1)
  const niceMax = Math.ceil(max / 1000) * 1000 || 4000
  const scale = (v: number) => (v / niceMax) * 100

  const tickCount = 6

  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px] text-ink-3 dark:text-ink-3-dark">
        {Array.from({ length: tickCount }).map((_, i) => {
          const v = Math.round((niceMax / (tickCount - 1)) * i)
          return <span key={i} className="tnum">{fmtMoney(v, currencySymbol, 0)}</span>
        })}
      </div>
      <div style={{ height }} className="relative">
        {/* grid lines */}
        {Array.from({ length: tickCount }).map((_, i) => (
          <div
            key={i}
            className="absolute inset-y-0 w-px bg-edge dark:bg-edge-dark"
            style={{ left: `${(i / (tickCount - 1)) * 100}%`, opacity: i === 0 ? 0 : 1 }}
          />
        ))}

        <div className="absolute inset-0 flex flex-col justify-between">
          {data.map((d) => {
            const active = hover === d.category
            return (
              <div
                key={d.category}
                className="group relative flex h-[34px] items-center"
                onMouseEnter={() => setHover(d.category)}
                onMouseLeave={() => setHover(null)}
              >
                {/* category label */}
                <span className="tnum w-40 shrink-0 truncate pr-3 text-right text-[11px] font-medium text-ink-2 dark:text-ink-2-dark">
                  {d.category}
                </span>
                {/* track */}
                <span
                  className="relative block h-[16px] flex-1 rounded"
                  onMouseEnter={() => setHover(d.category)}
                >
                  {/* whisker */}
                  <span
                    className="absolute top-1/2 h-[2px] w-px -translate-y-1/2 rounded bg-ink/40 dark:bg-ink-dark/40"
                    style={{ left: `${scale(d.min)}%`, width: `${Math.max(2, scale(d.max) - scale(d.min))}%` }}
                  />
                  {/* q1-q3 box */}
                  <span
                    className="absolute top-1/2 h-[14px] -translate-y-1/2 rounded-[4px] bg-brand-500/25 ring-1 ring-brand-600/40 transition-transform group-hover:scale-y-110 dark:bg-brand-500/30 dark:ring-brand-400/50"
                    style={{ left: `${scale(d.q1)}%`, width: `${Math.max(3, scale(d.q3) - scale(d.q1))}%` }}
                  />
                  {/* median */}
                  <span
                    className="absolute top-1/2 h-[18px] w-[2.5px] -translate-y-1/2 rounded-full bg-brand-600 dark:bg-brand-400"
                    style={{ left: `${scale(d.median)}%` }}
                  />
                  {active && (
                    <span
                      className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] shadow-pop"
                      style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder }}
                    >
                      <span className="font-semibold text-ink dark:text-ink-dark">{d.category}</span>
                      <div className="tnum mt-0.5 grid grid-cols-2 gap-x-3 text-ink-2 dark:text-ink-2-dark">
                        <span>Min {fmtMoney(d.min, currencySymbol, 0)}</span>
                        <span>Max {fmtMoney(d.max, currencySymbol, 0)}</span>
                        <span>Median {fmtMoney(d.median, currencySymbol, 0)}</span>
                        <span>Q1–Q3 {fmtMoney(d.q1, currencySymbol, 0)}–{fmtMoney(d.q3, currencySymbol, 0)}</span>
                      </div>
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
