# Flipkart Fashion Product Intelligence Platform

A production-style analytics platform built from a single 82.7 MB snapshot of
Flipkart fashion product listings (30,000 records, Oct/Nov 2021). The project
runs the full analytics lifecycle — profiling, ETL, star-schema modelling,
PostgreSQL loading, an analytics view layer, an automated data-quality suite,
and a live interactive dashboard.

## Project Overview

- **Input**: one immutable JSON snapshot of 30,000 Flipkart fashion listings.
- **Output**: a queryable star-schema warehouse (`fashion_bi` on Postgres),
  a 15-view analytics layer, a generated data-quality report, and a Streamlit
  BI dashboard.
- **Tooling**: Python 3.12 (pandas, pyarrow, ijson, psycopg, plotly),
  PostgreSQL 17, Streamlit, pytest.
- **Status**: all 10 phases complete; 21/21 tests pass; 51/51 ETL checks pass;
  0 FAIL across 34 data-quality checks.

## Business Problem

Flipkart's fashion catalogue is noisy: raw brands contain truncation and
typos, sub-categories are polluted by titles, ratings and prices are
inconsistent, and gender is rarely explicit. Analysts need a clean, trusted,
queryable view of the catalogue to answer questions such as:

- What is the pricing/discount distribution across categories and brands?
- Where are the price-band gaps (budget vs premium) by category?
- How do ratings correlate with price, discounts, and stock status?
- Which brands dominate shelf share within each category?

The platform turns the messy snapshot into a governed warehouse plus a
dashboard that answers these questions directly.

## Dataset Description

| Layer | Rows | Notes |
|---|---|---|
| listings (raw snapshot) | 30,000 | catalog entries; 1,920 share a `product_id` |
| products (clean, deduped) | 28,080 | one row per product |
| product_attributes (EAV) | 403,277 raw / 374,704 deduped | heterogeneous key-value detail |

Key fields: `product_id`, `listing_id`, title, brand (+ cleaned
`brand_canonical`), category/sub_category (+ normalized flag), prices
(`mrp`, `selling_price`), discounts, `avg_rating`, rating/price buckets,
gender, pack size, image count, stock status, seller, 30+ attributes
(color, fabric, fit, …).

Limitations (documented in `docs/data_profile.md`): the source provides **no
sales, reviews, ratings count, seller rating, stock quantity, or price
history** — these are not fabricated; KPIs use the fields that do exist
(e.g. `avg_rating` presence, discounts, stock status).

## Architecture

```
flipkart_fashion_products_dataset.json (raw, immutable)
   │  streaming extract (ijson)
   ▼
raw/ ──► validation ──► cleaning ──► transformation ──► processed/
                                                        │  products.parquet
                                                        │  listings.parquet
                                                        │  product_attributes.parquet
                                                        │  etl_report.json
   │  bulk COPY loader (src/loading/postgres.py)
   ▼
PostgreSQL 17 (docker: fashion-bi-postgres, :5433)
   │  00_schema.sql · 01_indexes.sql · 03_views.sql · 04_dashboard_metrics.sql
   ▼
vw_* analytics views (15) ──► Streamlit dashboard (live DB queries)
   ▲
src/quality/ ──► docs/data_quality.md · data/processed/quality_report.json
```

Full design rationale lives in `docs/architecture.md`.
## Screenshots
<img width="1280" height="831" alt="image" src="https://github.com/user-attachments/assets/1202c332-a3b6-4d36-ab2d-9dcbe95c01af" />




## Data Pipeline

1. **Extraction** — `ijson` streams the 82.7 MB JSON array without loading it
   into memory; records land in `data/raw/`.
2. **Validation** — structural checks (required ids, types, known taxonomy);
   rejects go to `data/rejected/` (the snapshot has 0 hard rejects).
3. **Cleaning** — brand truncation repaired using a seller-vocabulary map
   (`brand_canonical`, `brand_corrected`, `brand_suspected_truncated`),
   polluted sub-categories salvaged into a 16-value canonical taxonomy
   (`sub_category_normalized`, `is_category_anomaly`), gender inferred from
   pattern/keyword evidence.
4. **Transformation** — pack-of extraction, effective discount recompute,
   price bands (`budget/mid/premium/luxury`), rating buckets
   (`low/mid/high`), product roll-ups (image count, attribute count,
   listing list, min/max price).
5. **Loading** — parquet + CSV processed layer, then bulk `COPY` into
   Postgres with a `fashion_bi` star schema.
