#!/usr/bin/env python3
"""Export the processed layer into the Fashlytics dev mock bundle.

Writes real, computed figures (no invented metrics) as static JSON under
fashlytics/public/mock/ so the frontend's API layer can serve realistic data
until it is pointed at the PostgreSQL-backed backend.

Usage:  .venv/bin/python scripts/export_dashboard_data.py
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA_PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "fashlytics" / "public" / "mock"

PRICE_EDGES = list(range(0, 4001, 100)) + [float("inf")]
RATING_EDGES = [i * 0.5 for i in range(11)]


def price_bin(price: float) -> str:
    if price is None or pd.isna(price):
        return "Unknown"
    for i in range(len(PRICE_EDGES) - 1):
        lo, hi = PRICE_EDGES[i], PRICE_EDGES[i + 1]
        if lo <= price < hi:
            return f"{lo}-{int(hi)}" if hi < float("inf") else f"{lo}+"
    return "4000+"


def rating_bucket(r: float) -> str:
    for i in range(len(RATING_EDGES) - 1):
        lo, hi = RATING_EDGES[i], RATING_EDGES[i + 1]
        if lo <= r < hi:
            return f"{lo:.1f}-{hi:.1f}"
    return "4.5-5.0"


def num(x) -> float | None:
    return None if x is None or (isinstance(x, float) and pd.isna(x)) else float(x)


def main() -> None:
    p = pd.read_parquet(DATA_PROCESSED / "products.parquet")
    l = pd.read_parquet(DATA_PROCESSED / "listings.parquet")
    a = pd.read_parquet(DATA_PROCESSED / "product_attributes.parquet")
    qr = json.loads((DATA_PROCESSED / "quality_report.json").read_text())
    etl = json.loads((DATA_PROCESSED / "etl_report.json").read_text())

    OUT.mkdir(parents=True, exist_ok=True)
    rnd = lambda v: round(float(v), 2) if v is not None and not pd.isna(v) else None  # noqa: E731

    # --------------------------------------------------------------- meta
    snap_dates = sorted(p["snapshot_date"].dropna().unique().tolist())
    meta = {
        "product": "Fashlytics",
        "currency": "INR",
        "currency_symbol": "₹",
        "snapshot_start": snap_dates[0],
        "snapshot_end": snap_dates[-1],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "data/processed · flipkart_fashion_products_dataset.json",
        "data_layer": "mock-static (dev)",
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=1))

    # ---------------------------------------------------------- overview
    rated = p[p["has_rating"]]
    selling = p["selling_price"].dropna()
    kpis = {
        "total_products": int(len(p)),
        "brands": int(p["brand_canonical"].dropna().nunique()),
        "categories": int(p["sub_category"].nunique()),
        "avg_price": rnd(selling.mean()),
        "median_price": rnd(selling.median()),
        "avg_rating": rnd(rated["avg_rating"].mean()),
        "avg_discount_pct": rnd(p["effective_discount_pct"].mean()),
        "rating_coverage_pct": rnd(p["has_rating"].mean() * 100),
        "products_rated": int(rated.shape[0]),
        "out_of_stock": int(p["any_out_of_stock"].sum()),
        "in_stock": int((~p["any_out_of_stock"]).sum()),
        "snapshot_dates": snap_dates,
    }

    cat_rows = (
        p.groupby("sub_category")
        .agg(count=("product_id", "size"),
             avg_price=("selling_price", "mean"),
             avg_rating=("avg_rating", "mean"))
        .reset_index()
        .rename(columns={"sub_category": "name"})
    )
    cat_rows["avg_price"] = cat_rows["avg_price"].map(rnd)
    cat_rows["avg_rating"] = cat_rows["avg_rating"].map(rnd)
    category_dist = cat_rows.sort_values("count", ascending=False).to_dict("records")

    brand_rows = (
        p[p["brand_canonical"].notna()]
        .groupby("brand_canonical")
        .agg(count=("product_id", "size"),
             avg_price=("selling_price", "mean"),
             avg_rating=("avg_rating", "mean"))
        .reset_index()
        .rename(columns={"brand_canonical": "brand"})
    )
    brand_rows["avg_price"] = brand_rows["avg_price"].map(rnd)
    brand_rows["avg_rating"] = brand_rows["avg_rating"].map(rnd)
    top_brands = (brand_rows.sort_values("count", ascending=False)
                  .head(12).to_dict("records"))

    price_hist = [
        {"bin": price_bin(lo), "count": int(
            ((selling >= lo) & (selling < (next_edge if next_edge < float("inf") else float("inf")))).sum()
            if next_edge < float("inf") else (selling >= lo).sum())}
        for lo, next_edge in zip(PRICE_EDGES[:-1], PRICE_EDGES[1:])
    ]
    rating_dist = [
        {"bin": rating_bucket(lo), "count": int(
            ((rated["avg_rating"] >= lo) & (rated["avg_rating"] < hi)).sum()
            if hi <= 5.0 else (rated["avg_rating"] == 5.0).sum())}
        for lo, hi in zip(RATING_EDGES[:-1], RATING_EDGES[1:])
    ]
    price_bands = (p["price_band"].value_counts()
                   .rename_axis("band").reset_index(name="count").to_dict("records"))
    rating_buckets = (p["rating_bucket"].value_counts()
                      .rename_axis("band").reset_index(name="count").to_dict("records"))
    gender_dist = (p["gender"].value_counts()
                   .rename_axis("name").reset_index(name="count").to_dict("records"))
    availability = [
        {"name": "In stock", "count": int((~p["any_out_of_stock"]).sum())},
        {"name": "Out of stock", "count": int(p["any_out_of_stock"].sum())},
    ]

    overview = {
        "kpis": kpis,
        "category_dist": category_dist,
        "top_brands": top_brands,
        "price_hist": price_hist,
        "rating_dist": rating_dist,
        "price_bands": price_bands,
        "rating_buckets": rating_buckets,
        "gender_dist": gender_dist,
        "availability": availability,
    }
    (OUT / "overview.json").write_text(json.dumps(overview, indent=1))

    # ---------------------------------------------------------- products
    attr_by_pid: dict[str, list[dict]] = defaultdict(list)
    for pid, k, v in a[a["attr_value"].notna()][["product_id", "attr_key", "attr_value"]].itertuples(index=False):
        attr_by_pid[pid].append({"k": str(k), "v": str(v)})
        if len(attr_by_pid[pid]) >= 4:
            continue
    for pid in attr_by_pid:
        attr_by_pid[pid] = attr_by_pid[pid][:4]

    items = []
    for row in p.itertuples(index=False):
        pid = row.product_id
        rating = num(getattr(row, "avg_rating"))
        items.append({
            "id": pid,
            "t": str(getattr(row, "title")),
            "b": str(getattr(row, "brand_canonical") or getattr(row, "brand") or "Unknown"),
            "c": str(getattr(row, "sub_category")),
            "tcat": str(getattr(row, "category")),
            "g": str(getattr(row, "gender")),
            "p": rnd(getattr(row, "selling_price")),
            "m": rnd(getattr(row, "mrp")),
            "d": rnd(getattr(row, "discount_pct")),
            "ed": rnd(getattr(row, "effective_discount_pct")),
            "r": rating,
            "ha": bool(getattr(row, "has_rating")),
            "pb": str(getattr(row, "price_band")),
            "rb": str(getattr(row, "rating_bucket")),
            "av": bool(not getattr(row, "any_out_of_stock")),
            "img": str(getattr(row, "primary_image") or ""),
            "na": int(getattr(row, "n_attributes") or 0),
            "ic": int(getattr(row, "image_count") or 0),
            "pk": num(getattr(row, "pack_of")),
            "s": str(getattr(row, "seller") or ""),
            "u": str(getattr(row, "url") or ""),
            "desc": str(getattr(row, "description") or ""),
            "at": attr_by_pid.get(pid, []),
        })

    (OUT / "products.json").write_text(json.dumps({"count": len(items), "items": items}))

    # ------------------------------------------------------------ brands
    brand_items = []
    for row in brand_rows.itertuples(index=False):
        name = row.brand
        mask = p["brand_canonical"] == name
        cats = (p.loc[mask, "sub_category"].value_counts()
                .head(5).rename_axis("category").reset_index(name="count")
                .to_dict("records"))
        brand_items.append({
            "brand": name,
            "products": int(row.count),
            "avg_price": rnd(row.avg_price),
            "avg_rating": rnd(row.avg_rating),
            "corrected": int(p.loc[mask, "brand_corrected"].sum()),
            "suspected_truncated": int(p.loc[mask, "brand_suspected_truncated"].sum()),
            "categories": cats,
        })

    (OUT / "brands.json").write_text(json.dumps({
        "count": len(brand_items),
        "items": brand_items,
    }))

    # --------------------------------------------------------- categories
    cat_items = []
    for row in cat_rows.itertuples(index=False):
        mask = p["sub_category"] == row.name
        sub = int(row.count)
        selling_c = p.loc[mask, "selling_price"].dropna()
        hist = [
            {"bin": price_bin(lo), "count": int(
                ((selling_c >= lo) & (selling_c < hi)).sum() if hi < float("inf")
                else (selling_c >= lo).sum())}
            for lo, hi in zip(PRICE_EDGES[:-1], PRICE_EDGES[1:])
        ]
        topb = (p.loc[mask, "brand_canonical"].dropna().value_counts().head(5)
                .rename_axis("brand").reset_index(name="count").to_dict("records"))
        cat_items.append({
            "name": row.name,
            "products": sub,
            "avg_price": rnd(p.loc[mask, "selling_price"].mean()),
            "median_price": rnd(selling_c.median()),
            "avg_rating": rnd(p.loc[mask, "avg_rating"].mean()),
            "rating_coverage_pct": rnd(p.loc[mask, "has_rating"].mean() * 100),
            "price_hist": hist,
            "top_brands": topb,
        })

    (OUT / "categories.json").write_text(json.dumps({
        "count": len(cat_items),
        "items": sorted(cat_items, key=lambda x: -x["products"]),
    }))

    top20 = [b["brand"] for b in sorted(brand_items, key=lambda x: -x["products"])[:20]]
    top_cats = [c["name"] for c in cat_items[:12]]
    matrix = [[
        int(((p["brand_canonical"] == b) & (p["sub_category"] == c)).sum())
        for c in top_cats
    ] for b in top20]
    (OUT / "brands.json").write_text(json.dumps({
        "count": len(brand_items),
        "items": brand_items,
        "matrix": {"brands": top20, "categories": top_cats, "counts": matrix},
    }))

    # ------------------------------------------------------------ quality
    checks = []
    for c in qr["checks"]:
        if c["status"] == "INFO":
            continue
        metric = c["metric"]
        affected = metric if isinstance(metric, int) and metric > 0 else (
            metric.get("mrp", 0) if isinstance(metric, dict) else 0)
        checks.append({
            "check_id": c["check_id"],
            "title": c["title"],
            "category": c["category"],
            "status": c["status"],
            "records_affected": affected,
            "detail": c["detail"],
        })

    n_warn = qr["summary"]["by_status"].get("WARN", 0)
    n_fail = qr["summary"]["by_status"].get("FAIL", 0)
    n_pass = qr["summary"]["by_status"].get("PASS", 0)
    n_info = qr["summary"]["by_status"].get("INFO", 0)
    total_checks = n_pass + n_warn + n_fail + n_info
    score = round(100 * (n_pass + 0.75 * n_warn + n_info) / total_checks, 1)

    missing = {
        "description": int(p["description"].isna().sum()),
        "primary_image": int(p["primary_image"].isna().sum()),
        "avg_rating": int(p["avg_rating"].isna().sum()),
        "brand": int(p["brand"].isna().sum()),
        "mrp": int(p["mrp"].isna().sum()),
        "selling_price": int(p["selling_price"].isna().sum()),
    }
    dup_products = int(p["product_id"].duplicated().sum())
    dup_listings = int(l[["product_id"]].duplicated().sum())
    dup_attrs = int(len(a) - a[["product_id", "attr_key", "attr_value"]].drop_duplicates().shape[0])

    quality = {
        "score": score,
        "score_formula": "weighted: PASS=1, WARN=0.75, INFO=1, FAIL=0",
        "checks_total": total_checks,
        "checks_by_status": {k: qr["summary"]["by_status"].get(k, 0)
                             for k in ("PASS", "WARN", "FAIL", "INFO")},
        "totals": {
            "products": int(len(p)),
            "listings": int(len(l)),
            "attributes": int(len(a)),
        },
        "valid_records": int(len(p)),
        "invalid_records": int(etl.get("counts", {}).get("rejected", 0)),
        "duplicate_records": dup_products + dup_listings + dup_attrs,
        "missing_values": missing,
        "freshness": {
            "snapshot_start": snap_dates[0],
            "snapshot_end": snap_dates[-1],
            "generated_at": meta["generated_at"],
        },
        "checks": checks,
    }
    (OUT / "quality.json").write_text(json.dumps(quality, indent=1))

    print(f"wrote {OUT}")
    print(f"products={len(items)} brands={len(brand_items)} "
          f"categories={len(cat_items)} checks={len(checks)} score={score}")


if __name__ == "__main__":
    main()
