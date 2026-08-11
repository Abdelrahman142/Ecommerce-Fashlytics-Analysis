# Architecture & Tool Choices

This document explains the pipeline end-to-end and why each tool was chosen
based on the actual dataset (82.7 MB, 30,000 Flipkart fashion listings).

## 1. Dataset reality drives every choice

Profiling (Phase 1, `docs/data_profile.md`) established the constraints:

- **One file, one array, 30,000 objects** — no DB, no API, 17 top-level fields,
  plus a nested `product_details` map with 127 raw attribute keys.
- **Single snapshot** — `crawled_at` is 2021-10-02 or 2021-11-02; there is no
  time series. Anything requiring price history or trends is impossible.
- **No ratings detail** — only `average_rating`; no rating counts or review
  text. `has_rating` is derived; buckets (`low/mid/high`) are degenerate dims.
- **No stock quantity, no seller rating, no sales** — only in/out-of-stock
  flags. Documented as unsupported; never fabricated.

## 2. Pipeline stages

```
raw JSON ──> extraction (ijson) ──> validation ──> cleaning ──> transformation
                                                                     │
                                        rejections (data/rejected)   ▼
                                                     processed layer (parquet/csv)
                                                                     │
                                        loading (COPY)               ▼
                                                        PostgreSQL star schema
                                                                     │
                                                        analytics views (vw_*)
                                                                     │
                                                        Streamlit dashboard
```

### Ingestion — `src/ingestion/extract.py`
`ijson` streams the 82.7 MB array record-by-record (only a few KB in memory),
collects brand/seller vocabularies for cleaning, and detects duplicates.

### Validation — `src/validation/validate.py`
Structural rules: required fields present and typed, `actual_price`/MRP and
`selling_price` non-negative, `average_rating` in 0..5, `crawled_at` parseable,
`images` a list. Malformed records go to `data/rejected/rejected_records.jsonl`.

### Transformation — `src/transformation/`
- `clean.py` — brand canonicalization **restricted to the seller vocabulary**
  (prevents truncation propagation), sub-category normalization, the 127→120
  attribute-key canonical mapping.
- `transform.py` — derives gender (from `Ideal For` + title keywords), price
  band, discount vs effective discount, out-of-stock/rating flags, dedupes
  products (28,080 from 30,000 listings), builds the wide 87-column table, the
  long-form EAV (`product_attributes`), and pivots 40 key attributes.

### Loading — `src/loading/`
- `load.py` — writes the processed/rejected layers (parquet + csv + report).
- `postgres.py` — deterministic surrogate keys, bulk `COPY` into the star
  schema (id 0 = `Unknown` reference rows seeded by the schema).

## 3. Storage & database

**PostgreSQL 17** in a dedicated Docker container (`fashion-bi-postgres`, host
port **5433** because `5432` is occupied by an unrelated `dcim-db` container).
Volume `fashion_bi_pgdata` persists data; `scripts/db_init.sh` is idempotent
(drop/recreate schema + indexes + views).

Star schema (`sql/00_schema.sql`):
- `fact_products` — grain product × snapshot; 28,080 rows, degenerate
  `rating_bucket` / `price_band`, CHECK constraints enforce business sanity.
- `dim_product`, `dim_brand` (320), `dim_category` (16), `dim_gender` (4),
  `dim_seller` (500) — each with an id-0 `Unknown` row for FK integrity.
- `product_attributes` — EAV table for attribute-level analytics (374,704 rows).
- Rejected dims (documented): `dim_rating`, `dim_date` — not supported by data.

Analytics layer (`sql/03_views.sql`): 15 reusable `vw_*` views power the
dashboard; `sql/04_dashboard_metrics.sql` implements the Phase 6 metric list.

## 4. Tool choices

| Layer | Tool | Rationale |
|---|---|---|
| Parsing | `ijson` | streaming for a 82.7 MB array; constant memory |
| Transformation | pandas | vectorized wide pivot (120 attr keys → 40 columns) and group-by; the natural fit for row-shaped listing records |
| Columnar I/O | PyArrow/parquet | ~40× smaller processed layer than the JSON source; typed round-trip |
| Database | PostgreSQL 17 (Docker) | enterprise-grade SQL for the analytics layer; COPY for bulk load |
| SQL driver | psycopg 3 | modern `copy` API + reliable adaptation |
| Dashboard | Streamlit + Plotly | fast to build, native Python, live DB queries, professional enough for a client demo |
| Tests | pytest | 15 tests including an end-to-end synthetic pipeline (proves the rejected layer) |
| Orchestration | bash + `python -m` | zero extra infra; `db_init.sh` is the single reproduce-DB entry point |

**Polars** was considered for transformation but rejected: the workload is one
small dataset (28k products, 40 attrs) where pandas already exceeds all
performance needs; Polars would add a second dependency without measurable
benefit. **Superset/Metabase** were rejected: they are server apps requiring
their own provisioning; a single-file Streamlit app is easier to review, run,
and hand over.

## 5. Reproducibility

1. `data/raw` ← byte-identical copy of the source (SHA-256 verified).
2. ETL is deterministic → `data/processed` is regenerable.
3. `db_init.sh` recreates the schema+views; `postgres.py` re-loads everything.
4. `git` tracks only code/SQL/docs; large data is ignored (`.gitignore`).
