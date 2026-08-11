import { useState } from 'react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'

interface HeatmapProps {
  rows: string[]
  cols: string[]
  counts: number[][]
  height?: number
}

function shade(base: string, alpha: number): string {
  // blend the brand color with the surface for a clean intensity ramp
  const stop = 0.14 + 0.86 * alpha
  return `color-mix(in srgb, ${base} ${Math.round(stop * 100)}%, transparent)`
}

export function Heatmap({ rows, cols, counts, height = 400 }: HeatmapProps) {
  const { chart, mode } = useTheme()
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null)

  const max = counts.reduce(
    (m, row) => Math.max(m, ...row),
    0,
  )
  const base = mode === 'dark' ? '#7a66ea' : '#6458e5'

  return (
    <div style={{ height }} className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `148px repeat(${cols.length}, 1fr)` }}>
          <div />
          {cols.map((c) => (
            <div
              key={c}
              title={c}
              className="truncate px-1 text-center text-[10.5px] font-medium text-ink-3 dark:text-ink-3-dark"
            >
              {c.length > 14 ? `${c.slice(0, 13)}…` : c}
            </div>
          ))}

          {rows.map((row, r) => (
            <div key={row} className="contents">
              <div className="truncate self-center pr-2 text-right text-[11px] font-medium text-ink-2 dark:text-ink-2-dark">
                {row.length > 20 ? `${row.slice(0, 19)}…` : row}
              </div>
              {cols.map((col, c) => {
                const v = counts[r][c] ?? 0
                const alpha = max === 0 ? 0 : v / max
                const active = hover?.r === r && hover?.c === c
                return (
                  <div
                    key={`${row}-${col}`}
                    onMouseEnter={() => setHover({ r, c })}
                    onMouseLeave={() => setHover(null)}
                    className="relative flex aspect-[1.35] cursor-default items-center justify-center rounded-[5px] transition-transform hover:scale-[1.04]"
                    style={{
                      background: shade(base, alpha),
                      boxShadow: active ? `0 0 0 1.5px ${base}` : undefined,
                    }}
                  >
                    {v > 0 && (
                      <span
                        className={cn(
                          'tnum text-[10px] font-semibold',
                          alpha > 0.5 ? 'text-white' : 'text-ink-2 dark:text-ink-2-dark',
                        )}
                      >
                        {v}
                      </span>
                    )}
                    {active && (
                      <span
                        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium shadow-pop"
                        style={{ background: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, color: undefined }}
                      >
                        <span className="font-semibold text-ink dark:text-ink-dark">{row}</span>
                        <span className="text-ink-2 dark:text-ink-2-dark"> × {col}: </span>
                        <span className="tnum font-semibold text-ink dark:text-ink-dark">{v}</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
