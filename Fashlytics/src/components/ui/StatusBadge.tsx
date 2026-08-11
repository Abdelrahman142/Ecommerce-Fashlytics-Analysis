import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CheckStatus } from '@/api/types'

const MAP: Record<
  CheckStatus,
  { label: string; icon: typeof CheckCircle2; classes: string }
> = {
  PASS: {
    label: 'Passed',
    icon: CheckCircle2,
    classes:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  },
  WARN: {
    label: 'Warning',
    icon: AlertTriangle,
    classes:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  },
  FAIL: {
    label: 'Failed',
    icon: XCircle,
    classes:
      'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-400/20',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: CheckStatus
  className?: string
}) {
  const m = MAP[status]
  const Icon = m.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        m.classes,
        className,
      )}
    >
      <Icon className="size-3.5" />
      {m.label}
    </span>
  )
}
