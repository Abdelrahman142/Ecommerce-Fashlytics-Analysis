"""One-off verification queries for suspicious findings in the profile.

Reads the raw JSON read-only, streams it, and prints targeted evidence for:
1. What duplicated `pid` rows look like (same title? different variant?).
2. Brand name truncation vs seller names.
3. The anomalous 'Toys' category record and empty product_details keys.
4. Records where average_rating is empty but a rating exists implicitly.
"""
import ijson
from collections import defaultdict
from pathlib import Path

RAW = Path("flipkart_fashion_products_dataset.json")

pid_rows = defaultdict(list)
brand_dupe_check = defaultdict(lambda: defaultdict(int))
toys = []
empty_key_attrs = []
rating_empty = []
style_share = defaultdict(list)

with open(RAW, "rb") as fh:
    for rec in ijson.items(fh, "item"):
        pid_rows[rec["pid"]].append({
            "title": rec["title"],
            "selling": rec["selling_price"],
            "actual": rec["actual_price"],
            "brand": rec["brand"],
            "size_attrs": [kv.get("Size") for kv in rec["product_details"] if "Size" in kv],
            "color_attrs": [kv.get("Color") for kv in rec["product_details"] if "Color" in kv],
        })
        brand_dupe_check[rec["brand"]][rec["seller"]] += 1
        if rec["category"] == "Toys":
            toys.append(rec)
        for kv in rec["product_details"]:
            for k in kv:
                if k.strip() == "":
                    empty_key_attrs.append((rec["pid"], repr(k), kv[k]))
        if rec["average_rating"] == "":
            rating_empty.append((rec["pid"], rec["title"]))

print("=== 1. Duplicated pid examples (first 4) ===")
shown = 0
for pid, rows in pid_rows.items():
    if len(rows) > 1:
        print(f"\npid={pid}  rows={len(rows)}")
        for r in rows[:8]:
            print("   ", r)
        shown += 1
        if shown == 4:
            break

print("\n=== 2. Brand vs seller evidence (brand values looking truncated) ===")
for brand in ["Black Beat", "Keo", "TOM BU", "True Bl", "ECKO Unl", "Free Authori", "ARBO", "REEB"]:
    sellers = brand_dupe_check.get(brand, {})
    print(f"brand={brand!r} -> sellers: {dict(sellers)}")

print("\n=== 3. The 'Toys' record ===")
for t in toys:
    print({k: v for k, v in t.items() if k != "url"})

print("\n=== 4. Empty product_details key examples (10) ===")
for pid, k, v in empty_key_attrs[:10]:
    print(f"pid={pid} key={k!r} value={v!r}")
