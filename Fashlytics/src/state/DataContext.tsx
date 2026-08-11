import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface DataCtx {
  /** bumps on every refresh so pages refetch */
  version: number
  refresh: () => void
}

const Ctx = createContext<DataCtx>({ version: 0, refresh: () => {} })

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const value = useMemo(() => ({ version, refresh }), [version, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDataVersion(): DataCtx {
  return useContext(Ctx)
}
