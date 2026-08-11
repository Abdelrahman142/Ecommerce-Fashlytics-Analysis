import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface KpiCardProps {
  label: string
  value: ReactNode
  icon?: ReactNode
  context?: ReactNode
  accent?: boolean
  className?: string
}

/** Premium KPI card: label, large tabular value, contextual line. */
export function KpiCard({
  label,
  value,
  icon,
  context,
  accent = false,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'group relative card animate-rise overflow-hidden p-4 transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      {accent && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-500 dark:to-brand-300" />
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="label">{label}</p>
        {icon && (
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:group-hover:bg-brand-500/20">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum text-[28px] font-semibold leading-none tracking-tight text-ink dark:text-ink-dark">
          {value}
        </span>
      </div>
      {context && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-2 dark:text-ink-2-dark">
          {context}
        </p>
      )}
    </div>
  )
}
