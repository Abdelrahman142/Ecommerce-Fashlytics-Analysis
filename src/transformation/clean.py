"""Clean stage: per-field cleaning and normalization of a single record.

All cleaners are pure functions operating on the raw field values. Nothing here
reads or writes the raw file; the original record is never modified — the
cleaning stage produces a *new* dictionary.

Design notes
------------
- Missing-value sentinels in the source are empty strings / empty lists (never
  JSON null). Cleaners return None for those, which the transform stage turns
  into SQL NULLs.
- Any value that cannot be parsed is set to None and a soft issue is recorded
  (never silently guessed).
- Brand canonicalization is data-driven: truncated brand names are expanded by
  prefix-matching against the seller names observed in the same dataset, with a
  small evidence-based override table for cases prefix matching cannot find.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from typing import Iterator

from src.config import (
    ATTR_KEY_CANONICAL,
    BRAND_OVERRIDES,
    MIN_TRUNCATION_CANDIDATE_LEN,
)

# ---------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------

def clean_text(value: object) -> str | None:
    """Normalize a text field: NBSP -> space, strip, collapse whitespace.

    Returns None for empty/whitespace-only input (missing-value sentinel).
    """
    if not isinstance(value, str):
        return None
    s = value.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s if s else None


# ---------------------------------------------------------------------------
# Numeric / datetime parsing
# ---------------------------------------------------------------------------

def parse_price(value: object) -> float | None:
    """Parse a comma-formatted rupee string like '2,999' or '921'.

    Returns None when unparseable, empty, or non-positive.
    """
    s = clean_text(value)
    if s is None:
        return None
    s = s.replace(",", "").replace("₹", "").strip()
    try:
        num = float(s)
    except ValueError:
        return None
    return num if num > 0 else None


def parse_discount_pct(value: object) -> int | None:
    """Parse a 'NN% off' string into an integer percentage 0-100."""
    s = clean_text(value)
    if s is None:
        return None
    m = re.match(r"^(\d{1,3})\s*%", s)
    if not m:
        return None
    pct = int(m.group(1))
    return pct if 0 <= pct <= 100 else None


def parse_rating(value: object) -> float | None:
    """Parse an average rating into a float in [0, 5]. None if invalid."""
    s = clean_text(value)
    if s is None:
        return None
    try:
        rating = float(s)
    except ValueError:
        return None
    return rating if 0.0 <= rating <= 5.0 else None


_CRAWLED_RE = re.compile(r"^(\d{2})/(\d{2})/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})$")


def parse_crawled_at(value: object) -> tuple[datetime | None, str | None]:
    """Parse 'DD/MM/YYYY, HH:MM:SS' -> (datetime, 'YYYY-MM-DD' snapshot date)."""
    s = clean_text(value)
    if s is None:
        return None, None
    m = _CRAWLED_RE.match(s)
    if not m:
        return None, None
    try:
        dt = datetime(
            int(m.group(3)), int(m.group(2)), int(m.group(1)),
            int(m.group(4)), int(m.group(5)), int(m.group(6)),
        )
    except ValueError:
        return None, None
    return dt, dt.strftime("%Y-%m-%d")


# ---------------------------------------------------------------------------
# Seller / brand cleaning
# ---------------------------------------------------------------------------

_SELLER_TOOLTIP_RE = re.compile(r"(\d+\.\d+\s*)?Seller changed.*$", re.IGNORECASE)
_SELLER_NOTE_RE = re.compile(r"\s*\(\s*(?:New Sell|Not Enough Ratings?)[^)]*\)?\s*$", re.IGNORECASE)


def clean_seller(value: object) -> str | None:
    """Clean seller names, stripping scraped UI tooltip pollution.

    Observed pollution (Phase 1 section 9.2):
      'ArvindTrueBlue2.6Seller changed. Check for any changes in pricing...'
      'Marca Disati Stores(Not Enough Ratings)Seller changed...'
      'HUMANITY ORIGINALS(New Sell'   (truncated UI note)
    All of these are live-updating UI snippets captured into the seller field.
    """
    s = clean_text(value)
    if s is None:
        return None
    s = _SELLER_TOOLTIP_RE.sub("", s)
    s = _SELLER_NOTE_RE.sub("", s).strip()
    return s if s else None


def _norm(value: str) -> str:
    """Lowercase and remove spaces/underscores for prefix comparison."""
    return re.sub(r"[\s_]+", "", value).lower()


def build_brand_map(
    brand_counts: Counter, seller_counts: Counter, overrides: dict[str, str]
) -> tuple[dict[str, str], dict[str, bool]]:
    """Build brand -> canonical brand mapping from observed data.

    Strategy (data-driven, no external dictionaries):
      1. The reference vocabulary is the set of *seller* names (cleaned). Sellers
         are a more complete spelling source than the (truncated) brand field.
         Brand values are deliberately NOT used as candidates so truncation does
         not propagate (e.g. 'REEB' -> 'REEBOK CLASSI', itself truncated).
      2. For a brand ``b`` of length >= MIN_BRAND_CANONICAL_BASE_LEN, any seller
         whose normalized name starts with ``b`` is a plausible expansion.
      3. Pick the longest candidate with count >= MIN_BRAND_CANONICAL_SELLER_COUNT;
         ties broken by highest count.
      4. Explicit overrides (evidence-based) take precedence.

    Returns ``(mapping, suspected)`` where ``mapping[b]`` is the canonical name
    (original seller spelling) and ``suspected[b]`` is True when ``b`` looks
    like a truncated brand (corrected, or short with an unapplied match).
    """
    from src.config import (
        MIN_BRAND_CANONICAL_BASE_LEN,
        MIN_BRAND_CANONICAL_SELLER_COUNT,
    )

    # normalized -> (display_name, count) over the seller vocabulary only.
    candidates: dict[str, tuple[str, int]] = {}
    for name, count in seller_counts.items():
        norm = _norm(name)
        display = name.strip()
        if norm not in candidates or count > candidates[norm][1]:
            candidates[norm] = (display, count)

    mapping: dict[str, str] = {}
    suspected: dict[str, bool] = {}

    for raw in brand_counts:
        clean_name = raw.strip()
        base = _norm(clean_name)
        best_display: str | None = None
        best_len = 0
        best_count = -1
        match_found = False
        for cand_norm, (display, count) in candidates.items():
            if cand_norm == base:
                continue
            if len(cand_norm) > len(base) and cand_norm.startswith(base):
                match_found = True
                if count < MIN_BRAND_CANONICAL_SELLER_COUNT:
                    continue
                if len(cand_norm) > best_len or (
                    len(cand_norm) == best_len and count > best_count
                ):
                    best_display = display
                    best_len = len(cand_norm)
                    best_count = count

        corrected = False
        if clean_name in overrides:
            mapping[clean_name] = overrides[clean_name]
            corrected = True
        elif (
            best_display is not None
            and len(base) >= MIN_BRAND_CANONICAL_BASE_LEN
            and best_len >= len(base) + 2
        ):
            mapping[clean_name] = best_display
            corrected = True

        # Suspected truncation: corrected, or short with an unapplied match.
        suspected[clean_name] = corrected or (
            MIN_BRAND_CANONICAL_BASE_LEN <= len(base) <= MIN_TRUNCATION_CANDIDATE_LEN
            and match_found
        )

    return mapping, suspected


# ---------------------------------------------------------------------------
# product_details attribute keys / values
# ---------------------------------------------------------------------------

def clean_attr_key(key: object) -> str:
    """Map a raw product_details attribute key to a canonical key."""
    if not isinstance(key, str):
        return "Other Attribute"
    stripped = key.strip()
    if stripped in ATTR_KEY_CANONICAL:
        return ATTR_KEY_CANONICAL[stripped]
    # Collapse repeated spaces, keep original casing otherwise.
    return re.sub(r"\s+", " ", stripped)


def clean_attr_value(value: object) -> str | None:
    """Clean an attribute value (same rules as free text)."""
    return clean_text(value)


def iter_product_details(product_details: list) -> Iterator[tuple[str, str | None, str]]:
    """Yield ``(canonical_key, cleaned_value, original_key)`` for each pair.

    Orphaned values under empty keys are preserved under 'Other Attribute'
    rather than dropped (Phase 1 section 9.5).
    """
    for kv in product_details:
        if not isinstance(kv, dict):
            continue
        for original_key, value in kv.items():
            canonical = clean_attr_key(original_key)
            yield canonical, clean_attr_value(value), original_key
