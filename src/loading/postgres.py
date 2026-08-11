#!/usr/bin/env python3
"""Load the Phase 3 processed layer into PostgreSQL (fashion star schema).

Reproducible, deterministic, bulk-loaded via COPY.

Usage:
  bash scripts/db_init.sh                    # start DB + apply schema + views
  .venv/bin/python -m src.loading.postgres   # load the data

Connections are configured through env vars (defaults target the project
container from scripts/db_init.sh):
  PGHOST=localhost  PGPORT=5433  PGUSER=postgres  PGPASSWORD=postgres  PGDATABASE=fashion_bi

Surrogate dimension ids are computed deterministically (sorted), and the
'Unknown' reference rows (id 0) created by 00_schema.sql are reused for
products with no brand / category / gender / seller.
"""

from __future__ import annotations

import io
import json
import os
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parent.parent
PROCESSED = REPO_ROOT / "data" / "processed"
PRODUCTS_FILE = PROCESSED / "products.parquet"
ATTRIBUTES_FILE = PROCESSED / "product_attributes.parquet"

CONN_STR = (
    f"host={os.environ.get('PGHOST', 'localhost')} "
    f"port={os.environ.get('PGPORT', '5433')} "
    f"user={os.environ.get('PGUSER', 'postgres')} "
    f"password={os.environ.get('PGPASSWORD', 'postgres')} "
    f"dbname={os.environ.get('PGDATABASE', 'fashion_bi')}"
)

ATTR_WIDE_COLS = [
    "attr_fabric", "attr_pattern", "attr_fit", "attr_color", "attr_size",
    "attr_sleeve", "attr_sleeve_type", "attr_neck_type", "attr_ideal_for",
    "attr_suitable_for", "attr_occasion", "attr_pack_of",
    "attr_country_of_origin", "attr_closure", "attr_reversible", "attr_hooded",
    "attr_fabric_care", "attr_style_code", "attr_brand_color", "attr_type",
    "attr_sales_package", "attr_model_name", "attr_other_details", "attr_pockets",
    "attr_rise", "attr_collar", "attr_generic_name", "attr_hem",
    "attr_sole_material", "attr_fly", "attr_length_type", "attr_waistband",
    "attr_pocket_type", "attr_distressed", "attr_faded", "attr_model_number",
    "attr_other_features", "attr_inseam_length", "attr_stretchable",
    "attr_character",
]


def _to_postgres_array(values: list) -> str:
    """Render a Python list as a PostgreSQL text[] array literal."""
    items = [json.dumps(str(v)) for v in values]  # JSON quoting ~ SQL quoting
    return "{" + ",".join(items) + "}"


def _csv_table(rows: list[tuple], columns: list[str]) -> tuple[str, io.StringIO]:
    """Build a COPY-able CSV (headerless) from tuples.

    Uses the csv module directly (not pandas) so integer columns are never
    float-coerced, and None/NaN render as empty fields (NULL).
    """
    import csv
    import math

    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")

    def _fmt(v):
        if v is None:
            return ""
        if isinstance(v, bool):
            return "t" if v else "f"
        if isinstance(v, float):
            return "" if math.isnan(v) else str(v)
        return v

    for row in rows:
        writer.writerow([_fmt(v) for v in row])
    buf.seek(0)
    return ",".join(columns), buf


