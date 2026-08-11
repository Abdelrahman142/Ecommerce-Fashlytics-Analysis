import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useDebounce } from '@/lib/useDebounce'

export interface Option {
  value: string
  label: string
  hint?: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  searchable?: boolean
  className?: string
  label?: string
}

/** Searchable dropdown select. */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'All',
  searchable = false,
  className,
  label,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 100)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const selected = options.find((o) => o.value === value)
  const filtered = debounced
    ? options.filter((o) => o.label.toLowerCase().includes(debounced.toLowerCase()))
    : options

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label && <p className="mb-1.5 text-[11px] font-medium text-ink-3 dark:text-ink-3-dark">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'input flex w-full items-center justify-between gap-2 text-left',
          !selected && 'text-ink-3 dark:text-ink-3-dark',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full min-w-[180px] overflow-hidden rounded-xl border border-edge bg-surface shadow-pop animate-rise dark:border-edge-dark dark:bg-surface-2-dark">
          {searchable && (
            <div className="border-b border-edge p-2 dark:border-edge-dark">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="input h-8 w-full"
              />
            </div>
          )}
          <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
            {filtered.map((o) => {
              const active = o.value === value
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.value)
                      setOpen(false)
                      setQuery('')
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'text-ink hover:bg-surface-3 dark:text-ink-dark dark:hover:bg-surface-3-dark',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && (
                        <span className="block truncate text-[11px] text-ink-3 dark:text-ink-3-dark">
                          {o.hint}
                        </span>
                      )}
                    </span>
                    {active && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-2.5 py-2 text-[13px] text-ink-3 dark:text-ink-3-dark">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
