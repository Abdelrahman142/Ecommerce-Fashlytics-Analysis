"""Render the Phase 9 data-quality report as JSON and Markdown."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone

from src.quality.checks import CheckResult

STATUS_ORDER = ["PASS", "WARN", "FAIL", "INFO"]
CATEGORY_ORDER = [
    "Nulls", "Duplicates", "Prices", "Ratings", "Categories",
    "Brands", "IDs", "Types",
]


def _fmt(v) -> str:
    if isinstance(v, list):
        return ", ".join(str(x) for x in v)
    if isinstance(v, dict):
        return "; ".join(f"{k}={v[k]}" for k in sorted(v))
    return str(v)


def build_report(results: list[CheckResult], meta: dict) -> dict:
    by_status = Counter(r.status for r in results)
    by_category = defaultdict(lambda: Counter())
    for r in results:
        by_category[r.category][r.status] += 1

    return {
        "meta": meta,
        "summary": {
            "total_checks": len(results),
            "by_status": dict(by_status),
            "by_category": {c: dict(by_category[c]) for c in CATEGORY_ORDER
                            if c in by_category},
        },
        "checks": [r.as_dict() for r in results],
    }


def render_markdown(report: dict) -> str:
    meta = report["meta"]
    summary = report["summary"]
    lines: list[str] = [
        "# Data Quality Report",
        "",
        f"Generated: **{meta['generated_at']}**  ·  Source: "
        f"`{meta['source']}`  ·  Run: `{meta['command']}`",
        "",
        "| Layer | Rows |",
        "|---|---|",
        f"| listings | {meta['rows']['listings']:,} |",
        f"| products | {meta['rows']['products']:,} |",
        f"| product_attributes | {meta['rows']['attributes']:,} |",
        "",
        "## Summary",
        "",
        f"**{summary['total_checks']} checks** executed.",
        "",
        "| Status | Count |",
        "|---|---|",
    ]
    for s in STATUS_ORDER:
        lines.append(f"| {s} | {summary['by_status'].get(s, 0)} |")
    lines.append("")

    lines += ["### Results by category", "", "| Category | PASS | WARN | FAIL | INFO |", "|---|---|---|---|---|"]
    for cat in CATEGORY_ORDER:
        if cat in summary["by_category"]:
            c = summary["by_category"][cat]
            lines.append(
                f"| {cat} | {c.get('PASS', 0)} | {c.get('WARN', 0)} | "
                f"{c.get('FAIL', 0)} | {c.get('INFO', 0)} |"
            )
    lines.append("")

    lines += ["## Check details", ""]
    for r in report["checks"]:
        icon = {"PASS": "✅", "WARN": "⚠️", "FAIL": "❌", "INFO": "ℹ️"}[r["status"]]
        lines.append(f"- **`{r['check_id']}`** [{r['status']}] {icon} {r['title']}")
        lines.append(f"  - metric: `{_fmt(r['metric'])}`")
        lines.append(f"  - {r['detail']}")
    lines.append("")
    return "\n".join(lines)


def render_json(report: dict) -> str:
    import json

    return json.dumps(report, indent=2, ensure_ascii=False, default=str)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