6. **Verification** — `scripts/verify_etl.py` (51 checks) and the pytest suite
   (21 tests).

Run the whole pipeline with:

```bash
bash scripts/db_init.sh                       # drop/recreate + schema/indexes/views
.venv/bin/python scripts/run_etl.py           # raw → processed
.venv/bin/python scripts/verify_etl.py        # 51 ETL checks
.venv/bin/python -m src.loading.postgres      # processed → Postgres
.venv/bin/python -m pytest tests/ -q          # 21 tests
```

## Data Model

Star schema in PostgreSQL (`sql/00_schema.sql`), grain = product × snapshot date:

```
dim_brand (320) ────┐
dim_category (16) ──┼── fact_products (28,080) ── dim_seller (500)
dim_gender (4) ─────┘                            └── dim_product (28,080)
                                   │
                        product_attributes (374,704)  — EAV detail
```

- `fact_products`: prices, discounts, rating + buckets, stock flags,
  seller FK, brand/category/gender FKs, roll-up counts.
- `product_attributes`: heterogeneous attribute key-values in EAV form.
- All five FKs verified at 0 orphans; check constraints (`pack_of >= 1`,
  `selling_price <= mrp`) enforced at the database level.
- `sql/03_views.sql` exposes 15 `vw_*` analytics views (top brands, price-band
  gaps, rating × price cross-tabs, seller concentration, …).

See `docs/data_model.md` for the full field-by-field reference.

## Technologies

| Area | Choice | Why |
|---|---|---|
| Extraction | `ijson` streaming | 82.7 MB single array; no full-file load |
| Tabular | pandas + pyarrow parquet | pivot/wide transforms; compact columnar I/O |
| Warehouse | PostgreSQL 17 (Docker) | dedicated container `fashion-bi-postgres` on :5433 |
| Loader | psycopg `COPY` | fastest bulk path; Decimal/date coercion handled |
| Analytics | SQL views + metrics | logic lives in SQL, reused by the dashboard |
| BI | Streamlit + Plotly | live DB queries, filter-driven, client-handover friendly |
| Quality | pandas assertions | 34 checks → JSON + Markdown report |
| Tests | pytest | 21 tests incl. full ETL smoke run |

## Data Quality

An automated quality suite (`src/quality/`) runs 34 checks across eight
categories — nulls, duplicates, prices, ratings, categories, brands, IDs and
types — and renders `docs/data_quality.md` + `data/processed/quality_report.json`.

```
.venv/bin/python scripts/run_quality_checks.py
```

**Current result: 0 FAIL · 5 WARN · 24 PASS · 5 INFO.** The five warnings are
documented dataset characteristics, not defects:

- **B1 / D1 / D2** — 2,009 products carry no raw brand (mapped to an
  `Unknown` brand); 1,920 listings share a `product_id`; 549 products appear
  under multiple listings (up to 25).
- **B4** — 14,156 brands are ≥ 10 chars and kept verbatim because the seller
  vocabulary cannot corroborate a longer expansion.
- **D4** — 28,573 duplicate attribute triples remain in the raw EAV artifact;
  they are deduplicated at load time (374,704 rows in the DB).

Checks reuse the exact `PRICE_BANDS` / `RATING_BUCKETS` thresholds from
`src/config.py`, so validation mirrors the ETL's own definitions (verified
against `data/processed` and enforced again by CHECK constraints in Postgres).

## Analytics

`sql/02_analytics_queries.sql` and the view layer answer the Phase-2 business
questions. Representative findings from the current snapshot:

- 12,922 budget items vs 97 luxury — a 133x shelf-share gap between bands.
- 8,130 products rated ≥ 4.0 vs 2,260 with no rating at all; rating coverage
  differs sharply by category.
- Average `effective_discount_pct` is 50.5%; mean MRP ₹1,456 vs mean selling
  ₹706.
- 27,118 of 28,080 products sit in "Clothing and Accessories"; 26,504 are
  men's fashion.

## Dashboard

Streamlit app (`dashboard/app.py`) with 4 sections and a global filter bar
(brand, category, gender, price range, min rating):

```bash
.venv/bin/streamlit run dashboard/app.py
```

- **Overview**: 6 KPI cards (products, brands, avg price, avg discount,
  rating coverage, out-of-stock share).
- **Categories & Brands**: shelf-share treemaps, top-brand tables, price-band
  distribution.
- **Pricing & Discounts**: discount histograms, MRP vs selling scatter,
  price-band gaps by category.
