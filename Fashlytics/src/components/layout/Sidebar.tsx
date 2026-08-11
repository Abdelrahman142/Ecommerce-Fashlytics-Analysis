import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Compass,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Tags,
  UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/products', label: 'Products', icon: Boxes },
  { to: '/brands', label: 'Brand Intelligence', icon: Tags },
  { to: '/categories', label: 'Category Intelligence', icon: Compass },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/quality', label: 'Data Quality', icon: ShieldCheck },
]

const FOOTER = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'User Profile', icon: UserCircle2 },
]

export function Sidebar({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Item = ({
    to,
    label,
    icon: Icon,
    end,
  }: {
    to: string
    label: string
    icon: typeof LayoutDashboard
    end?: boolean
  }) => (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-ink-2 hover:bg-surface-3 hover:text-ink dark:text-ink-2-dark dark:hover:bg-surface-3-dark dark:hover:text-ink-dark',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 dark:bg-brand-500" />
          )}
          <Icon className="size-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-edge bg-surface transition-[width] duration-300 dark:border-edge-dark dark:bg-surface-dark',
        collapsed ? 'w-[68px]' : 'w-[236px]',
      )}
    >
      {/* logo */}
      <div className={cn('flex h-16 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
          F
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[15px] font-semibold tracking-tight text-ink dark:text-ink-dark">
              Fashlytics
            </p>
            <p className="truncate text-[10.5px] text-ink-3 dark:text-ink-3-dark">Fashion Intelligence</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        <p className={cn('label mb-1.5 px-2.5', collapsed && 'text-center')}>
          {collapsed ? '···' : 'Workspace'}
        </p>
        {NAV.map((n) => (
          <Item key={n.to} {...n} />
        ))}

        <div className="my-3 border-t border-edge dark:border-edge-dark" />
        <p className={cn('label mb-1.5 px-2.5', collapsed && 'text-center')}>
          {collapsed ? '···' : 'Account'}
        </p>
        {FOOTER.map((n) => (
          <Item key={n.to} {...n} />
        ))}
      </nav>

      {/* footer card */}
      {!collapsed && (
        <div className="p-3">
          <div className="rounded-xl border border-edge bg-surface-2 p-3 dark:border-edge-dark dark:bg-surface-2-dark">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink dark:text-ink-dark">
              <LifeBuoy className="size-3.5 text-brand-600 dark:text-brand-400" />
              Help & feedback
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-2 dark:text-ink-2-dark">
              Questions about the platform? We reply within one business day.
            </p>
          </div>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center p-3">
          <LifeBuoy className="size-4 text-ink-3 dark:text-ink-3-dark" />
        </div>
      )}
    </aside>
  )
}
