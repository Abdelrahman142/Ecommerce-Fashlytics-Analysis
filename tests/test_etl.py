"""Tests for the ETL pipeline.

These use a small synthetic dataset (including malformed records) so the
rejection machinery, cleaning rules, and dedup logic are exercised end-to-end.
The real dataset has no structurally malformed records, so synthetic input is
the only way to prove the rejected layer works.

Run:  .venv/bin/python -m pytest tests/ -q
"""

from __future__ import annotations

import json
from collections import Counter

import pandas as pd
import pytest

from src.transformation import clean as clean_mod
from src.transformation import transform as transform_mod
from src.validation.validate import validate_record


# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

def make_record(**overrides) -> dict:
    record = {
        "_id": "uuid-1",
        "pid": "PID1",
        "url": "https://flipkart.com/x",
        "title": "Solid Men Blue T-Shirt",
        "description": "Comfortable cotton t-shirt",
        "category": "Clothing and Accessories",
        "sub_category": "Topwear",
        "brand": "York",
        "seller": "Shyam Enterprises",
        "actual_price": "2,999",
        "selling_price": "921",
        "discount": "69% off",
        "average_rating": "3.9",
        "out_of_stock": False,
        "crawled_at": "02/10/2021, 20:11:51",
        "images": ["https://img.example.com/a.jpg"],
        "product_details": [
            {"Fabric": "Cotton"},
            {"Ideal For": "Men"},
            {"Color": "Blue"},
        ],
    }
    record.update(overrides)
    return record


@pytest.fixture
def brand_map() -> tuple[dict, dict]:
    brands = Counter({"Black Beat": 560, "True Bl": 996, "York": 50, "V": 10})
    sellers = Counter({"Black Beatle": 560, "ArvindTrueBlue": 528, "York": 50})
    mapping, suspected = clean_mod.build_brand_map(
        brands, sellers, {"True Bl": "True Blue"}
    )
    return mapping, suspected


# ---------------------------------------------------------------------------
# Unit tests: cleaners
# ---------------------------------------------------------------------------

def test_clean_text_nbsp_and_whitespace():
    assert clean_mod.clean_text("Solid\u00a0Men\u00a0Blue  T-Shirt") == "Solid Men Blue T-Shirt"
    assert clean_mod.clean_text("   ") is None
    assert clean_mod.clean_text(None) is None


def test_parse_price():
    assert clean_mod.parse_price("2,999") == 2999.0
    assert clean_mod.parse_price("921") == 921.0
    assert clean_mod.parse_price("") is None
    assert clean_mod.parse_price("abc") is None
    assert clean_mod.parse_price("0") is None


def test_parse_discount():
    assert clean_mod.parse_discount_pct("69% off") == 69
    assert clean_mod.parse_discount_pct("") is None
    assert clean_mod.parse_discount_pct("off") is None
    assert clean_mod.parse_discount_pct("120% off") is None


def test_parse_rating():
    assert clean_mod.parse_rating("3.9") == 3.9
    assert clean_mod.parse_rating("") is None
    assert clean_mod.parse_rating("7.0") is None  # out of range
    assert clean_mod.parse_rating("n/a") is None


def test_parse_crawled_at():
    dt, date = clean_mod.parse_crawled_at("02/10/2021, 20:11:51")
    assert dt.year == 2021 and dt.month == 10 and dt.day == 2
    assert date == "2021-10-02"
    assert clean_mod.parse_crawled_at("garbage") == (None, None)


def test_clean_seller_tooltips():
    assert clean_mod.clean_seller("RetailNet") == "RetailNet"
    assert clean_mod.clean_seller("ArvindTrueBlue2.6Seller changed. Check for any changes in pricing and related informatio") == "ArvindTrueBlue"
    assert clean_mod.clean_seller("Marca Disati Stores(Not Enough Ratings)Seller changed. Check for any changes in pricing and related informatio") == "Marca Disati Stores"
    assert clean_mod.clean_seller("HUMANITY ORIGINALS(New Sell") == "HUMANITY ORIGINALS"
    assert clean_mod.clean_seller("") is None


def test_attr_key_canonicalization():
    assert clean_mod.clean_attr_key("Pack Of") == "Pack of"
    assert clean_mod.clean_attr_key("Pack of") == "Pack of"
    assert clean_mod.clean_attr_key("Care Instructions") == "Fabric Care"
    assert clean_mod.clean_attr_key("  ") == "Other Attribute"
    assert clean_mod.clean_attr_key("Fabric") == "Fabric"


def test_brand_map_expansion(brand_map):
    mapping, suspected = brand_map
    assert mapping["Black Beat"] == "Black Beatle"
    assert mapping["True Bl"] == "True Blue"  # override wins
    assert mapping.get("York") is None        # exact match is not an expansion
    assert suspected["Black Beat"] is True
    assert suspected["V"] is False            # too short to expand or suspect


# ---------------------------------------------------------------------------
# Unit tests: validation
# ---------------------------------------------------------------------------

def test_validate_rejects_non_dict():
    ok, reason, _ = validate_record(0, "not a dict")
    assert not ok and reason == "record is not a JSON object"


def test_validate_rejects_missing_pid():
    rec = make_record(pid="")
    ok, reason, _ = validate_record(0, rec)
    assert not ok and reason == "one or more required fields missing or empty"


def test_validate_rejects_bad_product_details():
    rec = make_record(product_details="oops")
    ok, reason, _ = validate_record(0, rec)
    assert not ok and reason == "product_details is not a JSON array"


def test_validate_soft_issues():
    rec = make_record(title="", images="not-a-list")
    ok, reason, soft = validate_record(0, rec)
    assert ok and reason is None
    assert "title_missing" in soft and "images_not_list" in soft


