"""Central configuration for the ETL pipeline.

Paths, layer conventions, field renaming, validation rules, thresholds, and the
static normalization tables used by the cleaner modules. Everything here is
derived from the Phase 1 data profile.
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Repository / layer paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent

# Source of truth: the original raw file. Never modified.
RAW_SOURCE = REPO_ROOT / "flipkart_fashion_products_dataset.json"

# Layer directories (landing, processed, rejected)
DATA_RAW = REPO_ROOT / "data" / "raw"
DATA_PROCESSED = REPO_ROOT / "data" / "processed"
DATA_REJECTED = REPO_ROOT / "data" / "rejected"

# Byte-identical landing copy of the immutable source.
RAW_LANDING = DATA_RAW / "flipkart_fashion_products_dataset.json"

# Processed outputs
LISTINGS_STEM = "listings"                 # 1 row per raw listing (audit trail)
PRODUCTS_STEM = "products"                 # 1 row per unique product (deduped)
ATTRIBUTES_STEM = "product_attributes"     # long-form EAV attribute rows
ATTR_KEY_MAP_CSV = DATA_PROCESSED / "attribute_key_mapping.csv"
ETL_REPORT_JSON = DATA_PROCESSED / "etl_report.json"

# Rejected layer
REJECTED_JSONL = DATA_REJECTED / "rejected_records.jsonl"

# ---------------------------------------------------------------------------
# Field renaming: raw JSON field -> standardized snake_case column
# ---------------------------------------------------------------------------
FIELD_RENAME = {
    "_id": "listing_id",
    "pid": "product_id",
    "url": "url",
    "title": "title",
    "description": "description",
    "category": "category",
    "sub_category": "sub_category",
    "brand": "brand",
    "seller": "seller",
    "actual_price": "mrp",
    "selling_price": "selling_price",
    "discount": "discount_pct",
    "average_rating": "avg_rating",
    "out_of_stock": "is_out_of_stock",
    "crawled_at": "crawled_at",
    "images": "images",
    "product_details": "product_details",
}

# Fields required on every record; a missing/empty value is a hard rejection.
REQUIRED_FIELDS = ("_id", "pid", "category", "product_details")

# ---------------------------------------------------------------------------
# Validation thresholds
# ---------------------------------------------------------------------------
# Values above this many characters in `brand` are never treated as truncated.
MIN_TRUNCATION_CANDIDATE_LEN = 10

# Brand canonicalization constraints:
#  - a brand must be at least this long to be expanded by prefix matching
#    (shorter brands like 'V', 'A', 'Pu' are too ambiguous),
#  - the corroborating seller must have at least this many listings.
MIN_BRAND_CANONICAL_BASE_LEN = 3
MIN_BRAND_CANONICAL_SELLER_COUNT = 10

# ---------------------------------------------------------------------------
# Derived-attribute thresholds (documented business definitions)
# ---------------------------------------------------------------------------
# Price bands based on selling price (INR).
PRICE_BANDS = [
    ("budget", 0, 499),
    ("mid", 500, 1499),
    ("premium", 1500, 3999),
    ("luxury", 4000, float("inf")),
]

# Rating buckets for the "rating quality" dimension.
RATING_BUCKETS = [
    ("low", 0.0, 3.0),        # [0, 3)
    ("mid", 3.0, 4.0),        # [3, 4)
    ("high", 4.0, 5.01),      # [4, 5]
]

# ---------------------------------------------------------------------------
# Categorical normalization tables (evidence in Phase 1 profile / verification)
# ---------------------------------------------------------------------------

# Known brand-name corrections that prefix matching against seller names cannot
# discover on its own. Every entry is justified by observed data (see
# scripts/verify_findings.py output / docs/data_profile.md section 9.2).
BRAND_OVERRIDES = {
    "True Bl": "True Blue",
    "Free Authori": "Free Authority",
    "ECKO Unl": "Ecko Unlimited",
    "SATDEVANGIKHADIBHAND": "Satdevangi Khadi Bhandar",
    "Byford by Pantaloo": "Byford by Pantaloon",
    "JACK AND HAR": "Jack and Harold",
    "MASH UNLIMIT": "Mash Unlimited",
    "HUMANITY ORIGINA": "Humanity Originals",
    "TOM BU": "Tomburg",
}

# product_details key canonicalization. Keys are matched after whitespace
# stripping. Empty/whitespace keys carry orphaned values (sales package /
# care snippets) and are grouped under "Other Attribute".
ATTR_KEY_CANONICAL = {
    "": "Other Attribute",
    " ": "Other Attribute",
    "Pack Of": "Pack of",
    "Pack of": "Pack of",
    "Care Instructions": "Fabric Care",
    "Care instructions": "Fabric Care",
    "Fabric care": "Fabric Care",
    "Weave type": "Weave Type",
    "Package contains": "Sales Package",
    "Style Code": "Style Code",
    "Style code": "Style Code",
}

# Attribute keys to pivot wide onto the products table (top coverage keys from
# the Phase 1 profile). Pivoted columns are snake_cased: attr_fabric, ...
ATTR_PIVOT_KEYS = [
    "Fabric", "Pattern", "Fit", "Color", "Size", "Sleeve", "Sleeve Type",
    "Neck Type", "Ideal For", "Suitable For", "Occasion", "Pack of",
    "Country of Origin", "Closure", "Reversible", "Hooded", "Fabric Care",
    "Style Code", "Brand Color", "Type", "Sales Package", "Model Name",
    "Other Details", "Pockets", "Rise", "Collar", "Generic Name", "Hem",
    "Sole Material", "Fly", "Length Type", "Waistband", "Pocket Type",
    "Distressed", "Faded", "Model Number", "Other Features", "Inseam Length",
    "Stretchable", "Character",
]

# Sub-category values that are category+brand concatenations polluting the
# taxonomy (Phase 1 section 9.3). Prefix (e.g. "Sunshopping") is salvaged as a
# channel/seller-affinity tag; the sub_category is reset to the clean category.
POLLUTED_SUB_CATEGORY_PREFIXES = [
    "Sunshopping", "Uber Urban", "Inspire", "INSPIRE", "Crocks Club", "Roy",
    "Winsome Deal", "YOFAMA", "Brand Trunk", "mentiezi",
]

# Gender keyword lists used when the `Ideal For` attribute is absent.
GENDER_KEYWORDS = {
    "Women": ["women", "woman", "girls", "girl"],
    "Men": ["men", "man", "boys", "boy"],
    "Kids": ["kids", "child", "children", "baby", "infant", "toddler"],
    "Mixed": ["unisex"],
}
