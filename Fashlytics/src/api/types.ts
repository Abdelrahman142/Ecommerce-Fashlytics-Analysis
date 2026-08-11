/** API contracts for the Fashlytics data layer.
 *
 * The frontend talks to these interfaces only. The current implementation
 * serves a static dev bundle (public/mock/*.json, exported from the real
 * processed dataset); swapping in the PostgreSQL backend only changes the
 * implementation of `client.ts`, never these shapes.
 */

export interface Meta {
  product: string
  currency: string
  currency_symbol: string
  snapshot_start: string
  snapshot_end: string
  generated_at: string
  source: string
  data_layer: string
}

export interface Kpis {
  total_products: number
  brands: number
  categories: number
  avg_price: number
  median_price: number
  avg_rating: number
  avg_discount_pct: number
  rating_coverage_pct: number
  products_rated: number
  out_of_stock: number
  in_stock: number
  snapshot_dates: string[]
}

export interface NamedCount {
  name: string
  count: number
}

export interface CategoryDist {
  name: string
  count: number
  avg_price: number | null
  avg_rating: number | null
}

export interface TopBrand {
  brand: string
  count: number
  avg_price: number | null
  avg_rating: number | null
}

export interface BinPoint {
  bin: string
  count: number
}

export interface BandSlice {
  band: string
  count: number
}

export interface OverviewData {
  kpis: Kpis
  category_dist: CategoryDist[]
  top_brands: TopBrand[]
  price_hist: BinPoint[]
  rating_dist: BinPoint[]
  price_bands: BandSlice[]
  rating_buckets: BandSlice[]
  gender_dist: NamedCount[]
  availability: NamedCount[]
}

export interface ProductAttr {
  k: string
  v: string
}

/** Compact product row (dev-layer serialization of the products layer). */
export interface Product {
  id: string
  t: string
  b: string
  c: string
  tcat: string
  g: string
  p: number | null
  m: number | null
  d: number | null
  ed: number | null
  r: number | null
  ha: boolean
  pb: string
  rb: string | null
  av: boolean
  img: string
  na: number
  ic: number
  pk: number | null
  s: string
  u: string
  desc: string
  at: ProductAttr[]
}

export interface ProductsData {
  count: number
  items: Product[]
}

export interface BrandCategorySlice {
  category: string
  count: number
}

export interface Brand {
  brand: string
  products: number
  avg_price: number | null
  avg_rating: number | null
  corrected: number
  suspected_truncated: number
  categories: BrandCategorySlice[]
}

export interface Matrix {
  brands: string[]
  categories: string[]
  counts: number[][]
}

export interface BrandsData {
  count: number
  items: Brand[]
  matrix: Matrix
}

export interface Category {
  name: string
  products: number
  avg_price: number | null
  median_price: number | null
  avg_rating: number | null
  rating_coverage_pct: number | null
  price_hist: BinPoint[]
  top_brands: NamedCount[]
}

export interface CategoriesData {
  count: number
  items: Category[]
}

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL'

export interface QualityCheck {
  check_id: string
  title: string
  category: string
  status: CheckStatus
  records_affected: number
  detail: string
}

export interface QualityData {
  score: number
  score_formula: string
  checks_total: number
  checks_by_status: Record<'PASS' | 'WARN' | 'FAIL' | 'INFO', number>
  totals: { products: number; listings: number; attributes: number }
  valid_records: number
  invalid_records: number
  duplicate_records: number
  missing_values: Record<string, number>
  freshness: {
    snapshot_start: string
    snapshot_end: string
    generated_at: string
  }
  checks: QualityCheck[]
}

export type PageData =
  | OverviewData
  | ProductsData
  | BrandsData
  | CategoriesData
  | QualityData
