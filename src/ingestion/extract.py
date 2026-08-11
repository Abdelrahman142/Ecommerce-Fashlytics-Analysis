"""Extract stage: streaming reads from the immutable raw JSON file.

Uses ``ijson`` to iterate the top-level array one record at a time, so memory
usage stays roughly O(1) with respect to file size (the file is ~83 MB /
1.97M lines). The raw source is opened read-only and never modified.
"""

from __future__ import annotations

import ijson
from collections import Counter
from typing import Iterator
from pathlib import Path


def stream_records(path: Path) -> Iterator[tuple[int, object]]:
    """Yield ``(index, record)`` for every item in the top-level JSON array.

    ``index`` is the 0-based position in the array and is used for audit /
    rejection tracing.
    """
    with open(path, "rb") as fh:
        for index, record in enumerate(ijson.items(fh, "item")):
            yield index, record


def collect_brand_seller_counts(path: Path) -> tuple[Counter, Counter]:
    """Lightweight first pass collecting brand/seller value counts.

    This pass only needs two fields per record, but it still streams the file
    (it does not hold the records). Sellers are cleaned first so tooltip-polluted
    variants (e.g. 'X2.9Seller changed...') collapse onto their real seller and
    the brand canonicalization table is built on a clean vocabulary.
    """
    from src.transformation.clean import clean_seller

    brands: Counter = Counter()
    sellers: Counter = Counter()
    with open(path, "rb") as fh:
        for record in ijson.items(fh, "item"):
            if not isinstance(record, dict):
                continue
            b = record.get("brand")
            if isinstance(b, str) and b.strip():
                brands[b.strip()] += 1
            s = clean_seller(record.get("seller"))
            if s is not None:
                sellers[s] += 1
    return brands, sellers
