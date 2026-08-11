import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: string
}

/** Right-side slide-over panel with backdrop. */
export function Drawer({ open, onClose, title, children, footer, width = 'max-w-xl' }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px] dark:bg-black/60"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col bg-surface shadow-pop animate-rise dark:bg-surface-2-dark',
          width,
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between gap-3 border-b border-edge px-5 py-4 dark:border-edge-dark">
          <div className="min-w-0 flex-1">{title}</div>
          <button
            className="btn-ghost size-8 shrink-0 rounded-lg p-0"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="border-t border-edge px-5 py-3 dark:border-edge-dark">{footer}</footer>
        )}
      </div>
    </div>
  )
}
