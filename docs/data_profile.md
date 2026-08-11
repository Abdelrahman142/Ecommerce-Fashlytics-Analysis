# Phase 1 — Dataset Profiling Report

**Dataset:** `flipkart_fashion_products_dataset.json`
**Project:** Fashion Product Intelligence Platform
**Date:** 2026-08-11
**Raw data policy:** The raw file is treated as immutable. It is only ever opened read-only. No columns or records have been removed or modified.

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| File size | 82.72 MB (82,720,262 bytes) |
| Line count | 1,974,388 |
| Records (top-level array items) | **30,000** |
| Top-level fields per record | 17 |
| Malformed / unparseable records | **0** |
| Fully complete fields (no missing, null, or empty) | 4 of 17 (`category`, `crawled_at`, `out_of_stock`, `pid`, `sub_category`, `title`, `url`) |
| Exact duplicate rows (identical full record) | **0** |
| Rows duplicated by `pid` (product listing) | **1,920** extra rows (549 pids seen 2+ times) |
| Snapshot window | Oct 2021 (20,913) + Nov 2021 (9,087) — a **point-in-time snapshot**, not a time series |

The dataset is a clean, well-formed single JSON array of 30,000 fashion product listings crawled from Flipkart in Oct–Nov 2021. It is structurally sound but contains several **content-level data quality issues** that must be handled in the transformation phase: truncated brand names, polluted `seller` values, empty string placeholders used for missing values, and a denormalized nested attribute structure (`product_details`).

---

## 2. Methodology

Profiling was performed with a **streaming parser** (`ijson`) in `scripts/profile_dataset.py`, processing one record at a time so memory usage is O(1) relative to file size rather than loading the whole 82 MB tree.

- Machine-readable artifact: `reports/profile_artifact.json` (regenerable via `scripts/profile_dataset.py`).
- Targeted verification queries confirmed the suspicious findings in §9 (see `verify_findings.py`).
- The raw file was opened read-only throughout.

---

## 3. File & JSON Structure

- **Top level:** a single JSON array (`[ ... ]`) of 30,000 objects. No nested arrays-of-arrays, no keyed wrapper.
- **Record schema:** flat object with 17 fields, all present on every record (0 missing keys).
- **Nested structures (2):**
  - `images` — array of image URLs (`string[]`).
  - `product_details` — array of single-key objects (`[{"Attribute": "value"}, ...]`) — an EAV-style denormalized attribute bag.

---

## 4. Field Dictionary

| # | Field | JSON type | Present | Missing/Null | Empty | Stored-as | Logical type | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `_id` | string | 30,000 | 0 | 0 | UUID (v5) | Surrogate key | 30,000 distinct |
| 2 | `pid` | string | 30,000 | 0 | 0 | code | Natural key (product) | 28,080 distinct — **not unique** |
| 3 | `url` | string | 30,000 | 0 | 0 | URL | Natural key (listing) | 30,000 distinct |
| 4 | `title` | string | 30,000 | 0 | 0 | text | Text | 3–251 chars, mean 37.6 |
| 5 | `description` | string | 30,000 | 0 | **11,980 (39.9%)** | text | Text | 0–3,860 chars, mean 173.3 |
| 6 | `category` | string | 30,000 | 0 | 0 | category | Categorical | 4 distinct |
| 7 | `sub_category` | string | 30,000 | 0 | 0 | category | Categorical | 24 distinct (some polluted, §9.3) |
| 8 | `brand` | string | 30,000 | 0 | **2,068 (6.9%)** | brand | Categorical | 324 distinct — **truncated values** (§9.2) |
| 9 | `seller` | string | 30,000 | 0 | **1,741 (5.8%)** | name | Categorical | 534 distinct — polluted values (§9.2) |
| 10 | `actual_price` | string | 30,000 | 0 | **863** | `"2,999"` | Numeric (INR) | 29,137 valid; comma-formatted; 863 invalid |
| 11 | `selling_price` | string | 30,000 | 0 | 2 | `"921"` | Numeric (INR) | 29,998 valid; 2 invalid |
| 12 | `discount` | string | 30,000 | 0 | **941** | `"69% off"` | Numeric (pct) | 29,059 valid; 941 malformed |
| 13 | `average_rating` | string | 30,000 | 0 | **2,446** | `"3.9"` | Numeric (0–5) | 27,554 valid; empty = unrated |
| 14 | `out_of_stock` | bool | 30,000 | 0 | 0 | true/false | Boolean | 1,742 true (5.8%) |
| 15 | `crawled_at` | string | 30,000 | 0 | 0 | `"02/10/2021, 20:11:51"` | Datetime (DD/MM/YYYY HH:MM:SS) | 100% parseable |
| 16 | `images` | array | 30,000 | 0 | 778 empty lists | URL[] | Nested array | 0–25 URLs, mean 4.51 |
| 17 | `product_details` | array | 30,000 | 0 | 0 | [{attr: value}, …] | EAV bag | 1–25 pairs, mean 13.44; 127 distinct keys |

