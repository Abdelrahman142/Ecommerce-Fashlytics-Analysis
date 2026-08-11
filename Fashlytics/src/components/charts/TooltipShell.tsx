import type { ReactNode } from 'react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'

interface TooltipRow {
  label: string
  value: ReactNode
  color?: string
}

export function TooltipShell({
  title,
  rows,
}: {
  title?: ReactNode
  rows: TooltipRow[]
}) {
  const { chart } = useTheme()
  return (
    <div
      className="min-w-[150px] rounded-xl border px-3 py-2.5 text-[13px] shadow-pop"
      style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder }}
    >
      {title && (
        <p className="mb-1.5 font-semibold text-ink dark:text-ink-dark">{title}</p>
      )}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-ink-2 dark:text-ink-2-dark">
              {r.color && (
                <span
                  className={cn('inline-block size-2 rounded-full')}
                  style={{ background: r.color }}
                />
              )}
              {r.label}
            </span>
            <span className="tnum font-semibold text-ink dark:text-ink-dark">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
