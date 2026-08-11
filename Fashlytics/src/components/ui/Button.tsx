import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'outline' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({
  variant = 'outline',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' &&
          'bg-brand-600 text-white shadow-sm hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600',
        variant === 'outline' &&
          'border border-edge bg-surface text-ink-2 hover:border-edge-2 hover:text-ink dark:border-edge-dark dark:bg-transparent dark:text-ink-2-dark dark:hover:border-edge-2-dark dark:hover:text-ink-dark',
        variant === 'ghost' &&
          'text-ink-2 hover:bg-surface-3 hover:text-ink dark:text-ink-2-dark dark:hover:bg-surface-3-dark dark:hover:text-ink-dark',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}