> **Important observation:** every field that is *missing data* uses an **empty string / empty list** as the sentinel value, never JSON `null` and never a missing key. The downstream ETL must treat `""`, `[]` as NULL.

---

## 5. Uniqueness, Duplicates & Key Candidates

| Check | Result | Implication |
|---|---|---|
| Full-record exact duplicates | 0 | No byte-identical rows |
| `_id` distinct | 30,000 / 30,000 | Unique → **candidate PK** |
| `url` distinct | 30,000 / 30,000 | Unique → **candidate PK** (contains crawler-specific params) |
| `pid` distinct | 28,080 / 30,000 | 549 pids duplicated, **1,920 extra rows** |
| `_id` ∩ `pid` | `_id` unique, `pid` not | `pid` = natural key for the *product*, `_id` = unique *listing/crawl* row |

**Duplicate investigation (verified):** the 549 duplicated `pid`s are re-crawls of the **same product listing** — identical title, price, size and attributes; only the crawl metadata (`_id`, `url` query params) differs. This is a classic crawl-snapshot artifact.

**Recommended key design:**
- **Primary key:** `_id` (surrogate, unique, stable).
- **Natural/business key:** `pid` (product identity; one product may map to several rows via re-crawls).
- `url` is unique but noisy (tracking params) — not a good business key.
- No foreign keys exist across files (single denormalized source), but `pid` will become a FK to a future `products` dimension.

---

## 6. Nested Structures

### 6.1 `images` (array of URLs)
- 100% of records carry the field; 778 (2.6%) are empty lists.
- Size: 0–25 URLs, mean 4.51, median 5. Distribution tail: 5 (9,751), 4 (5,303), 6 (5,051), 3 (3,566), 2 (3,254), 7 (1,488), 0 (778).
- All values are `https://rukminim1.flixcart.com/...` image URLs (thumbnails at `128/128` in the crawl URL; full-size is derivable by URL rewriting — a Phase 2 nicety).

### 6.2 `product_details` (EAV attribute bag)
- Present on all 30,000 records; 1–25 key-value pairs (mean 13.44).
- **127 distinct attribute keys** across the dataset — the schema is a wide, sparse, key-per-product attribute store.
- Top attributes by coverage:

| Attribute key | Records | Distinct values | Meaning |
|---|---|---|---|
| `Fabric` | 27,804 | 244 | Material composition |
| `Style Code` | 27,568 | 23,246 | Near-unique per variant |
| `Pattern` | 27,507 | 118 | Solid/Striped/etc. |
| `Fabric Care` | 23,500 | 472 | Care instructions |
| `Suitable For` | 20,733 | 4 | **Wear style**, not gender (§9.5) |
| `Sleeve` | 20,411 | 20 | Sleeve length |
| `Pack of` | 19,417 | 13 | Items per pack |
| `Type` | 18,826 | 153 | Product type |
| `Ideal For` | 18,489 | 6 | **Gender** — Men/Women/etc. (§8.7) |
| `Fit` | 18,141 | 45 | Slim/Regular/etc. |
| `Color` | 14,889 | 352 | Color |
| `Brand Color` | 14,029 | 2,147 | Brand-specific color names |
| `Size` | 13,420 | 16 | Size (mixed schemes, §9.6) |
| `Neck Type` | 13,409 | 23 | Collar type |
| `Country of Origin` | 12,351 | 11 | Mostly India (12,192) |
| `Reversible` | 15,726 | 2 | Yes/No |
| `Occasion`, `Closure`, `Model Name`, `Other Details`, … | smaller | … | Long tail |

---

## 7. Numeric Fields

All monetary/rating/discount values are **stored as strings** and require casting.

