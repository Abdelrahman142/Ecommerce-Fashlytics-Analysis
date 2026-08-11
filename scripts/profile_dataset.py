"""Phase 1 — Dataset profiling for flipkart_fashion_products_dataset.json.

Streams the top-level JSON array one record at a time (ijson), so memory usage
stays roughly constant regardless of file size. Emits a machine-readable profile
artifact (JSON) plus a concise console summary.

Design decisions
----------------
- Streaming: the raw file is ~83 MB / ~1.97M lines. Loading the whole tree into
  memory would work today but does not scale; ijson gives O(1) memory.
- Raw data is never modified: the input file is opened read-only.
- Missing values: a field is "missing" when the key is absent AND when the value
  is JSON `null`; both are reported separately.
- High-cardinality strings are counted with bounded sets (HyperLogLog-style cap)
  to avoid unbounded memory growth from e.g. 200k distinct Style Codes.
- Numeric fields are decoded from their comma-formatted string form
  (actual_price, selling_price) and discount ("69% off") to validate the data,
  but the raw strings are what would feed downstream transformations.
"""

from __future__ import annotations

import argparse
import hashlib
import ijson
import json
import os
import statistics
from collections import Counter, defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
DEFAULT_INPUT = REPO_ROOT / "flipkart_fashion_products_dataset.json"
DEFAULT_OUTPUT = REPO_ROOT / "reports" / "profile_artifact.json"

# Bound for distinct-value tracking per high-cardinality key. When a key exceeds
# this, its count is reported as ">= CAP (high cardinality)".
SET_CAP = 200_000

TOP_LEVEL_FIELDS = [
    "_id", "actual_price", "average_rating", "brand", "category", "crawled_at",
    "description", "discount", "images", "out_of_stock", "pid",
    "product_details", "seller", "selling_price", "sub_category", "title", "url",
]

NUMERIC_KEYS = {"actual_price": "inr", "selling_price": "inr"}


def parse_int_compact(raw: str | None) -> float | None:
    """Parse a comma-formatted integer/float string like '2,999' or '921.50'.

    Returns None when the string is not a valid positive number.
    """
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_discount(raw: str | None) -> int | None:
    """Parse '69% off' into the integer percentage (0-100). None if malformed."""
    if raw is None:
        return None
    s = str(raw).strip()
    if s.endswith("% off"):
        num = s[:-len("% off")].strip()
        try:
            return int(num)
        except ValueError:
            return None
    return None


class BoundedCounter:
    """Distinct-value counter that degrades to 'CAP+' once SET_CAP is reached."""

    def __init__(self, cap: int = SET_CAP):
        self.cap = cap
        self._set: set[str] = set()
        self.hit_cap = False

    def add(self, value: str) -> None:
        if self.hit_cap:
            return
        if len(self._set) >= self.cap:
            self.hit_cap = True
            self._set.clear()
            self._set = None  # type: ignore[assignment]
            return
        self._set.add(value)

    @property
    def distinct(self) -> int:
        if self._set is None:
            return self.cap
        return len(self._set)

    @property
    def exact(self) -> bool:
        return self._set is not None


