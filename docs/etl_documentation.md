# Phase 3 — ETL Pipeline Documentation

**Pipeline:** `Extract → Validate → Clean → Transform → Load`
**Code:** `etl/` package (entry: `scripts/run_etl.py` or `python -m etl.run`)
**Verify:** `scripts/verify_etl.py` (51 integrity checks) and `tests/` (pytest)
**Report artifact:** `data/processed/etl_report.json` (auto-generated on every run)

---

## 1. Layer Design

```
data/raw/        flipkart_fashion_products_dataset.json
                 ^ byte-identical landing copy of the original (SHA-256 verified).
                   The original file at repo root is never touched.
data/processed/  listings.parquet|csv           30,000 rows (1 per raw record)
                 products.parquet|csv           28,080 rows (1 per unique product)
                 product_attributes.parquet|csv 403,277 rows (EAV attribute table)
                 attribute_key_mapping.csv       original -> canonical attribute key map
                 etl_report.json                 run audit: counts, flags, lineage
data/rejected/   rejected_records.jsonl          structurally invalid records + reason
                 (empty on the real dataset — 0 malformed records; machinery is
                  exercised by tests/test_etl.py with synthetic malformed input)
```

Every processed table is written in both Parquet (typed/columnar) and CSV (portable).

---

## 2. Pipeline Stages

### 2.1 Extract (`etl/extract.py`)
- Streams the top-level JSON array one record at a time with `ijson` → O(1) memory
  regardless of file size (the file is 83 MB / 1.97M lines).
- Source opened read-only. Two passes: a lightweight vocabulary pass (brand/seller
  counts) and the main transform pass.
- Raw file integrity is captured as a SHA-256 checksum in the ETL report.

### 2.2 Validate (`etl/validate.py`)
Two severity levels, nothing silently guessed:
- **Hard reject** (→ `data/rejected/`): non-object record, missing/empty `_id`/`pid`/
  `category`, `product_details` not a list.
- **Soft issue** (→ flag columns, record preserved): missing title, non-list images,
  non-bool `out_of_stock`, missing `crawled_at`.

On the real dataset: **0 rejected, 30,000 validated**.

