import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'success' | 'warn'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        tone === 'neutral' &&
          'bg-surface-3 text-ink-2 ring-edge-2/60 dark:bg-surface-3-dark dark:text-ink-2-dark dark:ring-edge-2-dark/60',
        tone === 'brand' &&
          'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
        tone === 'success' &&
          'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
        tone === 'warn' &&
          'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
        className,
      )}
    >
      {children}
    </span>
  )
}