# ---------------------------------------------------------------------------
# Integration test: full pipeline on synthetic data (incl. rejected layer)
# ---------------------------------------------------------------------------

def _synthetic_records() -> list:
    records = [
        make_record(_id="u1", pid="PID1", brand="Black Beat", seller="Black Beatle"),
        make_record(_id="u2", pid="PID1", brand="Black Beat", seller="Black Beatle"),  # dup
        make_record(_id="u3", pid="PID2", seller="RetailNet4.5Seller changed. Check for any changes in pricing and related informatio"),
        make_record(_id="u4", pid="PID3", title="", description="", average_rating="", actual_price=""),
        make_record(_id="u5", pid="PID4", brand="True Bl"),
        "this is not a dict",
        make_record(_id="u6", pid=""),                       # missing pid
        make_record(_id="u7", pid="PID5", product_details="x"),  # bad nested type
    ]
    # Enough 'Black Beatle' seller listings to pass the corroboration floor,
    # exercising the data-driven brand expansion path end to end.
    for i in range(12):
        records.append(make_record(
            _id=f"b{i}", pid=f"PID10{i}",
            brand="Black Beat", seller="Black Beatle",
        ))
    return records


def test_pipeline_end_to_end(tmp_path, monkeypatch):
    import src.run as run_mod

    raw = tmp_path / "synthetic.json"
    raw.write_text(json.dumps(_synthetic_records(), indent=1))

    data_raw = tmp_path / "raw"
    data_proc = tmp_path / "processed"
    data_rej = tmp_path / "rejected"

    # Redirect every path the orchestrator uses (they are bound at import time).
    monkeypatch.setattr(run_mod, "RAW_SOURCE", raw)
    monkeypatch.setattr(run_mod, "RAW_LANDING", data_raw / "synthetic.json")
    monkeypatch.setattr(run_mod, "DATA_RAW", data_raw)
    monkeypatch.setattr(run_mod, "DATA_PROCESSED", data_proc)
    monkeypatch.setattr(run_mod, "DATA_REJECTED", data_rej)
    monkeypatch.setattr(run_mod, "REJECTED_JSONL", data_rej / "rejected_records.jsonl")
    monkeypatch.setattr(run_mod, "ETL_REPORT_JSON", data_proc / "etl_report.json")
    monkeypatch.setattr(run_mod, "ATTR_KEY_MAP_CSV", data_proc / "attribute_key_mapping.csv")
    monkeypatch.setattr(run_mod, "LISTINGS_STEM", "listings")
    monkeypatch.setattr(run_mod, "PRODUCTS_STEM", "products")
    monkeypatch.setattr(run_mod, "ATTRIBUTES_STEM", "product_attributes")

    report = run_mod.main()

    assert report["counts"]["extracted"] == 20
    assert report["counts"]["validated_ok"] == 17
    assert report["counts"]["rejected_total"] == 3
    assert report["counts"]["rejected_by_reason"] == {
        "record is not a JSON object": 1,
        "one or more required fields missing or empty": 1,
        "product_details is not a JSON array": 1,
    }
    assert report["counts"]["duplicate_product_rows_flagged"] == 1  # u2

    listings = pd.read_parquet(data_proc / "listings.parquet")
    products = pd.read_parquet(data_proc / "products.parquet")

    assert len(listings) == 17
    assert len(products) == 16
    assert int(listings["is_duplicate_product"].sum()) == 1

    # brand corrections applied
    u1 = listings[listings["listing_id"] == "u1"].iloc[0]
    assert u1["brand_canonical"] == "Black Beatle" and u1["brand_corrected"]
    u5 = listings[listings["listing_id"] == "u5"].iloc[0]
    assert u5["brand_canonical"] == "True Blue"

    # seller tooltip stripped
    u3 = listings[listings["listing_id"] == "u3"].iloc[0]
    assert u3["seller"] == "RetailNet"

    # missing-value sentinels became NULL
    u4 = listings[listings["listing_id"] == "u4"].iloc[0]
    assert pd.isna(u4["description"])
    assert pd.isna(u4["avg_rating"])
    assert pd.isna(u4["mrp"])
    assert u4["has_invalid_mrp"] is True or bool(u4["has_invalid_mrp"])
    assert u4["title_missing"] is True or bool(u4["title_missing"])

    # rejected file written with 3 records
    rejected_lines = (data_rej / "rejected_records.jsonl").read_text().strip().splitlines()
    assert len(rejected_lines) == 3
    reasons = [json.loads(line)["reason"] for line in rejected_lines]
    assert sorted(reasons) == sorted(report["counts"]["rejected_by_reason"])

    # attribute EAV + wide pivot
    attrs = pd.read_parquet(data_proc / "product_attributes.parquet")
    assert attrs["listing_id"].nunique() == 17
    assert "attr_fabric" in products.columns


def test_transform_record_effective_discount_and_gender():
    rec = make_record(pid="P", actual_price="1000", selling_price="700", discount="30% off")
    listing, attrs, pairs = transform_mod.transform_record(rec, {}, {}, [])
    assert listing["effective_discount_pct"] == 30
    assert listing["discount_pct"] == 30
    assert listing["gender"] == "Men"
    assert listing["gender_source"] == "ideal_for"
    assert listing["price_band"] == "mid"


def test_gender_fallback_from_title():
    label, source = transform_mod.derive_gender(None, "Women Kurta Set")
    assert label == "Women" and source == "title"
    label, source = transform_mod.derive_gender(None, "No gender info here")
    assert label == "Unknown" and source == "none"