### 7.1 Prices (INR)
| Field | Valid | Min | p1 | Median | Mean | p99 | Max | Invalid |
|---|---|---|---|---|---|---|---|---|
| `actual_price` (MRP) | 29,137 | 150 | 374 | 1,249 | 1,472.62 | 4,999 | 12,999 | **863** (empty/non-numeric) |
| `selling_price` | 29,998 | 99 | 199 | 549 | 716.56 | 3,039 | 7,999 | **2** |

- `actual_price` is always ≥ `selling_price` for valid pairs (no negative or zero prices observed).
- Formatting: thousands separator commas (e.g. `"2,999"`); no ₹ symbol; integer rupees only.

### 7.2 Discount
- `discount` = `"<pct>% off"` strings; 29,059 parseable, **941 malformed/empty**.
- Range 1–87%, mean 50.34%, median 53%.

**Consistency check (price-implied vs claimed discount):**

| Result | Count |
|---|---|
| Consistent with `actual_price` vs `selling_price` | 1,322 |
| Mismatch (rounded) | 26,875 |
| Unverifiable (missing/invalid input) | 1,803 |

The claimed `% off` does **not** exactly equal `1 − selling/actual` for 89.6% of rows (e.g. actual 2,999, selling 921, "69% off" ⇒ expected 929.69). The selling price is a rounded value and the discount is a marketing claim. **Conclusion:** do not *derive* the discount from prices; store it as reported, and document the discrepancy. Discount is only meaningful for metrics like "typical depth of discount", not exact arithmetic checks.

### 7.3 Average rating
- 27,554 valid values; range 1.0–5.0; mean 3.64, median 3.8, p1 1.7, p99 5.0.
- **2,446 empty strings = "not rated"** (no other invalid values).
- No out-of-range values.

---

## 8. Categorical & Business Fields

### 8.1 Category (4 distinct)
| Category | Records |
|---|---|
| Clothing and Accessories | 28,971 |
| Footwear | 987 |
| Bags, Wallets & Belts | 41 |
| Toys | 1 ← **anomaly, §9.4** |

### 8.2 Sub-category (24 distinct)
Dominant values: `Topwear` (16,575), `Bottomwear` (3,862), `Winter Wear` (2,753), `Innerwear and Swimwear` (1,774), `Clothing Accessories` (1,760), `Kurtas, Ethnic Sets and Bottoms` (1,248), `Men's Footwear` (987), `Fabrics` (535). **Several values are polluted** (§9.3).

Category × sub-category is a clean 1-many tree except for the polluted values.

### 8.3 Brand (324 distinct)
Top brands by volume: `ARBO` (999), `REEB` (996), `True Bl` (996), `Pu` (996), `ECKO Unl` (993), `Free Authori` (864)…
**Quality issue:** the `brand` field contains visibly **truncated names** (§9.2). Example: `Black Beat` ↔ seller `Black Beatle` (identical 560-row counts), `Keo` ↔ `Keoti` (668), `TOM BU` ↔ `TOMBURG` (291).

### 8.4 Seller (534 distinct)
Top sellers: `RetailNet` (1,615), `ARBOR` (976), `SandSMarketing` (927), `BioworldMerchandising` (846), `Keoti` (668)…
**Quality issue:** some `seller` values contain scraped UI tooltips such as `"ArvindTrueBlue2.6Seller changed. Check for any changes in pricing and related informatio"` (§9.2).

### 8.5 Availability / stock
- `out_of_stock`: boolean; 1,742 true (5.8%), 28,258 false.
- **No stock quantity exists** — only an in/out binary flag. "Units on hand" cannot be measured.

### 8.6 Price-related business fields
- `actual_price` (MRP), `selling_price`, `discount` — see §7.

### 8.7 Gender-related fields
- **No dedicated gender column.** Gender is embedded in:
  - `product_details["Ideal For"]` — 18,455 Men, ~6.2% of the covered set is women/mixed (Women values exist: `Men, Women`, `Women, Men`, `Boys, Girls, Men, Women`).
  - `title` — gendered keywords (Men/Women/Boys/Girls), e.g. `"Solid Men Multicolor Track Pants"`.
  - `product_details["Suitable For"]` is **not** gender — its 4 values are `Western Wear` (20,641), `Ethnic Wear`, `Maternity Wear`, `Fusion Wear` (wear-style labels; the key is misnamed).
