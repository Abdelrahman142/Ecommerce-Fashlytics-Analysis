import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { InsightTone } from '@/api/insights'

const TONES: Record<InsightTone, { iconBg: string; title: string }> = {
  accent: {
    iconBg: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    title: 'text-ink dark:text-ink-dark',
  },
  positive: {
    iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    title: 'text-ink dark:text-ink-dark',
  },
  info: {
    iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
    title: 'text-ink dark:text-ink-dark',
  },
  warn: {
    iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    title: 'text-ink dark:text-ink-dark',
  },
}

export function InsightCard({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: LucideIcon
  title: string
  text: string
  tone: InsightTone
}) {
  const t = TONES[tone]
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border border-edge bg-surface p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-edge-dark dark:bg-surface-2-dark',
      )}
    >
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg', t.iconBg)}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className={cn('text-[13px] font-semibold leading-snug', t.title)}>{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-2 dark:text-ink-2-dark">{text}</p>
      </div>
    </div>
  )
}
