"""ETL orchestrator: Extract -> Validate -> Clean -> Transform -> Load.

Run with:  python -m etl.run   (or:  .venv/bin/python -m etl.run)

Pipeline overview
-----------------
Pass A (extract only): stream brand/seller value counts to build the data-driven
                       brand canonicalization table.
Pass B (full):        stream records -> validate (reject hard-failures to
                       data/rejected/) -> clean -> transform -> collect.
Load:                 write listings / products / product_attributes tables as
                       Parquet + CSV, plus an attribute-key mapping and a full
                       ETL report (counts, quality flags, lineage checksum).

The raw source file is only ever opened read-only.
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path

from src.transformation.clean import build_brand_map
from src.config import (
    ATTR_KEY_MAP_CSV,
    ATTRIBUTES_STEM,
    DATA_PROCESSED,
    DATA_RAW,
    DATA_REJECTED,
    ETL_REPORT_JSON,
    LISTINGS_STEM,
    PRODUCTS_STEM,
    RAW_LANDING,
    RAW_SOURCE,
    REJECTED_JSONL,
)
from src.ingestion.extract import collect_brand_seller_counts, stream_records
from src.loading.load import (
    write_attr_key_map,
    write_rejected,
    write_report,
    write_table,
)
from src.transformation.transform import (
    add_wide_attributes,
    attribute_key_mapping,
    build_attributes_df,
    build_listings_df,
    build_products_df,
    transform_record,
)
from src.validation.validate import validate_record


def _sha256(path: Path) -> str:
    """Streaming SHA-256 (constant memory regardless of file size)."""
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> dict:
    t0 = time.time()
    print(f"[etl] source: {RAW_SOURCE}")

    # ------------------------------------------------------------------
    # Pass A: brand/seller counts -> brand canonicalization table
    # ------------------------------------------------------------------
    print("[etl] pass A: collecting brand/seller vocabulary ...")
    brand_counts, seller_counts = collect_brand_seller_counts(RAW_SOURCE)
    from src.config import BRAND_OVERRIDES
    brand_map, brand_suspected = build_brand_map(brand_counts, seller_counts, BRAND_OVERRIDES)
    print(f"[etl]       {len(brand_counts)} brands, {len(seller_counts)} sellers, "
          f"{sum(1 for v in brand_map.values() if v)} canonicalized")

    # ------------------------------------------------------------------
    # Pass B: validate + clean + transform (streaming)
    # ------------------------------------------------------------------
    print("[etl] pass B: extracting, validating, cleaning, transforming ...")
    listings: list[dict] = []
    attr_rows: list[dict] = []
    attr_key_pairs: list[tuple[str, str]] = []
    rejected: list[dict] = []
    soft_issue_counter: dict[str, int] = {}
    brand_correction_counter: dict[tuple[str, str], int] = {}
    extracted = 0

    for index, record in stream_records(RAW_SOURCE):
        extracted += 1
        ok, reason, soft = validate_record(index, record)
        if not ok:
            rejected.append({
                "index": index,
                "reason": reason,
                "record": record,
            })
            continue
        listing, rows, key_pairs = transform_record(record, brand_map, brand_suspected, soft)
        listings.append(listing)
        attr_rows.extend(rows)
        attr_key_pairs.extend(key_pairs)
        for issue in soft:
            soft_issue_counter[issue] = soft_issue_counter.get(issue, 0) + 1
        if listing["brand_corrected"]:
            pair = (listing["brand"], listing["brand_canonical"])
            brand_correction_counter[pair] = brand_correction_counter.get(pair, 0) + 1

    # ------------------------------------------------------------------
    # Transform into tables
    # ------------------------------------------------------------------
    print("[etl] building dataframes ...")
    listings_df = build_listings_df(listings)
    products_df = build_products_df(listings_df)
    attributes_df = build_attributes_df(attr_rows)
    products_df = add_wide_attributes(products_df, attributes_df)
    attr_map_df = attribute_key_mapping(attr_key_pairs)

    dup_pids = int(listings_df["is_duplicate_product"].sum())
    extra_dup_rows = dup_pids
    products_df = products_df.drop(columns=["listing_id"]).reset_index(drop=True)

    # ------------------------------------------------------------------
    # Load
    # ------------------------------------------------------------------
    DATA_RAW.mkdir(parents=True, exist_ok=True)
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    DATA_REJECTED.mkdir(parents=True, exist_ok=True)

    tables = {
        "listings": write_table(listings_df, DATA_PROCESSED / LISTINGS_STEM),
        "products": write_table(products_df, DATA_PROCESSED / PRODUCTS_STEM),
        "product_attributes": write_table(attributes_df, DATA_PROCESSED / ATTRIBUTES_STEM),
    }
    write_attr_key_map(attr_map_df, ATTR_KEY_MAP_CSV)
    rejected_written = write_rejected(rejected, REJECTED_JSONL)

    # ------------------------------------------------------------------
    # Report
    # ------------------------------------------------------------------
    rejected_by_reason: dict[str, int] = {}
    for rec in rejected:
        rejected_by_reason[rec["reason"]] = rejected_by_reason.get(rec["reason"], 0) + 1

    report = {
        "pipeline": "extract -> validate -> clean -> transform -> load",
        "run_timestamp": datetime.now(timezone.utc).isoformat(),
        "runtime_seconds": round(time.time() - t0, 1),
        "raw": {
            "source_path": str(RAW_SOURCE),
            "landing_path": str(RAW_LANDING),
            "sha256": _sha256(RAW_SOURCE),
        },
        "layers": {
            "raw": str(DATA_RAW),
            "processed": str(DATA_PROCESSED),
            "rejected": str(DATA_REJECTED),
        },
        "counts": {
            "extracted": extracted,
            "validated_ok": len(listings),
            "rejected_total": len(rejected),
            "rejected_by_reason": rejected_by_reason,
            "rejected_file": str(REJECTED_JSONL),
            "loaded_listings": int(len(listings_df)),
            "loaded_products": int(len(products_df)),
            "loaded_attributes": int(len(attributes_df)),
            "duplicate_product_rows_flagged": dup_pids,
        },
        "transformations": {
            "field_renames": len(__import__("src.config", fromlist=["FIELD_RENAME"]).FIELD_RENAME),
            "missing_sentinels_to_null": True,
            "brand_canonicalized_total": sum(brand_correction_counter.values()),
            "brand_canonicalized_top": {
                f"{old} -> {new}": n
                for (old, new), n in sorted(
                    brand_correction_counter.items(), key=lambda kv: -kv[1]
                )[:25]
            },
            "sub_category_normalized_total": int(listings_df["sub_category_normalized"].sum()),
            "category_anomalies_flagged": int(listings_df["is_category_anomaly"].sum()),
            "attribute_keys_original": int(attr_map_df.shape[0]),
            "attribute_keys_canonical": int(attr_map_df["canonical_key"].nunique()),
            "attribute_key_mapping_file": str(ATTR_KEY_MAP_CSV),
        },
        "quality_flags": {
            "issue": {k: soft_issue_counter[k] for k in sorted(soft_issue_counter)},
            "listings_flagged": {
                col: int(listings_df[col].sum())
                for col in [
                    "has_invalid_mrp", "has_invalid_selling_price", "has_invalid_rating",
                    "has_malformed_discount", "has_invalid_crawled_at", "has_no_description",
                    "title_missing", "images_not_list", "out_of_stock_not_bool",
                    "crawled_at_missing", "brand_suspected_truncated",
                ]
            },
        },
        "derived_attribute_distributions": {
            "gender": listings_df["gender"].value_counts().to_dict(),
            "price_band": listings_df["price_band"].value_counts().to_dict(),
            "rating_bucket": listings_df["rating_bucket"].value_counts().to_dict(),
            "out_of_stock": listings_df["is_out_of_stock"].value_counts().to_dict(),
            "category": listings_df["category"].value_counts().to_dict(),
            "brand_canonical_top20": products_df["brand_canonical"].value_counts().head(20).to_dict(),
        },
        "tables": tables,
    }
    write_report(report, ETL_REPORT_JSON)

    # ------------------------------------------------------------------
    # Console summary
    # ------------------------------------------------------------------
    print("\n=== ETL SUMMARY ===")
    print(f"extracted: {extracted:,}   validated: {len(listings):,}   rejected: {len(rejected)}")
    print(f"listings: {len(listings_df):,} | products (deduped): {len(products_df):,} | "
          f"attributes: {len(attributes_df):,}")
    print(f"duplicate product rows flagged: {dup_pids:,}")
    print(f"brand canonicalized: {sum(brand_correction_counter.values()):,}")
    print(f"sub_category normalized: {int(listings_df['sub_category_normalized'].sum()):,}")
    print(f"gender distribution: {dict(listings_df['gender'].value_counts())}")
    print(f"rejected records: {rejected_written} -> {REJECTED_JSONL}")
    print(f"report: {ETL_REPORT_JSON}")
    print(f"runtime: {report['runtime_seconds']}s")
    return report


if __name__ == "__main__":
    main()
