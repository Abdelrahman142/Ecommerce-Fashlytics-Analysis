"""Transform stage: derive fields, build the three output tables.

Clean *listing* dicts are produced per raw record; then:
- ``listings`` table: 1 row per raw record (full audit trail, duplicate flags).
- ``products`` table: 1 row per unique product id (deduplicated dimension).
- ``product_attributes`` table: long-form (EAV) cleaned attributes.

Derived attributes (all justified by available data, see docs/data_profile.md):
- gender (from Ideal For attribute + title keyword fallback)
- price_band, effective_discount_pct, rating_bucket, pack_of, image_count
- is_duplicate_product, duplicate/tooltip/category-anomaly flags
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from typing import Any, Iterator

import pandas as pd

from src.config import (
    ATTR_PIVOT_KEYS,
    FIELD_RENAME,
    GENDER_KEYWORDS,
    POLLUTED_SUB_CATEGORY_PREFIXES,
    PRICE_BANDS,
    RATING_BUCKETS,
)
from src.transformation.clean import (
    clean_attr_value,
    clean_seller,
    clean_text,
    iter_product_details,
    parse_crawled_at,
    parse_discount_pct,
    parse_price,
    parse_rating,
)

# ---------------------------------------------------------------------------
# Derived-attribute helpers
# ---------------------------------------------------------------------------

def price_band(selling_price: float | None) -> str | None:
    if selling_price is None:
        return None
    for label, lo, hi in PRICE_BANDS:
        if lo <= selling_price <= hi:
            return label
    return None


def rating_bucket(rating: float | None) -> str | None:
    if rating is None:
        return None
    for label, lo, hi in RATING_BUCKETS:
        if lo <= rating < hi:
            return label
    return "high" if rating == 5.0 else None


def effective_discount_pct(mrp: float | None, selling: float | None) -> int | None:
    """True discount implied by prices: round((1 - selling/mrp)*100)."""
    if mrp is None or selling is None or mrp <= 0 or selling <= 0 or selling > mrp:
        return None
    return round((1 - selling / mrp) * 100)


def pack_of_number(value: str | None) -> int | None:
    """Extract the numeric pack size from a 'Pack of' attribute value."""
    if not value:
        return None
    m = re.search(r"(\d+)", value)
    return int(m.group(1)) if m else None


_GENDER_TOKEN_MAP = {
    "women": "Women", "woman": "Women", "girls": "Women", "girl": "Women",
    "men": "Men", "man": "Men",
    "boys": "Kids", "boy": "Kids", "kids": "Kids", "children": "Kids",
    "baby": "Kids", "infant": "Kids", "toddler": "Kids", "child": "Kids",
    "unisex": "Mixed",
}


def classify_gender_tokens(tokens: list[str]) -> tuple[str | None, list[str]]:
    """Classify gender from a list of tokens. Returns (label, sorted segments)."""
    segments: set[str] = set()
    for token in tokens:
        t = token.lower().strip()
        if t in _GENDER_TOKEN_MAP:
            segments.add(_GENDER_TOKEN_MAP[t])
    if not segments:
        return None, []
    if "Men" in segments and "Women" in segments:
        label = "Mixed"
    elif "Men" in segments:
        label = "Men"
    elif "Women" in segments:
        label = "Women"
    elif "Kids" in segments:
        label = "Kids"
    else:
        label = "Mixed"
    return label, sorted(segments)


def derive_gender(ideal_for: str | None, title: str | None) -> tuple[str, str]:
    """Derive a gender label with source attribution.

    Primary source: the 'Ideal For' product attribute (e.g. 'Men', 'Men, Boys').
    Fallback: gendered keywords in the title. Otherwise 'Unknown'.
    """
    if ideal_for:
        label, _ = classify_gender_tokens([t for t in re.split(r"[,\s]+", ideal_for) if t])
        if label:
            return label, "ideal_for"
    if title:
        label, _ = classify_gender_tokens([t for t in re.split(r"[,\s]+", title) if t])
        if label:
            return label, "title"
    return "Unknown", "none"


def _snake(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


# ---------------------------------------------------------------------------
# Record-level transform
# ---------------------------------------------------------------------------

def normalize_sub_category(category: str, sub_category: object) -> tuple[str, str | None, bool]:
    """Normalize sub_category, salvaging polluted brand+category concatenations.

    Returns ``(sub_category, channel, was_normalized)``. When a sub_category is
    a 'channel <Category>' concatenation (e.g. 'Sunshopping Bags, Wallets &
    Belts'), the channel is extracted and sub_category is reset to the clean
    category so the taxonomy stays consistent.
    """
    cat = category.strip()
    sub = clean_text(sub_category)
    if sub is None:
        return cat, None, False
    if sub.lower() == cat.lower():
        return cat, None, False
    if sub.lower().endswith(cat.lower()) and len(sub) > len(cat):
        prefix = sub[: -len(cat)].strip().strip(" ,")
        return cat, prefix, True
    for prefix in POLLUTED_SUB_CATEGORY_PREFIXES:
        if sub.lower().startswith(prefix.lower()):
            return cat, prefix, True
    return sub, None, False


def transform_record(
    record: dict,
    brand_map: dict[str, str],
    brand_suspected: dict[str, bool],
    soft_issues: list[str],
) -> tuple[dict[str, Any], list[dict[str, Any]], list[tuple[str, str]]]:
    """Clean + transform one validated raw record.

    Returns ``(listing_dict, attribute_rows, attr_key_pairs)`` where
    ``attr_key_pairs`` are ``(original_key, canonical_key)`` observations used
    to build the attribute-key mapping artifact.
    """
    issues = set(soft_issues)
    brand_raw = clean_text(record.get("brand"))
    brand_clean = brand_raw if brand_raw else None
    brand_canonical = brand_map.get(brand_clean, brand_clean) if brand_clean else None
    brand_corrected = bool(brand_clean and brand_canonical and brand_clean != brand_canonical)
    brand_susp = bool(brand_clean and brand_suspected.get(brand_clean, False))

    seller = clean_seller(record.get("seller"))

    mrp = parse_price(record.get("actual_price"))
    if record.get("actual_price") is not None and mrp is None:
        issues.add("has_invalid_mrp")
    selling = parse_price(record.get("selling_price"))
    if record.get("selling_price") is not None and selling is None:
        issues.add("has_invalid_selling_price")
    discount_pct = parse_discount_pct(record.get("discount"))
    if record.get("discount") is not None and discount_pct is None:
        issues.add("has_malformed_discount")
    rating = parse_rating(record.get("average_rating"))
    if record.get("average_rating") is not None and rating is None:
        issues.add("has_invalid_rating")

    crawled_at, snapshot_date = parse_crawled_at(record.get("crawled_at"))
    if record.get("crawled_at") is not None and crawled_at is None:
        issues.add("has_invalid_crawled_at")

    images = record.get("images")
    if not isinstance(images, list):
        images = []
        issues.add("images_not_list")
    image_urls = [u for u in images if isinstance(u, str) and u.strip()]
    image_count = len(image_urls)
    primary_image = image_urls[0] if image_urls else None

    # product_details -> attributes
    attr_rows: list[dict[str, Any]] = []
    attr_key_pairs: list[tuple[str, str]] = []
    attr_values: dict[str, list[str]] = {}
    pd_list = record.get("product_details")
    if isinstance(pd_list, list):
        for canonical_key, clean_value, original_key in iter_product_details(pd_list):
            attr_key_pairs.append((original_key, canonical_key))
            if clean_value is None:
                continue
            attr_values.setdefault(canonical_key, []).append(clean_value)
            attr_rows.append({
                "listing_id": str(record["_id"]),
                "product_id": str(record["pid"]),
                "attr_key": canonical_key,
                "attr_key_original": original_key,
                "attr_value": clean_value,
                "attr_value_len": len(clean_value),
            })

    n_attributes = len(attr_rows)
    ideal_for = (attr_values.get("Ideal For") or [None])[0]
    pack_of = pack_of_number((attr_values.get("Pack of") or [None])[0])
    gender, gender_source = derive_gender(ideal_for, clean_text(record.get("title")))

    category = clean_text(record.get("category"))
    sub_category, channel, sub_normalized = normalize_sub_category(category, record.get("sub_category"))

    description = clean_text(record.get("description"))
    if description is None:
        issues.add("has_no_description")

    listing = {
        "listing_id": str(record["_id"]),
        "product_id": str(record["pid"]),
        "url": str(record.get("url")),
        "title": clean_text(record.get("title")),
        "description": description,
        "category": category,
        "sub_category": sub_category,
        "sub_category_normalized": sub_normalized,
        "channel": channel,
        "brand": brand_clean,
        "brand_canonical": brand_canonical,
        "brand_corrected": brand_corrected,
        "brand_suspected_truncated": brand_susp,
        "seller": seller,
        "mrp": mrp,
        "selling_price": selling,
        "discount_pct": discount_pct,
        "effective_discount_pct": effective_discount_pct(mrp, selling),
        "avg_rating": rating,
        "rating_bucket": rating_bucket(rating),
        "is_out_of_stock": bool(record.get("out_of_stock")),
        "crawled_at": crawled_at,
        "snapshot_date": snapshot_date,
        "image_count": image_count,
        "primary_image": primary_image,
        "n_attributes": n_attributes,
        "gender": gender,
        "gender_source": gender_source,
        "price_band": price_band(selling),
        "pack_of": pack_of,
        "has_rating": rating is not None,
        "is_category_anomaly": category == "Toys",
        "title_missing": "title_missing" in issues,
        "images_not_list": "images_not_list" in issues,
        "out_of_stock_not_bool": "out_of_stock_not_bool" in issues,
        "crawled_at_missing": "crawled_at_missing" in issues,
        "has_invalid_mrp": "has_invalid_mrp" in issues,
        "has_invalid_selling_price": "has_invalid_selling_price" in issues,
        "has_invalid_rating": "has_invalid_rating" in issues,
        "has_malformed_discount": "has_malformed_discount" in issues,
        "has_invalid_crawled_at": "has_invalid_crawled_at" in issues,
        "has_no_description": "has_no_description" in issues,
    }
    return listing, attr_rows, attr_key_pairs


# ---------------------------------------------------------------------------
# Table builders
# ---------------------------------------------------------------------------

def build_listings_df(listings: list[dict[str, Any]]) -> pd.DataFrame:
    """Mark duplicate product rows (later occurrences of a product id)."""
    seen: set[str] = set()
    for listing in listings:
        listing["is_duplicate_product"] = listing["product_id"] in seen
        seen.add(listing["product_id"])
    df = pd.DataFrame(listings)
    return df


def build_products_df(listings_df: pd.DataFrame) -> pd.DataFrame:
    """Deduplicate listings into a product dimension (1 row per product id).

    The canonical listing per product is the most complete one (most attribute
    rows + images + rating + description); ties broken by earliest crawl time.
    """
    score = (
        listings_df["n_attributes"].fillna(0)
        + listings_df["image_count"].fillna(0)
        + listings_df["has_rating"].astype(int)
        + (~listings_df["has_no_description"]).astype(int)
    )
    ranked = listings_df.assign(_score=score).sort_values(
        ["_score", "crawled_at"], ascending=[False, True]
    )
    products = ranked.drop_duplicates(subset="product_id", keep="first").drop(columns="_score")

    # Aggregate cross-listing facts.
    agg = listings_df.groupby("product_id").agg(
        n_listings=("listing_id", "count"),
        listing_ids=("listing_id", lambda s: sorted(s.tolist())),
        any_out_of_stock=("is_out_of_stock", "any"),
        min_selling_price=("selling_price", "min"),
        max_selling_price=("selling_price", "max"),
    ).reset_index()
    products = products.merge(agg, on="product_id", how="left")
    return products


def add_wide_attributes(products: pd.DataFrame, attributes: pd.DataFrame) -> pd.DataFrame:
    """Pivot the top product attributes wide onto the products table."""
    # Collapse duplicate key/value pairs per listing.
    uniq = attributes.drop_duplicates(subset=["listing_id", "attr_key", "attr_value"])
    # Join attributes to the canonical listing of each product.
    merged = uniq[["listing_id", "attr_key", "attr_value"]].merge(
        products[["product_id", "listing_id"]], on="listing_id", how="inner"
    )
    for key in ATTR_PIVOT_KEYS:
        col = f"attr_{_snake(key)}"
        sub = merged[merged["attr_key"] == key]
        grouped = (
            sub.groupby("product_id")["attr_value"]
            .agg(lambda s: ", ".join(dict.fromkeys(v for v in s if v)))
            .reset_index()
        )
        products = products.merge(grouped.rename(columns={"attr_value": col}), on="product_id", how="left")
    return products


def build_attributes_df(attr_rows: list[dict[str, Any]]) -> pd.DataFrame:
    return pd.DataFrame(attr_rows)


def attribute_key_mapping(attr_key_pairs: list[tuple[str, str]]) -> pd.DataFrame:
    """Original -> canonical attribute key mapping with occurrence counts."""
    counter: Counter = Counter()
    for original, canonical in attr_key_pairs:
        counter[(original, canonical)] += 1
    rows = [
        {"original_key": o, "canonical_key": c, "occurrences": n}
        for (o, c), n in sorted(counter.items(), key=lambda kv: -kv[1])
    ]
    return pd.DataFrame(rows)
