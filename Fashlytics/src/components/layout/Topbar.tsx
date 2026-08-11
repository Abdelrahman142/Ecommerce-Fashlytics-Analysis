import { useMemo } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Menu,
  Moon,
  RefreshCw,
  Search,
  Sun,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { api, invalidateDataCache } from '@/api/client'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/cn'
import { fmtDate } from '@/lib/format'
import { Dropdown } from '@/components/ui/Dropdown'

interface TopbarChromeProps {
  onOpenPalette: () => void
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onOpenProfile: () => void
}

/** Data-freshness chip + refresh + theme + notifications + avatar row. */
export function TopbarChrome({
  onOpenPalette,
  onToggleSidebar,
  onToggleTheme,
  onOpenProfile,
}: TopbarChromeProps) {
  const { version, refresh } = useDataVersion()
  const { mode } = useTheme()
  const { data: meta } = useAsync(() => api.meta(), [version])
  const { data: quality } = useAsync(() => api.quality(), [version])

  const alerts = useMemo(() => {
    if (!quality) return 0
    return quality.checks.filter((c) => c.status === 'WARN' || c.status === 'FAIL').length
  }, [quality])

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onToggleSidebar}
        className="btn-ghost size-9 rounded-lg p-0 lg:hidden"
        aria-label="Toggle navigation"
      >
        <Menu className="size-5" />
      </button>

      <button
        onClick={onOpenPalette}
        className="hidden h-9 w-72 items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 text-left text-sm text-ink-3 transition-colors hover:border-edge-2 sm:flex dark:border-edge-dark dark:bg-surface-dark dark:text-ink-3-dark dark:hover:border-edge-2-dark"
        aria-label="Global search"
      >
        <Search className="size-4" />
        <span className="flex-1">Search products, brands…</span>
        <kbd className="rounded-md border border-edge px-1.5 py-0.5 text-[10px] dark:border-edge-dark">⌘K</kbd>
      </button>

      <div className="mx-1 hidden h-5 w-px bg-edge md:block dark:bg-edge-dark" />

      <div
        className="hidden h-9 items-center gap-2 rounded-lg border border-edge px-3 md:flex dark:border-edge-dark"
        title={`Snapshot ${fmtDate(meta?.snapshot_start)} → ${fmtDate(meta?.snapshot_end)}`}
      >
        <Database className="size-3.5 text-brand-600 dark:text-brand-400" />
        <div className="leading-tight">
          <p className="text-[10.5px] text-ink-3 dark:text-ink-3-dark">Last updated</p>
          <p className="tnum text-[12px] font-medium text-ink dark:text-ink-dark">
            {fmtDate(meta?.snapshot_start)}
          </p>
        </div>
      </div>

      <button
        className="btn-ghost size-9 rounded-lg p-0"
        aria-label="Refresh data"
        title="Refresh data"
        onClick={() => {
          invalidateDataCache()
          refresh()
        }}
      >
        <RefreshCw className="size-4" />
      </button>

      <button
        className="btn-ghost size-9 rounded-lg p-0"
        aria-label="Toggle theme"
        title="Toggle theme"
        onClick={onToggleTheme}
      >
        {mode === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>

      <Dropdown
        width="w-[360px]"
        trigger={(open) => (
          <button
            className={cn('btn-ghost relative size-9 rounded-lg p-0', open && 'bg-surface-3 dark:bg-surface-3-dark')}
            aria-label="Notifications"
          >
            <Bell className="size-[18px]" />
            {alerts > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-[8.5px] font-bold text-white ring-2 ring-surface dark:ring-surface-2-dark">
                {alerts > 9 ? '9+' : alerts}
              </span>
            )}
          </button>
        )}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-2.5 dark:border-edge-dark">
          <p className="text-[13px] font-semibold text-ink dark:text-ink-dark">Notifications</p>
          <span className="text-[11px] text-ink-3 dark:text-ink-3-dark">
            {alerts > 0 ? `${alerts} need attention` : 'All clear'}
          </span>
        </div>
        <NotificationList />
      </Dropdown>

      <button
        onClick={onOpenProfile}
        className="ml-1 flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-semibold text-white transition-shadow ring-2 ring-transparent hover:ring-brand-200 dark:hover:ring-brand-500/30"
        aria-label="User profile"
        title="User Profile"
      >
        AM
      </button>
    </div>
  )
}

/** Notification content — generated from live quality + overview data. */
function NotificationList() {
  const { version } = useDataVersion()
  const navigate = useNavigate()
  const { data: quality } = useAsync(() => api.quality(), [version])
  const { data: overview } = useAsync(() => api.overview(), [version])

  const items = useMemo(() => {
    const list: { id: string; title: string; text: string; tone: 'warn' | 'ok' | 'info'; to: string }[] = []
    if (quality) {
      for (const c of quality.checks) {
        if (c.status === 'FAIL') {
          list.push({
            id: c.check_id,
            title: `Check ${c.check_id} failed`,
            text: `${c.title} — ${c.records_affected.toLocaleString('en-IN')} records affected.`,
            tone: 'warn',
            to: '/quality',
          })
        } else if (c.status === 'WARN' && c.records_affected > 0) {
          list.push({
            id: c.check_id,
            title: `Check ${c.check_id} warning`,
            text: `${c.title} — ${c.records_affected.toLocaleString('en-IN')} records affected.`,
            tone: 'warn',
            to: '/quality',
          })
        }
      }
      if (quality.checks_by_status.FAIL === 0 && quality.checks_by_status.WARN === 0) {
        list.push({
          id: 'all-pass',
          title: 'All quality checks passed',
          text: 'The data layer is healthy and ready for analysis.',
          tone: 'ok',
          to: '/quality',
        })
      }
    }
    if (overview) {
      list.push({
        id: 'freshness',
        title: 'Dataset is ready',
        text: `Snapshot ${fmtDate(overview.kpis.snapshot_dates[0])} · ${overview.kpis.total_products.toLocaleString('en-IN')} products indexed.`,
        tone: 'info',
        to: '/',
      })
    }
    return list
  }, [quality, overview])

  return (
    <div className="max-h-[420px] overflow-y-auto p-2">
      {items.length === 0 && (
        <p className="px-3 py-6 text-center text-[13px] text-ink-3 dark:text-ink-3-dark">
          No notifications yet.
        </p>
      )}
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => navigate(it.to)}
          className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-surface-3 dark:hover:bg-surface-3-dark"
        >
          <span
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
              it.tone === 'warn' && 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
              it.tone === 'ok' && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
              it.tone === 'info' && 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
            )}
          >
            {it.tone === 'warn' ? (
              <AlertTriangle className="size-4" />
            ) : it.tone === 'ok' ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Database className="size-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-ink dark:text-ink-dark">
              {it.title}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-ink-2 dark:text-ink-2-dark">
              {it.text}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
