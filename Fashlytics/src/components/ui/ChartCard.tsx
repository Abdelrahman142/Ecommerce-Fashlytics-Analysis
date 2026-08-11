import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ChartCardProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: ChartCardProps) {
  return (
    <section className={cn('card flex flex-col', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink dark:text-ink-dark">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink-2 dark:text-ink-2-dark">{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className={cn('min-h-0 flex-1 px-2 pb-4', bodyClassName)}>{children}</div>
    </section>
  )
}
