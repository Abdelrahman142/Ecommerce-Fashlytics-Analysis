import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface-3 dark:bg-surface-3-dark',
        className,
      )}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5"
        style={{ animation: 'shimmer 1.6s infinite' }}
      />
    </div>
  )
}

export function TextSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-3.5', className)} />
}