- Gender analytics therefore require **deriving** a gender dimension from `Ideal For` + title NLP; coverage will be partial (~62% from `Ideal For` alone).

### 8.8 Rating/review fields
- Only `average_rating` (aggregate). **No rating count, no review text, no review date** exist in the dataset. "Most-reviewed products" or review-sentiment metrics are **not computable** — an alternative is to rank by availability of ratings and discount depth.

### 8.9 Crawl time
- `crawled_at`: `DD/MM/YYYY, HH:MM:SS`; 100% parseable. Two months only: **2021-10 (20,913)** and **2021-11 (9,087)**. This is a **snapshot**, so time-series/trend analysis over `crawled_at` is not meaningful; use it as an audit/lineage column and a `snapshot_date` dimension.

---

## 9. Data Quality Findings

### 9.1 Invalid values (parse failures)
| Field | Invalid | Root cause |
|---|---|---|
| `actual_price` | 863 | empty string (missing MRP) |
| `discount` | 941 | empty string (missing) |
| `average_rating` | 2,446 | empty string (unrated product) |
| `selling_price` | 2 | empty/non-numeric |

All are *missing-data sentinels*, not corrupt values. **Action:** map `""` → NULL in the warehouse.

### 9.2 Suspicious values — brand truncation & seller pollution
- Brand names are truncated (~8–12 chars). Strong evidence: `brand="Black Beat"` (560) ↔ `seller="Black Beatle"` (560); `brand="Keo"` (668) ↔ `seller="Keoti"` (668); `brand="TOM BU"` (291) ↔ `seller="TOMBURG"` (285). Additional truncated examples: `True Bl`, `ECKO Unl`, `Free Authori`, `DISCOUNT OUTL`, `Byford by Pantaloo`, `HUMANITY ORIGINA`, `JACK AND HAR`.
- Some `seller` values captured UI tooltip text: `"ArvindTrueBlue2.6Seller changed. Check for any changes in pricing and related informatio"` (a live-updating "Seller changed" note got scraped as the seller name).
- **Action:** build a brand-cleaning lookup (truncated → canonical) in Phase 2; flag/regex-clean the tooltip-prefixed seller names. Do **not** drop the records.

### 9.3 Polluted `sub_category` values
Several sub-categories are actually **brand+category concatenations** that leaked into the field, e.g. `Sunshopping Bags, Wallets & Belts` (21), `Uber Urban Clothing and Accessories` (28), `Inspire Clothing and Accessories` (23), `Roy Clothing and Accessories` (12). They break the category taxonomy.
**Action:** normalize these into a `brand_affinity`/`seller_channel` attribute and remap sub-category to the canonical taxonomy (`Bags, Wallets & Belts`, `Clothing and Accessories`).

### 9.4 Category anomaly
One record is `category="Toys"`, `sub_category="Party Supplies"` — actually a men's Fedora hat ("Natali Traders Fedora (Red, Pack of 1)"). Likely crawled from a party-supplies context. **Action:** keep the record (do not drop), and either recategorize to a hat/clothing-accessory class or flag it with an `is_anomaly` marker.

### 9.5 `product_details` schema drift (dirty keys)
- **127 distinct attribute keys**, including duplicates differing only by case/spacing: `Pack of` (19,417) vs `Pack Of` (923); `Care instructions` vs `Care Instructions`; `Fabric Care` vs `Fabric care`; `Weave Type` vs `Weave type`.
- Empty/whitespace keys: `""` (319 records) and `" "` (894 records) carry valuable strings (e.g. `"3 Pairs of Fresh Feet Ankle Socks"`, `"Do not use brush."`) that belong under `Sales Package` / `Care Instructions`.
- Value-level noise: `Pack of` contains `"Pack of 3"` (13) mixed with `"3"` (1,337); `Size` mixes alpha sizes (`M`, `XL`), numeric (`38`, `40`), `Free`, and kids ages (`5 - 6 Years`).
- **Action:** define a canonical attribute-key mapping (127 → ~50 clean keys) and a pivot into a wide or proper EAV table in Phase 2.

### 9.6 Text fields
- `title`: 3–251 chars, mean 37.6. Contains non-breaking spaces (`\xa0`) before "(Pack of N)" — e.g. `"Solid Men Polo Neck Dark Blue, Blue T-Shirt\xa0\xa0(Pack of 2)"`.
- `description`: 39.9% empty; up to 3,860 chars; no language/encoding anomalies observed in samples.

