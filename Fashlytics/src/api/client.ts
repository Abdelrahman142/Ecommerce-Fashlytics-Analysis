import type {
  BrandsData,
  CategoriesData,
  Meta,
  OverviewData,
  ProductsData,
  QualityData,
} from './types'

/**
 * Data access layer. The default implementation reads the static dev bundle
 * under `public/mock/` (real figures exported from the processed dataset).
 * Point `VITE_API_BASE` at a real HTTP backend later and reimplement these
 * five functions against it — nothing else in the app needs to change.
 */

const BASE: string = import.meta.env.VITE_API_BASE ?? '/mock'
const cache = new Map<string, Promise<unknown>>()

async function getJSON<T>(path: string): Promise<T> {
  const key = `${BASE}/${path}`
  let promise = cache.get(key) as Promise<T> | undefined
  if (!promise) {
    promise = (async () => {
      const res = await fetch(key)
      if (!res.ok) {
        throw new Error(`${path}: request failed (HTTP ${res.status})`)
      }
      return (await res.json()) as T
    })()
    cache.set(key, promise)
  }
  return promise
}

/** Drop the cache so the next read refetches (data refresh action). */
export function invalidateDataCache(): void {
  cache.clear()
}

export interface Api {
  meta: () => Promise<Meta>
  overview: () => Promise<OverviewData>
  products: () => Promise<ProductsData>
  brands: () => Promise<BrandsData>
  categories: () => Promise<CategoriesData>
  quality: () => Promise<QualityData>
}

export const api: Api = {
  meta: () => getJSON<Meta>('meta.json'),
  overview: () => getJSON<OverviewData>('overview.json'),
  products: () => getJSON<ProductsData>('products.json'),
  brands: () => getJSON<BrandsData>('brands.json'),
  categories: () => getJSON<CategoriesData>('categories.json'),
  quality: () => getJSON<QualityData>('quality.json'),
}