def load() -> None:
    import psycopg

    products = pd.read_parquet(PRODUCTS_FILE)
    attributes = pd.read_parquet(ATTRIBUTES_FILE)

    # ------------------------------------------------------------------
    # Build deterministic surrogate-key dimensions
    # (id 0 = 'Unknown' is pre-seeded by 00_schema.sql; never re-inserted)
    # ------------------------------------------------------------------
    genders = sorted(x for x in products["gender"].dropna().unique() if x != "Unknown")
    gender_map = {"Unknown": 0, **{g: i + 1 for i, g in enumerate(genders)}}

    brands = sorted(x for x in products["brand_canonical"].dropna().unique() if x != "Unknown")
    brand_map = {"Unknown": 0, **{b: i + 1 for i, b in enumerate(brands)}}

    cat_pairs = sorted(
        {tuple(x) for x in products[["category", "sub_category"]].drop_duplicates().values
         if x[0] != "Unknown" and x[1] != "Unknown"}
    )
    category_map = {"Unknown": 0, **{p: i + 1 for i, p in enumerate(cat_pairs)}}

    sellers = sorted(x for x in products["seller"].dropna().unique() if x != "Unknown")
    seller_map = {"Unknown": 0, **{s: i + 1 for i, s in enumerate(sellers)}}

    # Representative raw brand per canonical brand (mode of brand_corrected,
    # ignoring the non-string pollution sentinel used by the ETL).
    corrected = products.loc[
        products["brand_corrected"].map(lambda v: isinstance(v, str)),
        ["brand_canonical", "brand_corrected"],
    ]
    raw_brand = corrected.groupby("brand_canonical")["brand_corrected"] \
        .agg(lambda s: s.mode().iloc[0]).to_dict()

    # ------------------------------------------------------------------
    # Dimension rows (skip id 0: already seeded by the schema)
    # ------------------------------------------------------------------
    dim_brand_rows = [
        (bid, name, raw_brand.get(name) if raw_brand.get(name) else None, raw_brand.get(name) != name)
        for name, bid in sorted(brand_map.items(), key=lambda kv: kv[1]) if bid > 0
    ]
    dim_category_rows = [
        (cid, cat, sub) for key, cid in sorted(category_map.items(), key=lambda kv: kv[1])
        if cid > 0 for cat, sub in [key]
    ]
    dim_gender_rows = [
        (gid, name) for name, gid in sorted(gender_map.items(), key=lambda kv: kv[1]) if gid > 0
    ]
    dim_seller_rows = [
        (sid, name) for name, sid in sorted(seller_map.items(), key=lambda kv: kv[1]) if sid > 0
    ]

    # dim_product rows
    def _int(v):
        return None if v is None or pd.isna(v) else int(v)

    def _pack_of(v):
        n = _int(v)
        return None if n is not None and n < 1 else n

    def _num(v):
        return None if v is None or pd.isna(v) else float(v)

    dim_product_rows = []
    fact_rows = []
    for rec in products.to_dict("records"):
        pid = rec["product_id"]
        bname = rec["brand_canonical"] if isinstance(rec["brand_canonical"], str) else "Unknown"
        cname = (rec["category"], rec["sub_category"])
        if not isinstance(rec["category"], str) or not isinstance(rec["sub_category"], str):
            cname = "Unknown"
        gname = rec["gender"] if isinstance(rec["gender"], str) else "Unknown"
        sname = rec["seller"] if isinstance(rec["seller"], str) else "Unknown"

        dim_product_rows.append((
            pid, rec["title"], rec["description"],
            brand_map[bname], category_map[cname], gender_map[gname], seller_map[sname],
            rec["channel"],
            _to_postgres_array(rec["listing_ids"]) if isinstance(rec["listing_ids"], list) else "{}",
            rec["crawled_at"], int(rec["n_listings"]), int(rec["n_attributes"]),
            int(rec["image_count"]),
            _pack_of(rec["pack_of"]), rec["primary_image"], bool(rec["is_category_anomaly"]),
            *[rec.get(c) for c in ATTR_WIDE_COLS],
        ))

        fact_rows.append((
            pid,
            brand_map[bname], category_map[cname], gender_map[gname], seller_map[sname],
            rec["snapshot_date"],
            _num(rec["mrp"]), _num(rec["selling_price"]), _int(rec["discount_pct"]),
            _int(rec["effective_discount_pct"]), _num(rec["avg_rating"]),
            rec["rating_bucket"], rec["price_band"],
            bool(rec["is_out_of_stock"]), bool(rec["any_out_of_stock"]),
            bool(rec["has_rating"]), int(rec["image_count"]), int(rec["n_attributes"]),
            int(rec["n_listings"]), _num(rec["min_selling_price"]), _num(rec["max_selling_price"]),
        ))

    # product_attributes (deduped at product grain for a clean EAV table)
    eav = attributes[["product_id", "attr_key", "attr_value"]] \
        .drop_duplicates().dropna(subset=["attr_value"])
    eav_rows = [tuple(x) for x in eav.itertuples(index=False)]

    # ------------------------------------------------------------------
    # Bulk load via COPY
    # ------------------------------------------------------------------
    tables = [
        ("fashion.dim_brand (brand_id, brand_name, brand_raw, is_canonicalized)",
         dim_brand_rows,
         ["brand_id", "brand_name", "brand_raw", "is_canonicalized"]),
        ("fashion.dim_category (category_id, category, sub_category)",
         dim_category_rows,
         ["category_id", "category", "sub_category"]),
        ("fashion.dim_gender (gender_id, gender)",
         dim_gender_rows,
         ["gender_id", "gender"]),
        ("fashion.dim_seller (seller_id, seller_name)",
         dim_seller_rows,
         ["seller_id", "seller_name"]),
        ("fashion.dim_product (product_id, title, description, brand_id, category_id,"
         " gender_id, seller_id, channel, listing_ids, crawled_at, n_listings,"
         " n_attributes, image_count, pack_of, primary_image, is_category_anomaly, "
         + ", ".join(ATTR_WIDE_COLS) + ")",
         dim_product_rows,
         ["product_id", "title", "description", "brand_id", "category_id",
          "gender_id", "seller_id", "channel", "listing_ids", "crawled_at",
          "n_listings", "n_attributes", "image_count", "pack_of", "primary_image",
          "is_category_anomaly", *ATTR_WIDE_COLS]),
        ("fashion.fact_products (product_id, brand_id, category_id, gender_id, seller_id,"
         " snapshot_date, mrp, selling_price, discount_pct, effective_discount_pct,"
         " avg_rating, rating_bucket, price_band, is_out_of_stock, any_out_of_stock,"
         " has_rating, image_count, n_attributes, n_listings, min_selling_price,"
         " max_selling_price)",
         fact_rows,
         ["product_id", "brand_id", "category_id", "gender_id", "seller_id",
          "snapshot_date", "mrp", "selling_price", "discount_pct",
          "effective_discount_pct", "avg_rating", "rating_bucket", "price_band",
          "is_out_of_stock", "any_out_of_stock", "has_rating", "image_count",
          "n_attributes", "n_listings", "min_selling_price", "max_selling_price"]),
        ("fashion.product_attributes (product_id, attr_key, attr_value)",
         eav_rows,
         ["product_id", "attr_key", "attr_value"]),
    ]

    with psycopg.connect(CONN_STR) as conn:
        with conn.cursor() as cur:
            for target, rows, columns in tables:
                sql, buf = _csv_table(rows, columns)
                cur.execute("SET LOCAL work_mem = '64MB'")
                with cur.copy(f"COPY {target} FROM STDIN WITH (FORMAT csv, NULL '')") as copy:
                    chunk = buf.read(1 << 20)
                    while chunk:
                        copy.write(chunk)
                        chunk = buf.read(1 << 20)
                print(f"  loaded {len(rows):,} rows -> {target.split(' ')[0]}")
        conn.commit()

    print("\nLoad complete.")


if __name__ == "__main__":
    load()
