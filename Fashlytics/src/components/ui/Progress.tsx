import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** A labelled, filled progress bar. */
export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number
  className?: string
  barClassName?: string
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3 dark:bg-surface-3-dark', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full bg-brand-600 transition-[width] duration-500 dark:bg-brand-500', barClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

/** A radial progress indicator for the data-health score. */
export function RadialProgress({
  value,
  size = 168,
  stroke = 10,
  children,
}: {
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface-3 dark:stroke-surface-3-dark"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-brand-600 dark:stroke-brand-500 transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
