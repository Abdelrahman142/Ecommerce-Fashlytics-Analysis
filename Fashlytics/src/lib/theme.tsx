import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark'

interface ThemeValue {
  mode: ThemeMode
  toggle: () => void
  /** theme-aware chart palette tokens */
  chart: {
    grid: string
    tick: string
    cursor: string
    tooltipBg: string
    tooltipBorder: string
    categorical: string[]
  }
}

const CHART_COLORS = [
  '#7a66ea', // iris
  '#2ec4b6', // teal
  '#f4a261', // amber
  '#e76f51', // coral
  '#4a9eda', // sky
  '#f06d9e', // rose
  '#8fb573', // sage
  '#b79ced', // lilac
]

const ThemeContext = createContext<ThemeValue | null>(null)

function readInitial(): ThemeMode {
  try {
    const stored = window.localStorage.getItem('fashlytics:theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    try {
      window.localStorage.setItem('fashlytics:theme', mode)
    } catch {
      /* ignore */
    }
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      toggle,
      chart: {
        grid: mode === 'dark' ? '#262a35' : '#e6e8f0',
        tick: mode === 'dark' ? '#6b7080' : '#8a8fa3',
        cursor: mode === 'dark' ? '#1c1f28' : '#f1f3f8',
        tooltipBg: mode === 'dark' ? '#1c1f28' : '#ffffff',
        tooltipBorder: mode === 'dark' ? '#333947' : '#e6e8f0',
        categorical: CHART_COLORS,
      },
    }),
    [mode, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
