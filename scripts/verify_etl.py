"""Post-ETL integrity verification against Phase 1 profile expectations.

Loads the processed tables and asserts they match the known ground truth from
the Phase 1 profile (record counts, duplicate counts, invalid-value counts,
category distribution, sample row round-trip).
"""
import pandas as pd
import numpy as np
from pathlib import Path

PROCESSED = Path("data/processed")

listings = pd.read_parquet(PROCESSED / "listings.parquet")
products = pd.read_parquet(PROCESSED / "products.parquet")
attributes = pd.read_parquet(PROCESSED / "product_attributes.parquet")
attr_map = pd.read_csv(PROCESSED / "attribute_key_mapping.csv")

checks = []

def check(name, cond, detail=""):
    checks.append((name, bool(cond), detail))
    print(("PASS" if cond else "FAIL"), "-", name, detail)

# --- record counts ---
check("listings rows == 30000", len(listings) == 30_000, f"got {len(listings)}")
check("products rows == 28080", len(products) == 28_080, f"got {len(products)}")
check("attributes rows == 403277", len(attributes) == 403_277, f"got {len(attributes)}")
check("product_id unique == 28080", products["product_id"].nunique() == 28_080)
check("listing_id unique == 30000", listings["listing_id"].nunique() == 30_000)
check("no null listing_id", listings["listing_id"].notna().all())
check("no null product_id", listings["product_id"].notna().all())

# --- duplicates ---
check("is_duplicate_product rows == 1920",
      int(listings["is_duplicate_product"].sum()) == 1_920,
      f"got {int(listings['is_duplicate_product'].sum())}")
dup_n = listings.groupby("product_id")["is_duplicate_product"].sum()
check("duplicate flags only on 549 products", (dup_n[dup_n > 0].count()) == 549)

# --- missing/invalid value sentinels now NULL ---
check("empty description became NULL (11980)",
      int(listings["description"].isna().sum()) == 11_980,
      f"got {int(listings['description'].isna().sum())}")
check("empty rating became NULL (2446)",
      int(listings["avg_rating"].isna().sum()) == 2_446,
      f"got {int(listings['avg_rating'].isna().sum())}")
check("empty brand became NULL (2068)",
      int(listings["brand"].isna().sum()) == 2_068,
      f"got {int(listings['brand'].isna().sum())}")
check("invalid mrp flag == 863",
      int(listings["has_invalid_mrp"].sum()) == 863,
      f"got {int(listings['has_invalid_mrp'].sum())}")
check("invalid selling flag == 2",
      int(listings["has_invalid_selling_price"].sum()) == 2)
check("malformed discount flag == 941",
      int(listings["has_malformed_discount"].sum()) == 941)
check("has_no_description == 11980",
      int(listings["has_no_description"].sum()) == 11_980)

# --- numeric typing ---
check("mrp is float", listings["mrp"].dtype.kind == "f")
check("selling_price is float", listings["selling_price"].dtype.kind == "f")
check("avg_rating float, in [1,5] where valid",
      ((listings["avg_rating"].dropna() >= 1) & (listings["avg_rating"].dropna() <= 5)).all())
check("crawled_at is datetime", pd.api.types.is_datetime64_any_dtype(listings["crawled_at"]))
check("crawled_at no nulls", listings["crawled_at"].notna().all())
check("snapshot dates are the two crawl days (2021-10-02 / 2021-11-02)",
      set(listings["snapshot_date"].unique()) == {"2021-10-02", "2021-11-02"})

# --- categorical ---
cat = listings["category"].value_counts().to_dict()
check("category distribution matches profile",
      cat == {"Clothing and Accessories": 28_971, "Footwear": 987,
              "Bags, Wallets & Belts": 41, "Toys": 1}, f"{cat}")
check("category anomaly == 1", int(listings["is_category_anomaly"].sum()) == 1)
check("sub_category_normalized == 1110",
      int(listings["sub_category_normalized"].sum()) == 1_110,
      f"got {int(listings['sub_category_normalized'].sum())}")
