import { useState } from 'react'
import { Bell, Database, Moon, Palette, ShieldCheck, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import { api } from '@/api/client'
import { cn } from '@/lib/cn'
import { fmtDate, fmtDateTime } from '@/lib/format'

function ToggleRow({
  title,
  text,
  checked,
  onChange,
}: {
  title: string
  text: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-[13px] font-medium text-ink dark:text-ink-dark">{title}</p>
        <p className="mt-0.5 text-xs text-ink-2 dark:text-ink-2-dark">{text}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-surface-3 dark:bg-surface-3-dark',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { mode, toggle } = useTheme()
  const { version } = useDataVersion()
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [notifQuality, setNotifQuality] = useState(true)
  const [notifDigest, setNotifDigest] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle mt-1">Manage your workspace preferences.</p>
      </div>

      <section className="card divide-y divide-edge dark:divide-edge-dark">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Palette className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">Appearance</p>
            <p className="text-xs text-ink-2 dark:text-ink-2-dark">Interface theme for this device</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] font-medium text-ink dark:text-ink-dark">Theme</p>
            <div className="flex gap-1 rounded-lg border border-edge bg-surface-2 p-1 dark:border-edge-dark dark:bg-surface-dark">
              <button
                onClick={() => mode === 'dark' && toggle()}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  mode === 'light' ? 'bg-surface text-ink shadow-sm dark:bg-surface-2-dark dark:text-ink-dark' : 'text-ink-2 hover:text-ink dark:text-ink-2-dark dark:hover:text-ink-dark',
                )}
              >
                <Sun className="size-3.5" /> Light
              </button>
              <button
                onClick={() => mode === 'light' && toggle()}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  mode === 'dark' ? 'bg-surface text-ink shadow-sm dark:bg-surface-2-dark dark:text-ink-dark' : 'text-ink-2 hover:text-ink dark:text-ink-2-dark dark:hover:text-ink-dark',
                )}
              >
                <Moon className="size-3.5" /> Dark
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="card divide-y divide-edge dark:divide-edge-dark">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <Bell className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">Notifications</p>
            <p className="text-xs text-ink-2 dark:text-ink-2-dark">Alerts generated from live quality checks</p>
          </div>
        </div>
        <div className="px-5">
          <ToggleRow title="Quality alerts" text="Warn when a data-quality check reports a warning or failure." checked={notifQuality} onChange={setNotifQuality} />
        </div>
        <div className="px-5">
          <ToggleRow title="Daily digest" text="A summary of catalogue health and key metrics each morning." checked={notifDigest} onChange={setNotifDigest} />
        </div>
      </section>

      <section className="card px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Database className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink dark:text-ink-dark">Data layer</p>
            <p className="text-xs text-ink-2 dark:text-ink-2-dark">
              Source: <span className="font-medium">{meta?.source}</span>
            </p>
          </div>
        </div>
        <dl className="tnum mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Snapshot</dt>
            <dd className="mt-0.5 font-medium text-ink dark:text-ink-dark">
              {fmtDate(meta?.snapshot_start)} – {fmtDate(meta?.snapshot_end)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Currency</dt>
            <dd className="mt-0.5 font-medium text-ink dark:text-ink-dark">{meta?.currency}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Layer</dt>
            <dd className="mt-0.5 font-medium text-ink dark:text-ink-dark">{meta?.data_layer}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-ink-3 dark:text-ink-3-dark">Generated</dt>
            <dd className="mt-0.5 font-medium text-ink dark:text-ink-dark">{fmtDateTime(meta?.generated_at)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2.5 text-[12px] text-ink-2 dark:border-edge-dark dark:bg-surface-dark dark:text-ink-2-dark">
          <ShieldCheck className="size-4 shrink-0 text-brand-600 dark:text-brand-400" />
          All figures shown are computed from the processed dataset — the dashboard never fabricates metrics.
        </div>
      </section>
    </div>
  )
}