- **Ratings & Stock**: rating-bucket splits, rating × price cross-tabs,
  out-of-stock hotspots.

Verified with Streamlit's `AppTest` (0 exceptions on baseline and filtered
runs) and an HTTP smoke check. Connection defaults to
`localhost:5433/fashion_bi` with `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`
overrides.

## Fashlytics Dashboard (`fashlytics/`)

A premium, portfolio-ready SaaS-style analytics frontend built on the same
processed dataset. React 19 + TypeScript + Tailwind CSS v4 + Recharts 3,
with a design system (light/dark themes, iris brand palette, Inter typeface)
and a fully componentized UI kit (`src/components/`).

Six working views:

- **Overview** — 5 KPI cards, category & brand leaderboards, price/rating
  histograms, 4 distribution donuts, auto-computed insight cards.
- **Products** — searchable/sortable/filterable catalogue table with CSV
  export, deep-linkable detail drawer (`?pid=…`) and price-positioning
  comparison vs category/brand averages.
- **Brand Intelligence** — 319 brands, KPI cards, margin/rating charts, a
  brand × category share heatmap, and a drill-in drawer.
- **Category Intelligence** — 15 fashion segments (sub_category taxonomy),
  price-range charts, and a multi-select comparison tool.
- **Analytics** — global filters driving price × rating scatter, range,
  rating and category charts.
- **Data Quality** — live health score (96.3 / 100 from 29 checks),
  status breakdown (24 PASS · 5 WARN · 0 FAIL), missing-value bars and a
  per-check table.

Architecture: the frontend talks only to contracts in `src/api/`; the static
dev layer serves real figures exported from the processed warehouse via
`scripts/export_dashboard_data.py` (28,080 products, 319 brands, 15
categories → `fashlytics/public/mock/*.json`, ~30 MB). Swapping in the
PostgreSQL backend later only changes `src/api/client.ts`
(`VITE_API_BASE`), never page code.

```bash
# regenerate the dev data bundle from data/processed
.venv/bin/python scripts/export_dashboard_data.py

# run the dashboard
cd fashlytics
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle (dist/)
```

## How to Run

```bash
# 1. environment
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. ETL (raw → processed)                      # ~2 min on the 82.7 MB file
.venv/bin/python scripts/run_etl.py
.venv/bin/python scripts/verify_etl.py

# 3. PostgreSQL (Docker, port 5433)
bash scripts/db_init.sh
.venv/bin/python -m src.loading.postgres
docker exec -i fashion-bi-postgres psql -U postgres -d fashion_bi \
  -v ON_ERROR_STOP=1 < sql/04_dashboard_metrics.sql

# 4. quality report
.venv/bin/python scripts/run_quality_checks.py

# 5. dashboard
.venv/bin/streamlit run dashboard/app.py

# 6. tests
.venv/bin/python -m pytest tests/ -q
```

## Example Insights

1. **Price-band gaps are the headline finding.** Budget (12,922) outsells
   luxury (97) on shelf share by >130x, yet the top brands (Ecko Unlimited
   951, Free Authority 860, ARBO 806) all compete in the mid band — a pricing
   white space above ₹4,000.
2. **Discounts are deep and uniform.** A 50.5% mean effective discount with
   MRP→selling compression across every category signals habitual list-price
   marking; analysts should treat `mrp` as an anchor, not a fair price.
3. **Rating coverage is a data gap, not an absence of quality.** 2,260 of
   28,080 products are unrated; before using ratings for merchandising,
   close that coverage gap first.
4. **The catalogue is a men's clothing mono-culture** (26,504 men's rows,
   27,118 in one category) — category/brand expansion is a higher-leverage
   lever than pricing within it.

## Future Improvements

- **Incremental loads**: `snapshot_date` already enables append-only
  partitions; add change tracking for re-priced/restocked products.
- **Seller analytics**: the snapshot omits seller rating and sales — joining
  real seller tables would unlock marketplace-power curves.
- **Search & recommend**: the EAV attribute store is ideal for faceted search
  and content-based recommendation (same brand/category/attributes).
- **Full pipeline refresh**: re-run ETL on a current snapshot; the quality
  gate (0 FAIL) blocks warehouse promotion automatically.
- **dbt-style lineage**: surface ETL audit columns (`brand_corrected`,
  `is_category_anomaly`) as governed dbt models with tests.

---

*Phases 1-10 · data profiling → ETL → modelling → warehouse → analytics →
dashboard → quality. Docs: `docs/` (architecture, data model, profile,
business questions, quality).*
