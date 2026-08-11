# Data Quality Report

Generated: **2026-08-11 16:00:41 UTC**  ·  Source: `data/processed (products.parquet, listings.parquet, product_attributes.parquet)`  ·  Run: `scripts/run_quality_checks.py`

| Layer | Rows |
|---|---|
| listings | 30,000 |
| products | 28,080 |
| product_attributes | 403,277 |

## Summary

**34 checks** executed.

| Status | Count |
|---|---|
| PASS | 24 |
| WARN | 5 |
| FAIL | 0 |
| INFO | 5 |

### Results by category

| Category | PASS | WARN | FAIL | INFO |
|---|---|---|---|---|
| Nulls | 5 | 0 | 0 | 2 |
| Duplicates | 1 | 3 | 0 | 0 |
| Prices | 6 | 0 | 0 | 0 |
| Ratings | 3 | 0 | 0 | 0 |
| Categories | 2 | 0 | 0 | 2 |
| Brands | 2 | 2 | 0 | 1 |
| IDs | 3 | 0 | 0 | 0 |
| Types | 2 | 0 | 0 | 0 |

## Check details

- **`N1`** [PASS] ✅ Listings: no empty listing_id
  - metric: `0`
  - All listing rows must carry a non-empty _id.
- **`N2-product_id`** [PASS] ✅ Products: no empty product_id
  - metric: `0`
  - product_id is required on every product.
- **`N2-title`** [PASS] ✅ Products: no empty title
  - metric: `0`
  - title is required on every product.
- **`N3`** [INFO] ℹ️ Products: optional-column null counts
  - metric: `avg_rating=2260; description=11150; mrp=777; primary_image=772; selling_price=2`
  - Nullable by design; consumers must handle NULL.
- **`N4`** [PASS] ✅ Products: listing_ids not empty
  - metric: `0`
  - Every product must map to >= 1 listing.
- **`N5`** [PASS] ✅ Attributes: attr_key not null
  - metric: `0`
  - Every EAV row must name an attribute key.
- **`N6`** [INFO] ℹ️ Attributes: null attr_value count
  - metric: `0`
  - Rows with null values are dropped at load; kept here for audit.
- **`D1`** [WARN] ⚠️ Listings sharing a product_id
  - metric: `1920`
  - 1,920 documented: the same product is listed under multiple catalog entries.
- **`D2`** [WARN] ⚠️ Products present in multiple listings
  - metric: `549`
  - Documented (max 25 listings for one product).
- **`D3`** [PASS] ✅ Products: product_id unique
  - metric: `0`
  - Products layer must be 1 row per product.
- **`D4`** [WARN] ⚠️ Attributes: duplicate (product, key, value) triples
  - metric: `28573`
  - Deduped at load time into the EAV table; artifact keeps raw rows.
- **`P1`** [PASS] ✅ No zero/negative selling_price
  - metric: `0`
  - Selling price must be positive.
- **`P2`** [PASS] ✅ No zero/negative MRP
  - metric: `0`
  - MRP must be positive.
- **`P3`** [PASS] ✅ selling_price never exceeds MRP
  - metric: `0`
  - Business sanity: price <= MRP.
- **`P4`** [PASS] ✅ price_band matches selling_price
  - metric: `0`
  - Recomputed from PRICE_BANDS thresholds.
- **`P5-discount_pct`** [PASS] ✅ discount_pct within 0..100
  - metric: `0`
  - Discount must be a percentage in [0, 100].
- **`P5-effective_discount_pct`** [PASS] ✅ effective_discount_pct within 0..100
  - metric: `0`
  - Discount must be a percentage in [0, 100].
- **`R1`** [PASS] ✅ avg_rating within 0..5
  - metric: `0`
  - Ratings must be on the 0-5 scale.
- **`R2`** [PASS] ✅ has_rating consistent with avg_rating
  - metric: `0`
  - Flag and value must agree.
- **`R3`** [PASS] ✅ rating_bucket matches avg_rating
  - metric: `0`
  - Recomputed from RATING_BUCKETS thresholds.
- **`C1`** [PASS] ✅ category and sub_category not blank
  - metric: `0`
  - Taxonomy fields are required.
- **`C2`** [PASS] ✅ No 'Unknown' taxonomy
  - metric: `0`
  - Category cleaning never emits Unknown.
- **`C3`** [INFO] ℹ️ Products flagged as category anomalies
  - metric: `1`
  - Polluted sub-categories salvaged by the ETL.
- **`C4`** [INFO] ℹ️ Distinct top-level categories
  - metric: `Bags, Wallets & Belts, Clothing and Accessories, Footwear, Toys`
  - Canonical taxonomy after cleaning.
- **`B1`** [WARN] ⚠️ Products without a raw brand
  - metric: `2009`
  - 2,009 documented; mapped to Unknown brand (id 0).
- **`B2`** [PASS] ✅ Raw brand present => canonical resolved
  - metric: `0`
  - Every raw brand must resolve to a canonical value.
- **`B3`** [PASS] ✅ Blank canonical only when raw brand missing
  - metric: `0`
  - Blank brand_canonical is allowed for the 2,009 no-brand products; DB maps them to Unknown brand id 0.
- **`B4`** [WARN] ⚠️ Brands still suspected of truncation
  - metric: `14156`
  - Values >= 10 chars; kept because the seller vocabulary cannot corroborate a longer expansion.
- **`B5`** [INFO] ℹ️ Very short canonical brands (< 3 chars)
  - metric: `A, C, CA, D, E, Fa, G, J, K, M, Mo, Pu, R, TE, US, V, We, Xi, n, ta`
  - e.g. 'G', 'V', 'Pu' — genuine values, not truncation.
- **`I1`** [PASS] ✅ product_id not blank
  - metric: `0`
  - Primary key of the products layer.
- **`I2`** [PASS] ✅ listing_id values are well-formed UUIDs
  - metric: `0`
  - All listing ids match the UUID format.
- **`I3`** [PASS] ✅ listing_ids resolve to listings
  - metric: `0`
  - Every product listing id must exist in the listings layer.
- **`T1`** [PASS] ✅ Column dtypes match the data contract
  - metric: `0`
  - All 40+ columns conform to expected types.
- **`T2`** [PASS] ✅ listing_ids contains lists of strings
  - metric: `0`
  - Nested column must be an array of strings.