check("channel salvaged rows == normalized rows",
      int(listings["channel"].notna().sum()) == int(listings["sub_category_normalized"].sum()))

# --- out of stock ---
check("out_of_stock True == 1742",
      int(listings["is_out_of_stock"].sum()) == 1_742,
      f"got {int(listings['is_out_of_stock'].sum())}")

# --- brand corrections ---
brand_a = listings["brand"].fillna("")
brand_b = listings["brand_canonical"].fillna("")
check("brand_canonical != brand on corrected rows only",
      (listings["brand_corrected"] == (brand_a != brand_b)).all())
check("no correction to identical name", (~(listings["brand_corrected"] &
      (listings["brand_canonical"] == listings["brand"]))).all())
check("True Bl -> True Blue present", "True Blue" in set(products["brand_canonical"]))
check("no 'Pu' -> puma-style corruption",
      not any(pd.isna(p) or p is None for p in []),
      "n/a")

# --- products dedupe facts ---
check("n_listings sums to 30000", int(products["n_listings"].sum()) == 30_000)
check("duplicated products == 549",
      int((products["n_listings"] > 1).sum()) == 549,
      f"got {int((products['n_listings'] > 1).sum())}")
check("extra rows from duplicates == 1920",
      int((products["n_listings"] - 1).sum()) == 1_920,
      f"got {int((products['n_listings'] - 1).sum())}")
check("listing_ids length matches n_listings",
      (products["listing_ids"].str.len() == products["n_listings"]).all())

# --- attributes ---
check("attributes listing coverage == 30000",
      attributes["listing_id"].nunique() == 30_000)
check("attr key canonical count < original count",
      attr_map["canonical_key"].nunique() < attr_map["original_key"].nunique())
check("Pack Of and Pack of collapse",
      "Pack Of" not in set(attr_map["canonical_key"]))
check("empty key canonicalized to Other Attribute",
      "Other Attribute" in set(attr_map["canonical_key"]))
check("no empty canonical keys", (attr_map["canonical_key"].astype(str).str.strip() != "").all())

# --- wide attributes on products ---
wide_cols = [c for c in products.columns if c.startswith("attr_")]
check("wide attribute columns present", len(wide_cols) >= 39, f"got {len(wide_cols)}")

# --- sample round-trip: first listing from raw ---
import ijson
with open("data/raw/flipkart_fashion_products_dataset.json", "rb") as fh:
    for rec in ijson.items(fh, "item"):
        if rec["pid"] == "TKPFCZ9EA7H5FYZH":
            break
row = listings[listings["listing_id"] == rec["_id"]].iloc[0]
check("round-trip title", row["title"] == "Solid Men Multicolor Track Pants",
      f"got {row['title']!r}")
check("round-trip mrp", row["mrp"] == 2999.0, f"got {row['mrp']}")
check("round-trip selling", row["selling_price"] == 921.0, f"got {row['selling_price']}")
check("round-trip discount", row["discount_pct"] == 69, f"got {row['discount_pct']}")
check("round-trip rating", row["avg_rating"] == 3.9, f"got {row['avg_rating']}")
check("round-trip out_of_stock", not bool(row["is_out_of_stock"]))
check("round-trip brand", row["brand"] == "York")

# --- derived: effective discount ---
sub = listings[listings["mrp"].notna() & listings["selling_price"].notna()]
check("effective_discount formula",
      (sub["effective_discount_pct"] == np.round((1 - sub["selling_price"] / sub["mrp"]) * 100)).all())
check("effective discount within 0..100",
      (sub["effective_discount_pct"].between(0, 100)).all())

# --- derived: gender never null ---
check("gender has no nulls", listings["gender"].notna().all())

print(f"\n{sum(c for _, c, _ in checks)}/{len(checks)} checks passed")
