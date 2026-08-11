import type { ReactNode } from 'react'
import { AlertCircle, Database, Inbox, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { Skeleton } from './Skeleton'
import { cn } from '@/lib/cn'

export function CardGridSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-3 h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

export function ChartGridSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="mt-6 h-[260px] w-full" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardGridSkeleton />
      <ChartGridSkeleton />
    </div>
  )
}

interface StateShellProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
}

function StateShell({ icon, title, description, action, className }: StateShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-edge-2 p-10 text-center dark:border-edge-2-dark',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-surface-3 text-ink-3 dark:bg-surface-3-dark dark:text-ink-3-dark">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink dark:text-ink-dark">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-ink-2 dark:text-ink-2-dark">
          {description}
        </p>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title = 'No results',
  description = 'Nothing matches the current filters. Try broadening your search.',
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <StateShell icon={<Inbox className="size-5" />} title={title} description={description} action={action} />
  )
}

export function EmptyDatasetState() {
  return (
    <StateShell
      icon={<Database className="size-5" />}
      title="No data available"
      description="The dataset is empty. Run the ETL pipeline to populate the warehouse before opening the dashboard."
    />
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'The data layer could not be reached. Check that the API or static data bundle is available.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <StateShell
      icon={<AlertCircle className="size-5" />}
      title={title}
      description={description}
      action={
        onRetry && (
          <Button variant="outline" icon={<RefreshCw className="size-4" />} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  )
}
