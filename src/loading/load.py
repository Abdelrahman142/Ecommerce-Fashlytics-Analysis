"""Load stage: write processed tables (Parquet + CSV), rejected records, and
the ETL report artifact.

Both Parquet (typed, columnar, primary) and CSV (portable, human-viewable)
are written for every processed table. List-typed columns are JSON-encoded in
the CSV representation.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from src.config import (
    ATTR_KEY_MAP_CSV,
    ATTRIBUTES_STEM,
    ETL_REPORT_JSON,
    LISTINGS_STEM,
    PRODUCTS_STEM,
    REJECTED_JSONL,
)


def _json_lists_for_csv(df: pd.DataFrame) -> pd.DataFrame:
    """JSON-encode object-typed list columns for lossless CSV output."""
    out = df.copy()
    for col in out.columns:
        sample = out[col].dropna()
        if len(sample) and isinstance(sample.iloc[0], list):
            out[col] = out[col].apply(lambda v: json.dumps(v) if isinstance(v, list) else v)
    return out


def write_table(df: pd.DataFrame, stem: Path) -> dict[str, int]:
    """Write a table to Parquet and CSV. Returns row/column counts."""
    stem.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(stem.with_suffix(".parquet"), index=False)
    _json_lists_for_csv(df).to_csv(stem.with_suffix(".csv"), index=False)
    return {"path": str(stem), "rows": int(len(df)), "columns": int(len(df.columns))}


def write_rejected(records: list[dict[str, Any]], path: Path) -> int:
    """Append rejected records as one JSON object per line."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False, default=str) + "\n")
    return len(records)


def write_report(report: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False, default=str))


def write_attr_key_map(df: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
