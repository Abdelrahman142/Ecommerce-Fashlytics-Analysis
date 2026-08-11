import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import type { Product } from '@/api/types'
import { Select, type Option } from '@/components/ui/Select'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'

export interface ProductFiltersState {
  q: string
  brand: string
  category: string
  gender: string
  priceBand: string
  rating: string
  availability: string
  priceMin: number | null
  priceMax: number | null
}

export const DEFAULT_FILTERS: ProductFiltersState = {
  q: '',
  brand: 'all',
  category: 'all',
  gender: 'all',
  priceBand: 'all',
  rating: 'all',
  availability: 'all',
  priceMin: null,
  priceMax: null,
}

export function priceRangeOptions(): Option[] {
  return [
    { value: 'all', label: 'Any price' },
    { value: 'u500', label: 'Under ₹500' },
    { value: '500-1500', label: '₹500 – ₹1,500' },
    { value: '1500-4000', label: '₹1,500 – ₹4,000' },
    { value: '4000+', label: '₹4,000+' },
  ]
}

export const ratingOptions: Option[] = [
  { value: 'all', label: 'Any rating' },
  { value: '4', label: '4.0 & above' },
  { value: '3', label: '3.0 & above' },
  { value: '1', label: '1.0 & above' },
]

export function applyFilters(items: Product[], f: ProductFiltersState): Product[] {
  const q = f.q.trim().toLowerCase()
  let range: [number, number] | null = null
  if (f.priceBand !== 'all') {
    const r = f.priceBand
    if (r === 'u500') range = [0, 500]
    else if (r === '500-1500') range = [500, 1500]
    else if (r === '1500-4000') range = [1500, 4000]
    else if (r === '4000+') range = [4000, Number.POSITIVE_INFINITY]
  }
  if (f.priceMin != null || f.priceMax != null) {
    range = [f.priceMin ?? 0, f.priceMax ?? Number.POSITIVE_INFINITY]
  }
  const minRating = f.rating === '4' ? 4 : f.rating === '3' ? 3 : f.rating === '1' ? 1 : null

  return items.filter((p) => {
    if (q && !p.t.toLowerCase().includes(q) && !p.b.toLowerCase().includes(q)) return false
    if (f.brand !== 'all' && p.b !== f.brand) return false
    if (f.category !== 'all' && p.c !== f.category) return false
    if (f.gender !== 'all' && p.g !== f.gender) return false
    if (range) {
      if (p.p == null) return false
      if (p.p < range[0] || p.p > range[1]) return false
    }
    if (minRating != null && (p.r == null || p.r < minRating)) return false
    if (f.availability === 'in' && !p.av) return false
    if (f.availability === 'out' && p.av) return false
    return true
  })
}

interface ProductFiltersProps {
  filters: ProductFiltersState
  onChange: (f: ProductFiltersState) => void
  brands: Option[]
  categories: Option[]
  genders: Option[]
  resultCount: number
}

export function ProductFilters({
  filters,
  onChange,
  brands,
  categories,
  genders,
  resultCount,
}: ProductFiltersProps) {
  const set = (patch: Partial<ProductFiltersState>) => onChange({ ...filters, ...patch })
  const dirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-ink-dark">
          <SlidersHorizontal className="size-4 text-brand-600 dark:text-brand-400" />
          Filters
          <span className="tnum rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-ink-2 dark:bg-surface-3-dark dark:text-ink-2-dark">
            {resultCount.toLocaleString('en-IN')} matches
          </span>
        </p>
        {dirty && (
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.q}
          onChange={(v) => set({ q: v })}
          placeholder="Search product or brand…"
          className="sm:col-span-2"
        />
        <Select label="Brand" value={filters.brand} onChange={(v) => set({ brand: v })} options={brands} searchable />
        <Select label="Category" value={filters.category} onChange={(v) => set({ category: v })} options={categories} searchable />
        <Select label="Gender" value={filters.gender} onChange={(v) => set({ gender: v })} options={genders} />
        <Select label="Price" value={filters.priceBand} onChange={(v) => set({ priceBand: v })} options={priceRangeOptions()} />
        <Select label="Rating" value={filters.rating} onChange={(v) => set({ rating: v })} options={ratingOptions} />
        <Select
          label="Availability"
          value={filters.availability}
          onChange={(v) => set({ availability: v })}
          options={[
            { value: 'all', label: 'Any status' },
            { value: 'in', label: 'In stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
      </div>
    </div>
  )
}
