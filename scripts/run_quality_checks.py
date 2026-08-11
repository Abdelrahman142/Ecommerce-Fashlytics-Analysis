#!/usr/bin/env python3
"""Phase 9 entry point — run data-quality checks on the processed layer.

Writes:
  data/processed/quality_report.json   (machine-readable)
  docs/data_quality.md                 (human-readable)

Usage:  .venv/bin/python scripts/run_quality_checks.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd  # noqa: E402

from src.config import DATA_PROCESSED, LISTINGS_STEM, PRODUCTS_STEM, ATTRIBUTES_STEM  # noqa: E402
from src.quality import build_report, render_json, render_markdown, run_checks  # noqa: E402
from src.quality.report import now_iso  # noqa: E402


def main() -> None:
    products = pd.read_parquet(DATA_PROCESSED / f"{PRODUCTS_STEM}.parquet")
    listings = pd.read_parquet(DATA_PROCESSED / f"{LISTINGS_STEM}.parquet")
    attributes = pd.read_parquet(DATA_PROCESSED / f"{ATTRIBUTES_STEM}.parquet")

    results = run_checks(products, listings, attributes)

    meta = {
        "generated_at": now_iso(),
        "source": "data/processed (products.parquet, listings.parquet, "
                  "product_attributes.parquet)",
        "command": "scripts/run_quality_checks.py",
        "rows": {
            "products": len(products),
            "listings": len(listings),
            "attributes": len(attributes),
        },
    }
    report = build_report(results, meta)

    out_json = DATA_PROCESSED / "quality_report.json"
    out_md = Path(__file__).resolve().parent.parent / "docs" / "data_quality.md"
    out_json.write_text(render_json(report))
    out_md.write_text(render_markdown(report))

    s = report["summary"]["by_status"]
    print(f"{s.get('FAIL', 0)} FAIL · {s.get('WARN', 0)} WARN · "
          f"{s.get('PASS', 0)} PASS · {s.get('INFO', 0)} INFO  "
          f"(of {report['summary']['total_checks']} checks)")
    print(f"wrote {out_json}")
    print(f"wrote {out_md}")

    if s.get("FAIL", 0):
        sys.exit(1)


if __name__ == "__main__":
    main()
