import type { OverviewData, ProductsData } from './types'

export type InsightTone = 'accent' | 'positive' | 'info' | 'warn'

export interface Insight {
  id: string
  icon: string // lucide icon key, resolved in the UI
  title: string
  text: string
  tone: InsightTone
}

function pctShare(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100
}

/** Business insights computed from the actual data — nothing hardcoded. */
export function buildInsights(o: OverviewData, p: ProductsData): Insight[] {
  const k = o.kpis
  const total = k.total_products
  const items = p.items
  const insights: Insight[] = []

  const dominant = [...o.gender_dist].sort((a, b) => b.count - a.count)[0]
  if (dominant && dominant.count / total > 0.5) {
    insights.push({
      id: 'gender-dominant',
      icon: 'users',
      title: `${dominant.name} fashion dominates the catalog`,
      text: `${dominant.name} products account for ${pctShare(dominant.count, total).toFixed(1)}% of the ${total.toLocaleString('en-IN')}-product catalog.`,
      tone: 'accent',
    })
  }

  const top = o.top_brands[0]
  if (top) {
    insights.push({
      id: 'top-brand',
      icon: 'trophy',
      title: `${top.brand} has the largest catalog`,
      text: `The brand leads with ${top.count.toLocaleString('en-IN')} products — ${pctShare(top.count, total).toFixed(1)}% of all listings.`,
      tone: 'accent',
    })
  }

  const luxuryLike = o.price_bands
    .filter((b) => b.band === 'premium' || b.band === 'luxury')
    .reduce((sum, b) => sum + b.count, 0)
  insights.push({
    id: 'premium-share',
    icon: 'gem',
    title: `Premium and luxury make up ${pctShare(luxuryLike, total).toFixed(1)}% of the catalog`,
    text: `${luxuryLike.toLocaleString('en-IN')} products sit in the premium (₹1,500–₹3,999) or luxury (₹4,000+) price bands.`,
    tone: 'positive',
  })

  const rated = items.filter((i) => i.ha)
  const highRated = rated.filter((i) => i.r != null && i.r > 4.5).length
  if (rated.length > 0) {
    insights.push({
      id: 'high-rated',
      icon: 'star',
      title: `${pctShare(highRated, rated.length).toFixed(1)}% of rated products score above 4.5`,
      text: `${highRated.toLocaleString('en-IN')} of ${rated.length.toLocaleString('en-IN')} rated products achieve a top rating — a merchandising quality signal.`,
      tone: 'positive',
    })
  }

  const unrated = total - rated.length
  if (unrated > 0) {
    insights.push({
      id: 'rating-gap',
      icon: 'shield-alert',
      title: `${pctShare(unrated, total).toFixed(1)}% of the catalog has no rating`,
      text: `${unrated.toLocaleString('en-IN')} products lack ratings — a data gap to close before relying on rating-based decisions.`,
      tone: 'warn',
    })
  }

  const oos = k.out_of_stock
  if (oos > 0) {
    insights.push({
      id: 'oos',
      icon: 'package-x',
      title: `${oos.toLocaleString('en-IN')} products are currently out of stock`,
      text: `${pctShare(oos, total).toFixed(1)}% of the catalog is unavailable — review restocking and catalogue hygiene.`,
      tone: 'warn',
    })
  }

  if (k.avg_discount_pct != null) {
    insights.push({
      id: 'discount',
      icon: 'percent',
      title: `The average effective discount is ${k.avg_discount_pct.toFixed(1)}%`,
      text: 'Listed MRP sits well above realised selling prices across categories — treat MRP as an anchor, not a fair price.',
      tone: 'info',
    })
  }

  return insights.slice(0, 6)
}