def profile_file(path: Path) -> dict:
    total = 0
    malformed_records = 0

    field_type_counter = {f: Counter() for f in TOP_LEVEL_FIELDS}
    field_missing = Counter()          # key absent or null
    field_null = Counter()             # explicit JSON null
    field_empty = Counter()            # "" or [] (present but empty)

    record_hashes: set[str] = set()
    pid_values = BoundedCounter()
    id_values = BoundedCounter()
    url_values = BoundedCounter()
    pid_dup_records = Counter()        # pid -> record count when seen >1

    text_lengths: dict[str, list[int]] = defaultdict(list)
    numeric_vals: dict[str, list[float]] = defaultdict(list)
    rating_vals: list[float] = []
    rating_invalid = Counter()
    discount_pct: list[int] = []
    discount_invalid = Counter()

    price_pairs: list[tuple[float, float | None]] = []   # (actual, selling)

    out_of_stock_counter = Counter()
    crawled_ok = 0
    crawled_bad = 0
    crawled_year_month = Counter()
    crawled_format_examples = []

    category_counter = Counter()
    sub_category_counter = Counter()
    brand_counter = Counter()
    seller_counter = Counter()
    category_by_sub = defaultdict(Counter)

    images_len: list[int] = []
    images_invalid = 0

    product_details_count: list[int] = []
    pd_key_counter = Counter()          # key -> # records containing it
    pd_key_value_counter: dict[str, BoundedCounter] = defaultdict(lambda: BoundedCounter(cap=50_000))
    pd_value_lengths: dict[str, list[int]] = defaultdict(list)

    samples: dict[str, list[str]] = defaultdict(list)
    samples_text: dict[str, list[str]] = defaultdict(list)

    bool_type_check = {"true": 0, "false": 0, "other": 0}

    with open(path, "rb") as fh:
        for record in ijson.items(fh, "item"):
            total += 1
            if not isinstance(record, dict):
                malformed_records += 1
                continue

            # ---- exact duplicate detection (whole record, value-level) ----
            rec_hash = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
            record_hashes.add(rec_hash)

            # ---- per-field handling ----
            for field in TOP_LEVEL_FIELDS:
                present = field in record
                val = record.get(field)
                if not present or val is None:
                    field_missing[field] += 1
                    if present:
                        field_null[field] += 1
                    continue

                vt = type(val).__name__
                field_type_counter[field][vt] += 1

                if vt == "str":
                    if val == "":
                        field_empty[field] += 1
                elif vt == "list" or vt == "dict":
                    if len(val) == 0:
                        field_empty[field] += 1

                if len(samples[field]) < 5:
                    samples[field].append(str(val)[:120])

            # _id / pid / url
            if record.get("_id") is not None:
                id_values.add(str(record["_id"]))
            if record.get("pid") is not None:
                pv = str(record["pid"])
                pid_values.add(pv)
                pid_dup_records[pv] += 1
            if record.get("url") is not None:
                url_values.add(str(record["url"]))

            # text fields
            for tf in ("title", "description"):
                v = record.get(tf)
                if isinstance(v, str):
                    text_lengths[tf].append(len(v))
                    if len(samples_text[tf]) < 5:
                        samples_text[tf].append(v[:160])

            # numeric price fields (raw string -> float)
            for nk, unit in NUMERIC_KEYS.items():
                raw = record.get(nk)
                if raw is None:
                    numeric_vals[nk].append(float("nan"))
                    continue
                parsed = parse_int_compact(str(raw))
                if parsed is None:
                    numeric_vals[nk].append(float("nan"))
                    field_type_counter[nk]["__invalid__"] += 1
                else:
                    numeric_vals[nk].append(parsed)

            # average_rating
            ar = record.get("average_rating")
            if ar is None:
                rating_vals.append(float("nan"))
            else:
                try:
                    f = float(str(ar))
                    rating_vals.append(f)
                    if not (0.0 <= f <= 5.0):
                        rating_invalid["out_of_range"] += 1
                    elif str(ar).strip() == "0":
                        rating_invalid["zero"] += 1
                except ValueError:
                    rating_vals.append(float("nan"))
                    rating_invalid["unparseable"] += 1

            # discount
            disc = record.get("discount")
            if disc is None:
                discount_invalid["missing"] += 1
            else:
                pct = parse_discount(str(disc))
                if pct is None:
                    discount_invalid["malformed"] += 1
                else:
                    discount_pct.append(pct)
                    if not (0 <= pct <= 100):
                        discount_invalid["out_of_range"] += 1

            # out_of_stock
            oos = record.get("out_of_stock")
            if isinstance(oos, bool):
                out_of_stock_counter[str(oos)] += 1
                bool_type_check["true" if oos else "false"] += 1
            elif oos is None:
                bool_type_check["other"] += 1
                out_of_stock_counter["<missing>"] += 1
            else:
                bool_type_check["other"] += 1
                out_of_stock_counter[f"<{type(oos).__name__}>"] += 1

            # crawled_at
            ca = record.get("crawled_at")
            if isinstance(ca, str) and ca.strip():
                crawled_ok += 1
                # format: "02/10/2021, 20:11:51" (DD/MM/YYYY, HH:MM:SS)
                crawled_year_month[ca[6:10] + "-" + ca[3:5]] += 1
            else:
                crawled_bad += 1
                if len(crawled_format_examples) < 5:
                    crawled_format_examples.append(str(ca))

            # images
            imgs = record.get("images")
            if isinstance(imgs, list):
                images_len.append(len(imgs))
            else:
                images_invalid += 1

            # product_details
            pds = record.get("product_details")
            if isinstance(pds, list):
                product_details_count.append(len(pds))
                for kv in pds:
                    if not isinstance(kv, dict):
                        continue
                    for k, v in kv.items():
                        k = str(k)
                        pd_key_counter[k] += 1
                        pd_key_value_counter[k].add(str(v))
                        pd_value_lengths[k].append(len(str(v)))
            elif pds is None:
                product_details_count.append(0)

            # categorical fields
            for cf in ("category", "sub_category", "brand", "seller"):
                v = record.get(cf)
                if isinstance(v, str) and v.strip():
                    counter = {
                        "category": category_counter,
                        "sub_category": sub_category_counter,
                        "brand": brand_counter,
                        "seller": seller_counter,
                    }[cf]
                    counter[v] += 1
            if record.get("category") and record.get("sub_category"):
                category_by_sub[str(record["category"])][str(record["sub_category"])] += 1

            # price pair for discount sanity check
            ap = parse_int_compact(str(record["actual_price"])) if record.get("actual_price") else None
            sp = parse_int_compact(str(record["selling_price"])) if record.get("selling_price") else None
            price_pairs.append((ap if ap is not None else float("nan"),
                                sp if sp is not None else float("nan")))

    # ---------- derived / computed aggregates ----------
    n = total

    def numeric_stats(vals: list[float]) -> dict:
        clean = [v for v in vals if v == v]  # drop NaN
        if not clean:
            return {"count": 0, "valid": 0}
        return {
            "count": len(vals),
            "valid": len(clean),
            "min": round(min(clean), 2),
            "max": round(max(clean), 2),
            "mean": round(statistics.mean(clean), 2),
            "median": round(statistics.median(clean), 2),
            "stdev": round(statistics.stdev(clean), 2) if len(clean) > 1 else 0.0,
            "p1": round(sorted(clean)[max(0, int(0.01 * len(clean)) - 1)], 2),
            "p99": round(sorted(clean)[min(len(clean) - 1, int(0.99 * len(clean)) - 1)], 2),
        }

    # discount consistency: selling_price should be ~ actual * (1 - pct/100)
    discount_checks = {"consistent": 0, "mismatch": 0, "unverifiable": 0,
                       "zero_or_negative_selling": 0}
    mismatch_examples = []
    for i, (ap, sp) in enumerate(price_pairs):
        pct = discount_pct[i] if i < len(discount_pct) else None
        if ap != ap or sp != sp or pct is None:
            discount_checks["unverifiable"] += 1
            continue
        if sp <= 0 or ap <= 0:
            discount_checks["zero_or_negative_selling"] += 1
        expected = round(ap * (1 - pct / 100.0), 2)
        if abs(expected - sp) > 1.0:
            discount_checks["mismatch"] += 1
            if len(mismatch_examples) < 5:
                mismatch_examples.append({"actual": ap, "selling": sp, "pct": pct,
                                          "expected": expected})
        else:
            discount_checks["consistent"] += 1

    dup_pids = sum(1 for cnt in pid_dup_records.values() if cnt > 1)
    total_dup_rows = sum(cnt - 1 for cnt in pid_dup_records.values() if cnt > 1)

    sub_by_cat = {cat: dict(cnt) for cat, cnt in sorted(category_by_sub.items())}

    pd_key_profile = {}
    for k, cnt in pd_key_counter.most_common():
        bc = pd_key_value_counter[k]
        lens = pd_value_lengths[k]
        pd_key_profile[k] = {
            "records_with_key": cnt,
            "distinct_values": bc.distinct,
            "exact": bc.exact,
            "value_len_min": min(lens) if lens else None,
            "value_len_max": max(lens) if lens else None,
        }

    profile = {
        "meta": {
            "input_file": path.name,
            "file_size_bytes": os.path.getsize(path),
            "file_size_mb": round(os.path.getsize(path) / 1e6, 2),
            "line_count": sum(1 for _ in open(path, "rb")),
            "profiler": os.path.basename(__file__),
            "json_structure": "top-level array of flat objects; two nested structures (images[], product_details[] of {key:value})",
        },
        "records": {
            "total_records": n,
            "malformed_records": malformed_records,
            "exact_duplicate_records": len(record_hashes),
            "exact_duplicate_count_vs_total": n - len(record_hashes),
            "distinct_pid": pid_values.distinct,
            "distinct_pid_exact": pid_values.exact,
            "pids_duplicated": dup_pids,
            "extra_rows_from_pid_dupes": total_dup_rows,
            "distinct_id": id_values.distinct,
            "distinct_id_exact": id_values.exact,
            "distinct_url": url_values.distinct,
            "distinct_url_exact": url_values.exact,
        },
        "fields": {},
        "text_lengths": {k: {"min": min(v), "max": max(v), "mean": round(statistics.mean(v), 1),
                             "count": len(v)} for k, v in text_lengths.items()},
        "images": {
            "records_with_images": len(images_len),
            "images_list_invalid": images_invalid,
            "len_min": min(images_len) if images_len else None,
            "len_max": max(images_len) if images_len else None,
            "len_mean": round(statistics.mean(images_len), 2) if images_len else None,
            "len_distribution": dict(Counter(images_len).most_common(10)),
        },
        "product_details": {
            "records_with_any": sum(1 for c in product_details_count if c > 0),
            "count_min": min(product_details_count) if product_details_count else None,
            "count_max": max(product_details_count) if product_details_count else None,
            "count_mean": round(statistics.mean(product_details_count), 2) if product_details_count else None,
            "keys_profile": pd_key_profile,
        },
        "numeric": {
            "actual_price": numeric_stats(numeric_vals["actual_price"]),
            "selling_price": numeric_stats(numeric_vals["selling_price"]),
            "average_rating": numeric_stats(rating_vals),
            "rating_invalid": dict(rating_invalid),
            "discount_pct": numeric_stats(discount_pct) if discount_pct else {"count": 0},
            "discount_invalid": dict(discount_invalid),
        },
        "discount_consistency": dict(discount_checks),
        "discount_mismatch_examples": mismatch_examples,
        "out_of_stock": dict(out_of_stock_counter),
        "crawled_at": {
            "parseable": crawled_ok,
            "not_parseable": crawled_bad,
            "sample_invalid": crawled_format_examples,
            "by_year_month": dict(sorted(crawled_year_month.items())),
        },
        "categorical": {
            "category": dict(category_counter.most_common(50)),
            "sub_category": dict(sub_category_counter.most_common(50)),
            "brand": dict(brand_counter.most_common(50)),
            "seller": dict(seller_counter.most_common(50)),
            "category_cardinality": len(category_counter),
            "sub_category_cardinality": len(sub_category_counter),
            "brand_cardinality": len(brand_counter),
            "seller_cardinality": len(seller_counter),
            "category_x_subcategory": sub_by_cat,
        },
        "samples": dict(samples),
        "samples_text": dict(samples_text),
    }

    # per-field presence/type profile
    for f in TOP_LEVEL_FIELDS:
        profile["fields"][f] = {
            "present": n - field_missing[f],
            "missing": field_missing[f],
            "explicit_null": field_null[f],
            "empty_string_or_list": field_empty[f],
            "types": dict(field_type_counter[f]),
        }

    return profile


def main() -> None:
    ap = argparse.ArgumentParser(description="Profile the Flipkart fashion JSON dataset.")
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = ap.parse_args()

    print(f"Profiling {args.input} ...")
    profile = profile_file(args.input)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(profile, indent=2, ensure_ascii=False))
    print(f"Profile artifact written to {args.output}")

    r = profile["records"]
    print("\n--- SUMMARY ---")
    print(f"records: {r['total_records']:,}   malformed: {r['malformed_records']}")
    print(f"distinct pid: {r['distinct_pid']:,}   distinct _id: {r['distinct_id']:,}   distinct url: {r['distinct_url']:,}")
    print(f"exact duplicate records (non-unique): {r['exact_duplicate_count_vs_total']:,}")
    print(f"duplicated pids: {r['pids_duplicated']:,}  (extra rows: {r['extra_rows_from_pid_dupes']:,})")
    for f in TOP_LEVEL_FIELDS:
        fld = profile["fields"][f]
        print(f"  {f:<18} present={fld['present']:>8,}  missing={fld['missing']:>8,}  null={fld['explicit_null']:>8,}  empty={fld['empty_string_or_list']:>8,}  types={fld['types']}")


if __name__ == "__main__":
    main()
