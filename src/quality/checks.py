"""Data-quality checks over the Phase 3 processed layer.

Each check targets one of the quality dimensions requested in Phase 9: nulls,
duplicates, invalid prices, invalid ratings, invalid categories, invalid
brands, invalid IDs, and unexpected data types.

Status semantics:
  PASS  — invariant holds.
  WARN  — deviation from ideal that is documented/expected (e.g. raw-layer
          duplicates, products without a brand) — reported, not fabricated away.
  FAIL  — invariant violated; requires attention.

All thresholds come from `src.config` (PRICE_BANDS, RATING_BUCKETS) so the
checks validate exactly what the ETL produced.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd

from src.config import PRICE_BANDS, RATING_BUCKETS

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


@dataclass
class CheckResult:
    check_id: str
    category: str
    title: str
    status: str  # PASS | WARN | FAIL | INFO
    metric: Any
    detail: str

    def as_dict(self) -> dict:
        return {
            "check_id": self.check_id,
            "category": self.category,
            "title": self.title,
            "status": self.status,
            "metric": self.metric,
            "detail": self.detail,
        }


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _blank(df: pd.DataFrame, col: str) -> int:
    s = df[col]
    return int(s.isna().sum()) + int((s.astype(str).str.strip() == "").sum())


def _blank_mask(df: pd.DataFrame, col: str) -> pd.Series:
    s = df[col]
    return s.isna() | (s.astype(str).str.strip() == "")


def _price_band(price: float) -> str | None:
    if price is None or pd.isna(price):
        return None
    for name, lo, hi in PRICE_BANDS:
        if lo <= price <= hi:
            return name
    return None


def _rating_bucket(rating: float) -> str | None:
    if rating is None or pd.isna(rating):
        return None
    for name, lo, hi in RATING_BUCKETS:
        if lo <= rating < hi:
            return name
    return "high" if rating == 5.0 else None


def _pass(cid: str, cat: str, title: str, metric, detail: str) -> CheckResult:
    return CheckResult(cid, cat, title, "PASS", metric, detail)


def _warn(cid: str, cat: str, title: str, metric, detail: str) -> CheckResult:
    return CheckResult(cid, cat, title, "WARN", metric, detail)


def _fail(cid: str, cat: str, title: str, metric, detail: str) -> CheckResult:
    return CheckResult(cid, cat, title, "FAIL", metric, detail)


# ---------------------------------------------------------------------------
# checks
# ---------------------------------------------------------------------------

def check_nulls(products: pd.DataFrame, listings: pd.DataFrame,
                attributes: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []

    n = _blank(listings, "listing_id")
    out.append(_pass("N1", "Nulls", "Listings: no empty listing_id", n,
                     "All listing rows must carry a non-empty _id.") if n == 0
               else _fail("N1", "Nulls", "Listings: no empty listing_id", n,
                          f"{n} rows have a blank listing_id."))

    for col in ("product_id", "title"):
        n = _blank(products, col)
        out.append(_pass(f"N2-{col}", "Nulls",
                         f"Products: no empty {col}", n,
                         f"{col} is required on every product.") if n == 0
                   else _fail(f"N2-{col}", "Nulls",
                              f"Products: no empty {col}", n,
                              f"{n} products have a blank {col}."))

    nulls = {c: int(products[c].isna().sum())
             for c in ("mrp", "selling_price", "avg_rating", "description",
                       "primary_image")}
    out.append(CheckResult("N3", "Nulls", "Products: optional-column null counts",
                           "INFO", nulls,
                           "Nullable by design; consumers must handle NULL."))

    n = int(products["listing_ids"].map(lambda x: len(x) == 0).sum())
    out.append(_pass("N4", "Nulls", "Products: listing_ids not empty", n,
                     "Every product must map to >= 1 listing.") if n == 0
               else _warn("N4", "Nulls", "Products: listing_ids not empty", n,
                          f"{n} products have no listing_ids."))

    n = int(attributes["attr_key"].isna().sum())
    out.append(_pass("N5", "Nulls", "Attributes: attr_key not null", n,
                     "Every EAV row must name an attribute key.") if n == 0
               else _fail("N5", "Nulls", "Attributes: attr_key not null", n,
                          f"{n} EAV rows have a null attr_key."))

    n = int(attributes["attr_value"].isna().sum())
    out.append(CheckResult("N6", "Nulls", "Attributes: null attr_value count",
                           "INFO", n,
                           "Rows with null values are dropped at load; kept here for audit."))
    return out


def check_duplicates(products: pd.DataFrame, listings: pd.DataFrame,
                     attributes: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []

    n = int(listings[["product_id"]].duplicated().sum())
    out.append(CheckResult("D1", "Duplicates",
                           "Listings sharing a product_id",
                            "WARN", n,
                            "1,920 documented: the same product is listed under "
                            "multiple catalog entries."))

    n = int((products["n_listings"] > 1).sum())
    out.append(CheckResult("D2", "Duplicates",
                           "Products present in multiple listings",
                           "WARN", n,
                           f"Documented (max {int(products['n_listings'].max())} "
                           "listings for one product)."))

    n = int(products["product_id"].duplicated().sum())
    out.append(_pass("D3", "Duplicates", "Products: product_id unique", n,
                     "Products layer must be 1 row per product.") if n == 0
               else _fail("D3", "Duplicates", "Products: product_id unique", n,
                          f"{n} product_id values appear more than once."))

    total = len(attributes)
    uniq = int(attributes[["product_id", "attr_key", "attr_value"]]
               .drop_duplicates().shape[0])
    n = total - uniq
    out.append(CheckResult("D4", "Duplicates",
                           "Attributes: duplicate (product, key, value) triples",
                           "WARN", n,
                           "Deduped at load time into the EAV table; artifact keeps raw rows."))
    return out


def check_prices(products: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []
    sp, mrp = products["selling_price"], products["mrp"]

    n = int((sp.notna() & (sp <= 0)).sum())
    out.append(_pass("P1", "Prices", "No zero/negative selling_price", n,
                     "Selling price must be positive.") if n == 0
               else _fail("P1", "Prices", "No zero/negative selling_price", n,
                          f"{n} products have selling_price <= 0."))

    n = int((mrp.notna() & (mrp <= 0)).sum())
    out.append(_pass("P2", "Prices", "No zero/negative MRP", n,
                     "MRP must be positive.") if n == 0
               else _fail("P2", "Prices", "No zero/negative MRP", n,
                          f"{n} products have mrp <= 0."))

    n = int((sp.notna() & mrp.notna() & (sp > mrp)).sum())
    out.append(_pass("P3", "Prices", "selling_price never exceeds MRP", n,
                     "Business sanity: price <= MRP.") if n == 0
               else _fail("P3", "Prices", "selling_price never exceeds MRP", n,
                          f"{n} products have selling_price > mrp."))

    bad = 0
    for v, band in zip(sp, products["price_band"]):
        if pd.notna(v) and _price_band(float(v)) != band:
            bad += 1
    out.append(_pass("P4", "Prices", "price_band matches selling_price", bad,
                     "Recomputed from PRICE_BANDS thresholds.") if bad == 0
               else _fail("P4", "Prices", "price_band matches selling_price", bad,
                          f"{bad} products have an inconsistent price_band."))

    for col in ("discount_pct", "effective_discount_pct"):
        n = int((products[col].notna() & (products[col] < 0) |
                 products[col].notna() & (products[col] > 100)).sum())
        out.append(_pass(f"P5-{col}", "Prices", f"{col} within 0..100", n,
                         "Discount must be a percentage in [0, 100].") if n == 0
                   else _fail(f"P5-{col}", "Prices",
                              f"{col} within 0..100", n,
                              f"{n} products have {col} outside 0..100."))
    return out


def check_ratings(products: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []
    r = products["avg_rating"]

    n = int((r.notna() & ((r < 0) | (r > 5))).sum())
    out.append(_pass("R1", "Ratings", "avg_rating within 0..5", n,
                     "Ratings must be on the 0-5 scale.") if n == 0
               else _fail("R1", "Ratings", "avg_rating within 0..5", n,
                          f"{n} products have avg_rating outside 0..5."))

    n1 = int((products["has_rating"] & r.isna()).sum())
    n2 = int((~products["has_rating"] & r.notna()).sum())
    bad = n1 + n2
    out.append(_pass("R2", "Ratings", "has_rating consistent with avg_rating",
                     bad, "Flag and value must agree.") if bad == 0
               else _fail("R2", "Ratings", "has_rating consistent with avg_rating",
                          bad, f"{n1} flagged-but-null, {n2} valued-but-unflagged."))

    bad = 0
    for v, bucket in zip(r, products["rating_bucket"]):
        if pd.notna(v) and _rating_bucket(float(v)) != bucket:
            bad += 1
    out.append(_pass("R3", "Ratings", "rating_bucket matches avg_rating", bad,
                     "Recomputed from RATING_BUCKETS thresholds.") if bad == 0
               else _fail("R3", "Ratings", "rating_bucket matches avg_rating", bad,
                          f"{bad} products have an inconsistent rating_bucket."))
    return out


def check_categories(products: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []

    n = _blank(products, "category") + _blank(products, "sub_category")
    out.append(_pass("C1", "Categories", "category and sub_category not blank", n,
                     "Taxonomy fields are required.") if n == 0
               else _fail("C1", "Categories", "category and sub_category not blank", n,
                          f"{n} products have a blank taxonomy field."))

    n = int(((products["category"] == "Unknown") |
             (products["sub_category"] == "Unknown")).sum())
    out.append(_pass("C2", "Categories", "No 'Unknown' taxonomy", n,
                     "Category cleaning never emits Unknown.") if n == 0
               else _warn("C2", "Categories", "No 'Unknown' taxonomy", n,
                          f"{n} products carry an Unknown taxonomy value."))

    n = int(products["is_category_anomaly"].sum())
    out.append(CheckResult("C3", "Categories", "Products flagged as category anomalies",
                           "INFO", n,
                           "Polluted sub-categories salvaged by the ETL."))

    uniq = sorted(products["category"].unique())
    out.append(CheckResult("C4", "Categories", "Distinct top-level categories", "INFO",
                           uniq, "Canonical taxonomy after cleaning."))
    return out


def check_brands(products: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []
    raw, canon = products["brand"], products["brand_canonical"]

    n = int(raw.isna().sum())
    out.append(CheckResult("B1", "Brands", "Products without a raw brand",
                           "WARN", n,
                           "2,009 documented; mapped to Unknown brand (id 0)."))

    n = int((raw.notna() & ((canon.isna()) | (canon == "Unknown"))).sum())
    out.append(_pass("B2", "Brands", "Raw brand present => canonical resolved", n,
                     "Every raw brand must resolve to a canonical value.") if n == 0
               else _fail("B2", "Brands", "Raw brand present => canonical resolved", n,
                          f"{n} products have a raw brand but no canonical."))

    bad = int((raw.notna() & _blank_mask(products, "brand_canonical")).sum())
    out.append(_pass("B3", "Brands", "Blank canonical only when raw brand missing", bad,
                     "Blank brand_canonical is allowed for the 2,009 no-brand "
                     "products; DB maps them to Unknown brand id 0.") if bad == 0
               else _fail("B3", "Brands", "Blank canonical only when raw brand missing",
                          bad,
                          f"{bad} products have a blank canonical but a raw brand."))

    n = int(products["brand_suspected_truncated"].sum())
    out.append(CheckResult("B4", "Brands", "Brands still suspected of truncation",
                           "WARN", n,
                           "Values >= 10 chars; kept because the seller vocabulary "
                           "cannot corroborate a longer expansion."))

    short = sorted(canon[canon.str.len() < 3].dropna().unique().tolist())
    out.append(CheckResult("B5", "Brands", "Very short canonical brands (< 3 chars)",
                           "INFO", short,
                           "e.g. 'G', 'V', 'Pu' — genuine values, not truncation."))
    return out


def check_ids(products: pd.DataFrame, listings: pd.DataFrame) -> list[CheckResult]:
    out: list[CheckResult] = []

    n = int(products["product_id"].isna().sum()) + \
        int(products["product_id"].astype(str).str.strip().eq("").sum())
    out.append(_pass("I1", "IDs", "product_id not blank", n,
                     "Primary key of the products layer.") if n == 0
               else _fail("I1", "IDs", "product_id not blank", n,
                          f"{n} products have a blank product_id."))

    ids = listings["listing_id"].astype(str)
    n = int((~ids.str.match(UUID_RE)).sum())
    out.append(_pass("I2", "IDs", "listing_id values are well-formed UUIDs", n,
                     "All listing ids match the UUID format.") if n == 0
               else _fail("I2", "IDs", "listing_id values are well-formed UUIDs", n,
                          f"{n} listing ids are not UUID-shaped."))

    known = set(listings["listing_id"].astype(str))
    orphans = 0
    for cell in products["listing_ids"]:
        for lid in cell:
            if str(lid) not in known:
                orphans += 1
    out.append(_pass("I3", "IDs", "listing_ids resolve to listings", orphans,
                     "Every product listing id must exist in the listings layer.")
               if orphans == 0
               else _fail("I3", "IDs", "listing_ids resolve to listings", orphans,
                          f"{orphans} listing ids reference missing listings."))
    return out


def check_types(products: pd.DataFrame) -> list[CheckResult]:
    expected = {
        # text
        "product_id": "str", "url": "str", "title": "str", "description": "str",
        "category": "str", "sub_category": "str", "channel": "str",
        "brand": "str", "brand_canonical": "str", "seller": "str",
        "rating_bucket": "str", "price_band": "str", "gender": "str",
        "gender_source": "str", "snapshot_date": "str", "primary_image": "str",
        # numeric
        "mrp": "float", "selling_price": "float", "discount_pct": "float",
        "effective_discount_pct": "float", "avg_rating": "float",
        "min_selling_price": "float", "max_selling_price": "float",
        "pack_of": "float",
        # integer
        "image_count": "int", "n_attributes": "int", "n_listings": "int",
        # boolean
        "has_rating": "bool", "is_out_of_stock": "bool",
        "any_out_of_stock": "bool", "is_category_anomaly": "bool",
        "brand_suspected_truncated": "bool", "brand_corrected": "bool",
        "sub_category_normalized": "bool",
        # temporal
        "crawled_at": "datetime",
        # nested
        "listing_ids": "list",
    }

    def kind(dtype) -> str:
        d = str(dtype)
        if "datetime" in d or "date32" in d or "date64" in d:
            return "datetime"
        if "bool" in d:
            return "bool"
        if "int" in d:
            return "int"
        if "float" in d or "double" in d or "numeric" in d:
            return "float"
        if "object" in d or "str" in d or "string" in d:
            return "object"
        return "other"

    mismatches = []
    for col, want in expected.items():
        if col not in products.columns:
            mismatches.append(f"{col}: missing")
            continue
        got = kind(products[col].dtype)
        ok = (got == want) or (want == "list" and got == "object") \
            or (want in ("str",) and got == "object")
        if not ok:
            mismatches.append(f"{col}: expected {want}, got {got}")

    out: list[CheckResult] = []
    out.append(_pass("T1", "Types", "Column dtypes match the data contract", 0,
                     "All 40+ columns conform to expected types.") if not mismatches
               else _fail("T1", "Types", "Column dtypes match the data contract",
                          len(mismatches), "; ".join(mismatches)))

    nested_bad = int(products["listing_ids"].map(
        lambda x: not isinstance(x, (list, tuple, np.ndarray))
        or any(not isinstance(i, str) for i in x)
    ).sum())
    out.append(_pass("T2", "Types", "listing_ids contains lists of strings", nested_bad,
                     "Nested column must be an array of strings.") if nested_bad == 0
               else _fail("T2", "Types", "listing_ids contains lists of strings",
                          nested_bad, f"{nested_bad} rows violate the list[str] contract."))
    return out


# ---------------------------------------------------------------------------
# orchestrator
# ---------------------------------------------------------------------------

def run_checks(products: pd.DataFrame, listings: pd.DataFrame,
               attributes: pd.DataFrame) -> list[CheckResult]:
    results: list[CheckResult] = []
    results += check_nulls(products, listings, attributes)
    results += check_duplicates(products, listings, attributes)
    results += check_prices(products)
    results += check_ratings(products)
    results += check_categories(products)
    results += check_brands(products)
    results += check_ids(products, listings)
    results += check_types(products)
    return results
