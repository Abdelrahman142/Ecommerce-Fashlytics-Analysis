"""Smoke tests for the Phase 9 data-quality module."""

import pandas as pd
import pytest

from src.quality import build_report, render_json, render_markdown, run_checks
from src.quality.checks import (
    _blank,
    _price_band,
    _rating_bucket,
    check_brands,
    check_duplicates,
    check_prices,
    check_ratings,
)


def sample_products() -> pd.DataFrame:
    return pd.DataFrame({
        "product_id": ["p1", "p2", "p3"],
        "title": ["A", "B", "C"],
        "brand": ["Alpha", None, "Zeta"],
        "brand_canonical": ["alpha", None, "zeta"],
        "brand_suspected_truncated": [False, False, True],
        "brand_corrected": [False, False, False],
        "category": ["Men", "Women", "Men"],
        "sub_category": ["Shirts", "Dresses", "Shirts"],
        "sub_category_normalized": [False, False, False],
        "is_category_anomaly": [False, False, False],
        "mrp": [100.0, 200.0, None],
        "selling_price": [50.0, 100.0, None],
        "discount_pct": [50.0, 50.0, None],
        "effective_discount_pct": [50.0, 50.0, None],
        "price_band": ["budget", "budget", None],
        "avg_rating": [4.5, None, 3.0],
        "rating_bucket": ["high", None, "mid"],
        "has_rating": [True, False, True],
        "image_count": [1, 2, 3],
        "n_attributes": [1, 1, 1],
        "n_listings": [1, 2, 1],
        "pack_of": [2.0, 3.0, 1.0],
        "min_selling_price": [50.0, 100.0, None],
        "max_selling_price": [50.0, 100.0, None],
        "is_out_of_stock": [False, False, False],
        "any_out_of_stock": [False, False, False],
        "snapshot_date": ["2026-01-01", "2026-01-01", "2026-01-01"],
        "crawled_at": pd.to_datetime(["2026-01-01", "2026-01-01", "2026-01-01"]),
        "description": [None, None, None],
        "primary_image": [None, None, None],
        "url": ["u1", "u2", "u3"],
        "channel": ["site", "site", "site"],
        "seller": ["s1", "s2", "s3"],
        "gender": ["Men", "Women", "Men"],
        "gender_source": ["pattern", "pattern", "pattern"],
        "listing_ids": [["00000000-0000-4000-8000-000000000001"],
                        ["00000000-0000-4000-8000-000000000002",
                         "00000000-0000-4000-8000-000000000003"],
                        ["00000000-0000-4000-8000-000000000004"]],
    })


def sample_listings() -> pd.DataFrame:
    return pd.DataFrame({
        "listing_id": [
            "00000000-0000-4000-8000-000000000001",
            "00000000-0000-4000-8000-000000000002",
            "00000000-0000-4000-8000-000000000003",
            "00000000-0000-4000-8000-000000000004",
            "00000000-0000-4000-8000-000000000005",
        ],
        "product_id": ["p1", "p2", "p2", "p3", "p3"],
    })


def sample_attributes() -> pd.DataFrame:
    return pd.DataFrame({
        "product_id": ["p1", "p1", "p2"],
        "attr_key": ["color", "color", "size"],
        "attr_value": ["blue", "blue", "M"],
    })


def test_quality_runs_and_report_renders() -> None:
    results = run_checks(sample_products(), sample_listings(),
                         sample_attributes())
    assert results
    report = build_report(results, {"generated_at": "now",
                                    "rows": {"products": 3, "listings": 5,
                                             "attributes": 3},
                                    "source": "test", "command": "pytest"})
    assert report["summary"]["total_checks"] == len(results)
    assert "FAIL" not in report["summary"]["by_status"]
    md = render_markdown(report)
    assert md.startswith("# Data Quality Report")
    js = render_json(report)
    assert '"summary"' in js


def test_rating_bucket_boundaries() -> None:
    assert _rating_bucket(2.99) == "low"
    assert _rating_bucket(3.0) == "mid"
    assert _rating_bucket(3.99) == "mid"
    assert _rating_bucket(4.0) == "high"
    assert _rating_bucket(4.99) == "high"
    assert _rating_bucket(5.0) == "high"
    assert _rating_bucket(None) is None


def test_price_band_boundaries() -> None:
    assert _price_band(0) == "budget"
    assert _price_band(499) == "budget"
    assert _price_band(500) == "mid"
    assert _price_band(4000) == "luxury"
    assert _price_band(None) is None


def test_blank_mask_and_duplicates() -> None:
    p = sample_products()
    assert _blank(p, "title") == 0
    res = check_duplicates(p, sample_listings(), sample_attributes())
    statuses = {r.check_id: r.status for r in res}
    assert statuses["D3"] == "PASS"
    assert statuses["D1"] == "WARN"


def test_price_and_brand_checks() -> None:
    p = sample_products()
    prices = {r.check_id: r.status for r in check_prices(p)}
    assert prices["P3"] == "PASS"
    brands = {r.check_id: r.status for r in check_brands(p)}
    assert brands["B3"] == "PASS"


def test_ratings_consistency() -> None:
    ratings = {r.check_id: r.status for r in check_ratings(sample_products())}
    assert ratings["R1"] == "PASS"
    assert ratings["R2"] == "PASS"
    assert ratings["R3"] == "PASS"