---

## 10. Missing-Value Matrix (completeness)

| Field | Complete | Empty (≈ missing) | Missing rate |
|---|---|---|---|
| `category`, `crawled_at`, `out_of_stock`, `pid`, `sub_category`, `title`, `url` | 100% | 0 | 0% |
| `_id` | 100% | 0 | 0% |
| `selling_price` | 99.99% | 2 | 0.01% |
| `images` | 97.4% | 778 | 2.6% |
| `average_rating` | 91.8% | 2,446 | 8.2% |
| `seller` | 94.2% | 1,741 | 5.8% |
| `discount` | 96.9% | 941 | 3.1% |
| `actual_price` | 97.1% | 863 | 2.9% |
| `brand` | 93.1% | 2,068 | 6.9% |
| `description` | 60.1% | 11,980 | 39.9% |

All missingness uses `""` / `[]` sentinels (no NULLs, no absent keys).

---

## 11. Key Design (Summary)

| Role | Field | Notes |
|---|---|---|
| Primary key | `_id` | Unique UUID, 30,000/30,000 |
| Natural product key | `pid` | 28,080 distinct; 1,920 duplicate crawl rows to dedupe |
| Listing URL | `url` | Unique but noisy (tracking params); keep for lineage |
| Snapshot key | `crawled_at` | Snapshot of Oct–Nov 2021 |
| FK candidates | `pid` → future products dimension | Not a cross-file FK today |

---

## 12. Business Attributes Available vs Not Available

**Available (backed by data):**
- Product taxonomy (category, sub-category), brand, seller
- Pricing: MRP, selling price, discount %
- Availability: in/out of stock
- Rating: average rating (aggregate, 91.8% coverage)
- Product attributes: fabric, pattern, fit, color, sleeve, size, occasion, closure, country of origin, pack size
- Image counts/URLs
- Gender (derived from `Ideal For` + title)
- Snapshot date

**NOT available (explicitly, so no fake metrics):**
| Unavailable | Why | Valid alternative |
|---|---|---|
| Rating/review count | Field absent | Use rating coverage & discount depth as popularity proxies; never claim "most reviewed" |
| Review text / sentiment | Field absent | — (sentiment analysis impossible) |
| Stock quantity | Only `out_of_stock` boolean exists | Report stock-out rate (5.8%) instead |
| Seller rating | Field absent | Seller assortment size/concentration |
| Price history / trends | Two-month snapshot | Cross-snapshot analysis only if more dumps are ingested later |
| Sales / demand volume | Transaction data absent | Price + discount + availability analytics only |

---

## 13. Recommended Phase 2 Transformations (from findings)

1. **Deduplication:** resolve the 1,920 `pid` duplicate crawl rows → `dim_product` keyed by `pid`, keeping `_id` for lineage.
2. **Sentinels → NULL:** map `""`/`[]` to typed NULLs when loading to warehouse.
3. **Type casting:** prices → NUMERIC(INR), discount → INT %, rating → NUMERIC, `crawled_at` → TIMESTAMP (DD/MM/YYYY).
4. **Brand cleanup:** canonical brand lookup from truncated names (leverage seller names, e.g. `Black Beat`→`Black Beatle`).
5. **Seller cleanup:** strip "…Seller changed…" tooltip pollution; normalize.
6. **Category taxonomy:** remap polluted sub-categories; flag `Toys` anomaly.
7. **`product_details` pivot:** canonical attribute-key mapping (127 → ~50), cast value types, clean `Pack of`/`Size` noise; store as wide or EAV fact table.
8. **Gender dimension:** derive from `Ideal For` (+ title keywords fallback); tag "unknown".
9. **Star schema:** `products` (dim, by pid), `product_attributes` (EAV or pivoted), `listings_snapshot` (fact, per `_id`), plus `brand`/`seller`/`category` dims.

---

## 14. Reproducibility

- Profile script: `scripts/profile_dataset.py`
- Machine-readable profile: `reports/profile_artifact.json`
- Verification queries: `scripts/verify_findings.py` (regenerate via `.venv/bin/python scripts/verify_findings.py`)
- Raw input: `flipkart_fashion_products_dataset.json` (untouched, read-only)
