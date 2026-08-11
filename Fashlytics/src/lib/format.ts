const inr = (opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('en-IN', opts)

export const fmtInt = (n: number | null | undefined): string =>
  n == null ? '—' : inr({ maximumFractionDigits: 0 }).format(n)

export const fmtCompact = (n: number | null | undefined): string =>
  n == null ? '—' : inr({ notation: 'compact', maximumFractionDigits: 1 }).format(n)

export const fmtMoney = (
  n: number | null | undefined,
  symbol = '₹',
  digits = 0,
): string => (n == null ? '—' : `${symbol}${inr({ maximumFractionDigits: digits }).format(n)}`)

export const fmtMoneyCompact = (n: number | null | undefined, symbol = '₹'): string =>
  n == null ? '—' : `${symbol}${fmtCompact(n)}`

export const fmtRating = (n: number | null | undefined): string =>
  n == null ? '—' : n.toFixed(1)

export const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? '—' : `${n.toFixed(digits)}%`

export const fmtDate = (iso: string | undefined, opts?: Intl.DateTimeFormatOptions): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', ...opts })
}

export const fmtDateTime = (iso: string | undefined): string =>
  fmtDate(iso, { hour: '2-digit', minute: '2-digit' })
