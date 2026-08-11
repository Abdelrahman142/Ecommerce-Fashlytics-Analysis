import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useTheme } from '@/lib/theme'
import { DataProvider } from '@/state/DataContext'
import { Sidebar } from './Sidebar'
import { TopbarChrome } from './Topbar'
import { CommandPalette } from './CommandPalette'

export function AppShell({ children }: { children: ReactNode }) {
  const { toggle } = useTheme()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useLocalStorage('fashlytics:sidebar', false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <DataProvider>
      <div className="flex h-screen overflow-hidden bg-surface-2 dark:bg-surface-dark">
        {/* desktop sidebar */}
        <div className="hidden lg:block">
          <div className="h-screen">
            <Sidebar collapsed={collapsed} />
          </div>
        </div>

        {/* mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px] dark:bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 h-full animate-rise">
              <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-edge bg-surface px-4 dark:border-edge-dark dark:bg-surface-dark/90 lg:px-6">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="btn-ghost hidden size-9 shrink-0 rounded-lg p-0 lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="size-[18px]" /> : <ChevronLeft className="size-[18px]" />}
            </button>
            <TopbarChrome
              onOpenPalette={() => setPaletteOpen(true)}
              onToggleSidebar={() => setMobileOpen(true)}
              onToggleTheme={toggle}
              onOpenProfile={() => navigate('/profile')}
            />
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] p-4 lg:p-6">{children}</div>
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </DataProvider>
  )
}
