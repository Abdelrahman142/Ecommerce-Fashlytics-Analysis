import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import { useAsync } from '@/lib/useAsync'
import { useDataVersion } from '@/state/DataContext'
import type { Option } from '@/components/ui/Select'
import { ProductFilters, applyFilters, DEFAULT_FILTERS, type ProductFiltersState } from '@/components/products/ProductFilters'
import { ProductTable } from '@/components/products/ProductTable'
import { ProductDetailDrawer } from '@/components/products/ProductDetailDrawer'
import { PageSkeleton, ErrorState, EmptyDatasetState } from '@/components/ui/States'

export function ProductsPage() {
  const { version } = useDataVersion()
  const { data, error, loading, reload } = useAsync(() => api.products(), [version])
  const { data: meta } = useAsync(() => api.meta(), [version])
  const [filters, setFilters] = useState<ProductFiltersState>(DEFAULT_FILTERS)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('pid')

  const brandOptions: Option[] = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    for (const p of data.items) map.set(p.b, (map.get(p.b) ?? 0) + 1)
    return [
      { value: 'all', label: 'All brands' },
      ...[...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ value: name, label: name, hint: `${count.toLocaleString('en-IN')} products` })),
    ]
  }, [data])

  const categoryOptions: Option[] = useMemo(() => {
    if (!data) return []
    const map = new Map<string, number>()
    for (const p of data.items) map.set(p.c, (map.get(p.c) ?? 0) + 1)
    return [
      { value: 'all', label: 'All categories' },
      ...[...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ value: name, label: name, hint: `${count.toLocaleString('en-IN')} products` })),
    ]
  }, [data])

  const genderOptions: Option[] = useMemo(() => {
    if (!data) return []
    const set = new Set(data.items.map((p) => p.g))
    return [{ value: 'all', label: 'All genders' }, ...[...set].map((g) => ({ value: g, label: g }))]
  }, [data])

  const filtered = useMemo(
    () => (data ? applyFilters(data.items, filters) : []),
    [data, filters],
  )

  const selected = useMemo(
    () => (data ? (data.items.find((p) => p.id === selectedId) ?? null) : null),
    [data, selectedId],
  )

  const closeDrawer = () => {
    const next = new URLSearchParams(params)
    next.delete('pid')
    setParams(next, { replace: true })
  }

  if (loading || !data) return <PageSkeleton />
  if (error) return <ErrorState description={error} onRetry={reload} />
  if (data.count === 0) return <EmptyDatasetState />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Product Explorer</h1>
        <p className="page-subtitle mt-1">Search, filter and explore the complete fashion catalog.</p>
      </div>

      <ProductFilters
        filters={filters}
        onChange={setFilters}
        brands={brandOptions}
        categories={categoryOptions}
        genders={genderOptions}
        resultCount={filtered.length}
      />

      <ProductTable items={filtered} onOpen={(id) => setParams({ pid: id })} currencySymbol={meta?.currency_symbol ?? '₹'} />

      <ProductDetailDrawer
        product={selected}
        onClose={closeDrawer}
        products={data.items}
        currencySymbol={meta?.currency_symbol ?? '₹'}
      />
    </div>
  )
}