### 2.3 Clean (`etl/clean.py`) — all pure functions, raw values never mutated
| Transformation | Rule |
|---|---|
| Missing-value sentinels | `""` / `[]` (the dataset's NULL convention) → Python `None` → SQL NULL |
| Text | NBSP → space, whitespace collapsed, stripped |
| Prices `actual_price`/`selling_price` | `"2,999"` → float INR; commas/₹ stripped; invalid/empty/≤0 → NULL + `has_invalid_*` flag |
| Discount `"69% off"` | → int 0–100; malformed → NULL + flag |
| Rating | float in [0,5]; empty/out-of-range → NULL + flag |
| `crawled_at` | `DD/MM/YYYY, HH:MM:SS` → datetime + `snapshot_date` (`YYYY-MM-DD`); the crawl occurred on 2021-10-02 and 2021-11-02 only |
| Seller | strips scraped UI pollution: `"2.9Seller changed. Check for any changes..."`, `"(Not Enough Ratings)"`, `"(New Sell"` |
| Brand | canonicalization — see §3.1 |
| Sub-category | category+brand concatenations remapped — see §3.2 |
| `product_details` keys | 127 dirty keys → 120 canonical keys (§3.3) |

### 2.4 Transform (`etl/transform.py`)
- **Field renaming** to snake_case: `_id→listing_id`, `pid→product_id`,
  `actual_price→mrp`, `discount→discount_pct`, `average_rating→avg_rating`,
  `out_of_stock→is_out_of_stock`.
- **Deduplication:** products table keyed by `product_id` (28,080). Canonical
  listing = most complete (attributes + images + rating + description). The
  listings table keeps all 30,000 rows with `is_duplicate_product` flag
  (1,920 flagged; 549 products re-crawled 2–25 times).
- **Derived attributes** (all justified by available data):
  | Attribute | Definition |
  |---|---|
  | `gender` + `gender_source` | From `Ideal For` attribute (primary), else title keywords; `Unknown` otherwise |
  | `price_band` | budget ≤499 / mid 500–1499 / premium 1500–3999 / luxury ≥4000 (selling price INR) |
  | `effective_discount_pct` | `round((1 − selling/mrp)×100)` — the *true* discount, distinct from the marketing `discount_pct` (Phase 1 §7.2 showed they rarely match) |
  | `rating_bucket` | low <3 / mid 3–4 / high ≥4 |
  | `pack_of` | numeric pack size parsed from the `Pack of` attribute |
  | `image_count`, `primary_image` | from `images[]` |
  | `is_category_anomaly` | flags the single `Toys` record (a misclassified Fedora hat) |
  | `channel` | salvaged seller-channel prefix from polluted sub-categories |
- **Nested JSON parsing:** `product_details` (EAV) → long-form `product_attributes`
  table + 40 top-coverage attributes pivoted wide onto `products` (`attr_*`).
  `images[]` → count + primary image (URL list retained in listings).

### 2.5 Load (`etl/load.py`)
Parquet + CSV per table, rejected records as JSONL, ETL report JSON.

---

## 3. Categorical Normalization (evidence-based)

### 3.1 Brand canonicalization
The `brand` field contains **truncated names** (Phase 1 §9.2). Canonicalization is
data-driven — no external dictionaries:
1. Reference vocabulary = **cleaned seller names** (the most complete spelling
   source observed). Brand values are deliberately excluded as candidates so
   truncation does not propagate (e.g. `REEB` must not become `REEBOK CLASSI`,
   itself truncated).
2. A brand ≥3 chars whose normalized form is a prefix of a seller name (seller
   count ≥10) is expanded to the seller spelling: `Black Beat→Black Beatle`,
   `Keo→Keoti`, `TOM BU→Tomburg`, `Marca Disa→Marca Disati`, `Oka→OKANE`, …
3. Small evidence-based override table for cases prefix matching can't reach
   (`True Bl→True Blue`, `ECKO Unl→Ecko Unlimited`, `Free Authori→Free Authority`, …).
4. Result: 90/324 brand values canonicalized (13,653 rows corrected). Brands that
   are short/ambiguous (`Pu`, `V`, `A`) are **not** guessed — they are kept and
   flagged via `brand_suspected_truncated` (15,088 rows).

### 3.2 Sub-category
Values that are brand/seller+category concatenations (`Sunshopping Bags, Wallets &
Belts`, `Uber Urban Clothing and Accessories`, …) are split: sub-category reset to
the clean category, prefix salvaged as `channel`. 1,110 rows normalized.

### 3.3 `product_details` attribute keys (127 → 120)
- Case/whitespace variants merged: `Pack Of`→`Pack of`, `Weave type`→`Weave Type`,
  `Care Instructions|Care instructions`→`Fabric Care`, `Package contains`→`Sales Package`.
- Empty/whitespace keys (which carried orphaned care/sales text) → `Other Attribute`
  (values preserved, never dropped).

---

## 4. Data Integrity Verification

`scripts/verify_etl.py` asserts 51 ground-truth checks derived from the Phase 1
profile, including: record counts (30k/28,080/403,277), duplicate counts (1,920
rows / 549 pids), missing-value counts (2,446 unrated, 11,980 empty descriptions,
863 invalid MRPs), category distribution, out-of-stock (1,742), and a full
raw-record round-trip. **51/51 pass.**

`tests/test_etl.py` (15 tests) exercises cleaners, validation, brand expansion, and
an end-to-end synthetic run that drives records into the rejected layer.

---

## 5. Known Limitations (documented, not fixed by guessing)
- `Pu`/`V`/`A`/`REEB` etc. stay as-is (flagged), since no reliable corroborating
  value exists in the dataset.
- Gender is `Unknown` for 1,528 listings (5.1%) — no gender field exists in the raw.
- `average_rating` has no rating-count; popularity metrics remain out of scope (Phase 1 §12).
