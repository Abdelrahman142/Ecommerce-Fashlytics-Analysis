"""Validate stage: structural validation of each raw record.

Two severity levels:
- Hard rejection: the record cannot be processed at all (wrong container type,
  missing required identifiers, structurally invalid nested fields). These are
  routed to data/rejected/ and are NOT loaded.
- Soft issues: the record is loadable but carries dirty/missing values. Soft
  issues never drop a record; they are surfaced as boolean flag columns on the
  listings output and counted in the ETL report.
"""

from __future__ import annotations

from src.config import REQUIRED_FIELDS

HARD_REJECT_REASONS = {
    "not_a_dict": "record is not a JSON object",
    "missing_required_field": "one or more required fields missing or empty",
    "product_details_not_list": "product_details is not a JSON array",
}


def validate_record(index: int, record: object) -> tuple[bool, str | None, list[str]]:
    """Return ``(ok, rejection_reason, soft_issues)`` for a raw record.

    ``ok=False`` means the record is rejected and must not be loaded.
    ``soft_issues`` is a list of human-readable issue descriptions used to set
    flag columns downstream.
    """
    soft: list[str] = []

    if not isinstance(record, dict):
        return False, HARD_REJECT_REASONS["not_a_dict"], soft

    # Required identifiers: hard reject when a critical field is absent or empty.
    for field in REQUIRED_FIELDS:
        value = record.get(field)
        if field in ("_id", "pid", "category"):
            if not isinstance(value, str) or not value.strip():
                return False, HARD_REJECT_REASONS["missing_required_field"], soft
        elif field == "product_details":
            if not isinstance(value, list):
                return False, HARD_REJECT_REASONS["product_details_not_list"], soft

    # Soft structural checks (values preserved, issues flagged).
    if "title" not in record or not isinstance(record.get("title"), str) or not record["title"].strip():
        soft.append("title_missing")
    if not isinstance(record.get("images"), list):
        soft.append("images_not_list")
    if not isinstance(record.get("out_of_stock"), bool):
        soft.append("out_of_stock_not_bool")
    if not isinstance(record.get("crawled_at"), str) or not record["crawled_at"].strip():
        soft.append("crawled_at_missing")

    return True, None, soft
