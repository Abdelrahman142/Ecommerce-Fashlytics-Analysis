import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
        <Compass className="size-6" />
      </span>
      <div>
        <p className="tnum text-5xl font-semibold tracking-tight text-ink dark:text-ink-dark">404</p>
        <p className="mt-2 text-sm font-medium text-ink dark:text-ink-dark">Page not found</p>
        <p className="mt-1 max-w-sm text-[13px] text-ink-2 dark:text-ink-2-dark">
          The page you are looking for doesn’t exist or has been moved. Let’s get you back to the overview.
        </p>
      </div>
      <Link to="/">
        <Button variant="primary">Back to Overview</Button>
      </Link>
    </div>
  )
}
