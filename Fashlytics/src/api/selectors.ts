import type { Product } from './types'

export interface FiveNum {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function fiveNum(values: number[]): FiveNum {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    min: sorted[0] ?? 0,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] ?? 0,
  }
}

export interface CategoryAgg {
  category: string
  count: number
  price: FiveNum
  avg_price: number
  avg_rating: number | null
  rated_count: number
  coverage_pct: number
}

/** Client-side aggregates over the products layer (dev fallback to the API). */
export function aggregateByCategory(items: Product[]): CategoryAgg[] {
  const by = new Map<string, { prices: number[]; ratings: number[] }>()
  for (const it of items) {
    let bucket = by.get(it.c)
    if (!bucket) {
      bucket = { prices: [], ratings: [] }
      by.set(it.c, bucket)
    }
    if (it.p != null) bucket.prices.push(it.p)
    if (it.r != null) bucket.ratings.push(it.r)
  }
  const out: CategoryAgg[] = []
  for (const [category, bucket] of by) {
    const sum = bucket.prices.reduce((a, b) => a + b, 0)
    const ratingSum = bucket.ratings.reduce((a, b) => a + b, 0)
    out.push({
      category,
      count: bucket.prices.length,
      price: fiveNum(bucket.prices),
      avg_price: bucket.prices.length ? sum / bucket.prices.length : 0,
      avg_rating: bucket.ratings.length ? ratingSum / bucket.ratings.length : null,
      rated_count: bucket.ratings.length,
      coverage_pct: bucket.prices.length
        ? (bucket.ratings.length / bucket.prices.length) * 100
        : 0,
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

export interface PriceByCategoryPoint {
  category: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export function priceByCategory(items: Product[]): PriceByCategoryPoint[] {
  return aggregateByCategory(items).map((c) => ({
    category: c.category,
    min: c.price.min,
    q1: c.price.q1,
    median: c.price.median,
    q3: c.price.q3,
    max: c.price.max,
  }))
}

export interface HistogramPoint {
  bin: string
  count: number
}

export function histogram(
  values: number[],
  width: number,
  max: number,
): HistogramPoint[] {
  const counts = new Map<number, number>()
  let overflow = 0
  for (const v of values) {
    const idx = Math.floor(v / width)
    if (idx * width >= max) overflow++
    else counts.set(idx, (counts.get(idx) ?? 0) + 1)
  }
  const out: HistogramPoint[] = []
  for (let i = 0; i * width < max; i++) {
    const lo = i * width
    out.push({ bin: `${lo}–${lo + width}`, count: counts.get(i) ?? 0 })
  }
  if (overflow > 0) out.push({ bin: `${max}+`, count: overflow })
  return out
}
